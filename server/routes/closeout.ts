import { Router } from 'express';
import { query, run, get } from '../db.ts';

const router = Router();

// Helper to get formatted date string YYYY-MM-DD
const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// GET /api/closeout/preview - Complete audit and reconciliation preview for daily closeout
router.get('/preview', (req, res) => {
  try {
    const targetDate = (req.query.date as string) || getTodayStr();
    const nowIso = new Date().toISOString();

    // 1. Open / active tickets that still need settlement
    const openOrders = query(`
      SELECT o.*, s.name as server_name
      FROM orders o
      LEFT JOIN staff s ON o.server_id = s.id
      WHERE o.status IN ('active', 'in_kitchen', 'ready', 'served')
         OR (o.status != 'cancelled' AND o.payment_status != 'paid')
      ORDER BY o.order_number ASC
    `) || [];

    // Parse items for open orders
    const openOrdersWithItems = openOrders.map((o: any) => {
      const items = query('SELECT * FROM order_items WHERE order_id = ?', [o.id]) || [];
      return { ...o, items };
    });

    // 2. Completed & paid orders for target date
    const completedOrders = query(`
      SELECT o.*, s.name as server_name
      FROM orders o
      LEFT JOIN staff s ON o.server_id = s.id
      WHERE o.payment_status = 'paid'
        AND (o.paid_at LIKE ? OR o.created_at LIKE ?)
      ORDER BY o.order_number ASC
    `, [`${targetDate}%`, `${targetDate}%`]) || [];

    // 3. Financial Sales Reconciliation
    const grossSales = completedOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
    const netSales = completedOrders.reduce((sum: number, o: any) => sum + Number(o.subtotal || 0), 0);
    const taxTotal = completedOrders.reduce((sum: number, o: any) => sum + Number(o.tax || 0), 0);
    const tipTotal = completedOrders.reduce((sum: number, o: any) => sum + Number(o.tip || 0), 0);

    const cashOrders = completedOrders.filter((o: any) => o.payment_method === 'cash');
    const cashSales = cashOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

    const cardOrders = completedOrders.filter((o: any) => o.payment_method === 'card_terminal');
    const cardSales = cardOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

    const otherOrders = completedOrders.filter((o: any) => o.payment_method !== 'cash' && o.payment_method !== 'card_terminal');
    const otherSales = otherOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

    const orderCount = completedOrders.length;
    const avgCheckSize = orderCount > 0 ? grossSales / orderCount : 0;

    // Tips breakdown
    const cashTips = cashOrders.reduce((sum: number, o: any) => sum + Number(o.tip || 0), 0);
    const cardTips = cardOrders.reduce((sum: number, o: any) => sum + Number(o.tip || 0), 0);

    // 4. Active Staff Shifts (currently clocked in)
    const activeShiftsRaw = query(`
      SELECT ts.*, s.name as staff_name, s.title as staff_title, s.hourly_rate
      FROM time_shifts ts
      JOIN staff s ON ts.staff_id = s.id
      WHERE ts.status = 'open' OR ts.clock_out IS NULL
      ORDER BY ts.clock_in ASC
    `) || [];

    const activeShifts = activeShiftsRaw.map((s: any) => {
      const clockInMs = new Date(s.clock_in).getTime();
      const currentMs = Date.now();
      const diffHours = Math.max(0, (currentMs - clockInMs) / 3600000);
      return {
        ...s,
        current_hours: Math.round(diffHours * 10) / 10,
      };
    });

    // All shifts logged for target date (completed or open)
    const allTodayShifts = query(`
      SELECT ts.*, s.name as staff_name, s.title as staff_title, s.hourly_rate
      FROM time_shifts ts
      JOIN staff s ON ts.staff_id = s.id
      WHERE ts.clock_in LIKE ?
    `, [`${targetDate}%`]) || [];

    const totalHoursWorked = allTodayShifts.reduce((acc: number, s: any) => {
      const hours = s.total_hours || (s.clock_out ? (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3600000 : (Date.now() - new Date(s.clock_in).getTime()) / 3600000);
      return acc + Math.max(0, Number(hours || 0));
    }, 0);

    const estimatedLaborCost = allTodayShifts.reduce((acc: number, s: any) => {
      const hours = s.total_hours || (s.clock_out ? (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3600000 : (Date.now() - new Date(s.clock_in).getTime()) / 3600000);
      const rate = Number(s.hourly_rate || 0);
      return acc + (Math.max(0, Number(hours || 0)) * rate);
    }, 0);

    // 5. Perpetual Inventory & Prime Cost Analysis for completed orders
    let totalCogs = 0;
    const completedOrderIds = completedOrders.map((o: any) => o.id);
    if (completedOrderIds.length > 0) {
      const placeholders = completedOrderIds.map(() => '?').join(',');
      const orderedItems = query(`
        SELECT oi.menu_item_id, oi.quantity, mii.quantity_used, mii.driver_cost, ii.unit_cost
        FROM order_items oi
        JOIN menu_item_ingredients mii ON oi.menu_item_id = mii.menu_item_id
        LEFT JOIN inventory_items ii ON mii.inventory_item_id = ii.id
        WHERE oi.order_id IN (${placeholders})
      `, completedOrderIds) || [];

      totalCogs = orderedItems.reduce((acc: number, item: any) => {
        const costPerUnit = Number(item.driver_cost || item.unit_cost || 0);
        const qtyUsed = Number(item.quantity_used || 1);
        const orderQty = Number(item.quantity || 1);
        return acc + (costPerUnit * qtyUsed * orderQty);
      }, 0);
    }

    const foodCostPercent = netSales > 0 ? (totalCogs / netSales) * 100 : 0;

    // 6. Low stock items
    const lowStockItems = query(`
      SELECT *
      FROM inventory_items
      WHERE current_stock <= min_threshold
      ORDER BY (current_stock - min_threshold) ASC
    `) || [];

    // 7. Check if a closeout already exists for target date
    const previousCloseout = get(`
      SELECT *
      FROM daily_closeouts
      WHERE closeout_date = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [targetDate]) || null;

    // Latest overall Z-Report count
    const lastZReport = get('SELECT MAX(z_report_number) as max_z FROM daily_closeouts');
    const nextZReportNumber = (lastZReport?.max_z || 100) + 1;

    res.json({
      date: targetDate,
      openOrders: openOrdersWithItems,
      openOrdersCount: openOrdersWithItems.length,
      activeShifts,
      activeStaffCount: activeShifts.length,
      salesSummary: {
        grossSales: Math.round(grossSales * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
        taxTotal: Math.round(taxTotal * 100) / 100,
        tipTotal: Math.round(tipTotal * 100) / 100,
        orderCount,
        cashSales: Math.round(cashSales * 100) / 100,
        cardSales: Math.round(cardSales * 100) / 100,
        otherSales: Math.round(otherSales * 100) / 100,
        avgCheckSize: Math.round(avgCheckSize * 100) / 100,
      },
      tipsSummary: {
        totalTips: Math.round(tipTotal * 100) / 100,
        cashTips: Math.round(cashTips * 100) / 100,
        cardTips: Math.round(cardTips * 100) / 100,
      },
      staffSummary: {
        totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
        estimatedLaborCost: Math.round(estimatedLaborCost * 100) / 100,
        clockedInStaffCount: activeShifts.length,
      },
      primeCostSummary: {
        totalCogs: Math.round(totalCogs * 100) / 100,
        foodCostPercent: Math.round(foodCostPercent * 10) / 10,
      },
      lowStockItems,
      previousCloseout,
      nextZReportNumber,
    });
  } catch (err: any) {
    console.error('Error generating closeout preview:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/closeout/settle-open-orders - Bulk settle remaining open tickets
router.post('/settle-open-orders', (req, res) => {
  try {
    const { payment_method = 'cash', server_id = null } = req.body;
    const nowIso = new Date().toISOString();

    const openOrders = query(`
      SELECT *
      FROM orders
      WHERE status IN ('active', 'in_kitchen', 'ready', 'served')
         OR (status != 'cancelled' AND payment_status != 'paid')
    `) || [];

    if (openOrders.length === 0) {
      return res.json({ message: 'No open orders to settle', settledCount: 0 });
    }

    let settledCount = 0;

    for (const order of openOrders) {
      // 1. Mark order paid and completed
      run(`
        UPDATE orders
        SET status = 'completed',
            payment_status = 'paid',
            payment_method = ?,
            paid_at = ?,
            updated_at = ?
        WHERE id = ?
      `, [payment_method, nowIso, nowIso, order.id]);

      // 2. Deplete inventory for this order's items
      const items = query('SELECT * FROM order_items WHERE order_id = ?', [order.id]) || [];
      for (const item of items) {
        const ingredients = query(`
          SELECT * FROM menu_item_ingredients WHERE menu_item_id = ?
        `, [item.menu_item_id]) || [];

        for (const ing of ingredients) {
          if (ing.inventory_item_id) {
            const totalUsed = Number(ing.quantity_used || 1) * Number(item.quantity || 1);
            run(`
              UPDATE inventory_items
              SET current_stock = current_stock - ?,
                  updated_at = ?
              WHERE id = ?
            `, [totalUsed, nowIso, ing.inventory_item_id]);

            const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
            run(`
              INSERT INTO inventory_logs (id, inventory_item_id, change_amount, change_type, notes, created_at)
              VALUES (?, ?, ?, 'order_depletion', ?, ?)
            `, [logId, ing.inventory_item_id, -totalUsed, `EOD Closeout settlement for Order #${order.order_number}`, nowIso]);
          }
        }
      }

      settledCount++;
    }

    res.json({
      message: `Successfully settled and closed ${settledCount} open tickets.`,
      settledCount,
    });
  } catch (err: any) {
    console.error('Error settling open orders:', err);
    res.status(500).json({ error: err.message || 'Failed to settle open orders' });
  }
});

// POST /api/closeout/clock-out-all - Clock out all active shifts
router.post('/clock-out-all', (req, res) => {
  try {
    const nowIso = new Date().toISOString();
    const openShifts = query(`
      SELECT *
      FROM time_shifts
      WHERE status = 'open' OR clock_out IS NULL
    `) || [];

    if (openShifts.length === 0) {
      return res.json({ message: 'No active shifts to clock out', clockedOutCount: 0 });
    }

    let clockedOutCount = 0;

    for (const shift of openShifts) {
      const clockInTime = new Date(shift.clock_in).getTime();
      const clockOutTime = new Date(nowIso).getTime();
      const breakMs = Number(shift.break_minutes || 0) * 60 * 1000;
      const hoursWorked = Math.max(0.1, Math.round(((clockOutTime - clockInTime - breakMs) / (1000 * 60 * 60)) * 100) / 100);

      run(`
        UPDATE time_shifts
        SET clock_out = ?,
            total_hours = ?,
            status = 'completed',
            notes = COALESCE(notes, '') || ' [Auto-closed during EOD]'
        WHERE id = ?
      `, [nowIso, hoursWorked, shift.id]);

      clockedOutCount++;
    }

    res.json({
      message: `Successfully clocked out ${clockedOutCount} active staff members.`,
      clockedOutCount,
    });
  } catch (err: any) {
    console.error('Error clocking out all staff:', err);
    res.status(500).json({ error: err.message || 'Failed to clock out staff' });
  }
});

// POST /api/closeout/finalize - Finalize End-of-Day and save Z-Report
router.post('/finalize', (req, res) => {
  try {
    const {
      closeout_date,
      closed_by_staff_id,
      closed_by_staff_name = 'Manager on Duty',
      starting_float = 200,
      actual_cash = 0,
      notes = '',
    } = req.body;

    const targetDate = closeout_date || getTodayStr();
    const nowIso = new Date().toISOString();

    // Recompute actual financials directly from database for integrity
    const completedOrders = query(`
      SELECT *
      FROM orders
      WHERE payment_status = 'paid'
        AND (paid_at LIKE ? OR created_at LIKE ?)
    `, [`${targetDate}%`, `${targetDate}%`]) || [];

    const grossSales = completedOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
    const netSales = completedOrders.reduce((sum: number, o: any) => sum + Number(o.subtotal || 0), 0);
    const taxCollected = completedOrders.reduce((sum: number, o: any) => sum + Number(o.tax || 0), 0);
    const tipsCollected = completedOrders.reduce((sum: number, o: any) => sum + Number(o.tip || 0), 0);

    const cashOrders = completedOrders.filter((o: any) => o.payment_method === 'cash');
    const cashSales = cashOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

    const cardOrders = completedOrders.filter((o: any) => o.payment_method === 'card_terminal');
    const cardSales = cardOrders.reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);

    // Expected cash in drawer = Float + Cash Sales
    const numStartingFloat = Number(starting_float) || 0;
    const numActualCash = Number(actual_cash) || 0;
    const expectedCash = numStartingFloat + cashSales;
    const cashVariance = Math.round((numActualCash - expectedCash) * 100) / 100;

    // COGS
    let totalCogs = 0;
    const completedOrderIds = completedOrders.map((o: any) => o.id);
    if (completedOrderIds.length > 0) {
      const placeholders = completedOrderIds.map(() => '?').join(',');
      const orderedItems = query(`
        SELECT oi.quantity, mii.quantity_used, mii.driver_cost, ii.unit_cost
        FROM order_items oi
        JOIN menu_item_ingredients mii ON oi.menu_item_id = mii.menu_item_id
        LEFT JOIN inventory_items ii ON mii.inventory_item_id = ii.id
        WHERE oi.order_id IN (${placeholders})
      `, completedOrderIds) || [];

      totalCogs = orderedItems.reduce((acc: number, item: any) => {
        const costPerUnit = Number(item.driver_cost || item.unit_cost || 0);
        const qtyUsed = Number(item.quantity_used || 1);
        const orderQty = Number(item.quantity || 1);
        return acc + (costPerUnit * qtyUsed * orderQty);
      }, 0);
    }

    // Labor hours
    const allTodayShifts = query(`
      SELECT total_hours FROM time_shifts WHERE clock_in LIKE ?
    `, [`${targetDate}%`]) || [];
    const totalLaborHours = allTodayShifts.reduce((acc: number, s: any) => acc + Number(s.total_hours || 0), 0);

    // Determine next sequential Z-Report number
    const lastZ = get('SELECT MAX(z_report_number) as max_z FROM daily_closeouts');
    const zReportNumber = (Number(lastZ?.max_z) || 100) + 1;

    const closeoutId = 'closeout_' + Date.now();

    run(`
      INSERT INTO daily_closeouts (
        id, closeout_date, closed_by_staff_id, closed_by_staff_name,
        gross_sales, net_sales, tax_collected, tips_collected,
        cash_sales, card_sales, starting_float, expected_cash,
        actual_cash, cash_variance, cogs_total, orders_count,
        labor_hours, notes, z_report_number, created_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?
      )
    `, [
      closeoutId,
      targetDate,
      closed_by_staff_id || null,
      closed_by_staff_name,
      Math.round(grossSales * 100) / 100,
      Math.round(netSales * 100) / 100,
      Math.round(taxCollected * 100) / 100,
      Math.round(tipsCollected * 100) / 100,
      Math.round(cashSales * 100) / 100,
      Math.round(cardSales * 100) / 100,
      Math.round(numStartingFloat * 100) / 100,
      Math.round(expectedCash * 100) / 100,
      Math.round(numActualCash * 100) / 100,
      cashVariance,
      Math.round(totalCogs * 100) / 100,
      completedOrders.length,
      Math.round(totalLaborHours * 10) / 10,
      notes || '',
      zReportNumber,
      nowIso,
    ]);

    const createdRecord = get('SELECT * FROM daily_closeouts WHERE id = ?', [closeoutId]);

    res.status(201).json({
      message: 'End-of-Day closeout finalized and recorded successfully.',
      closeout: createdRecord,
      zReportNumber,
    });
  } catch (err: any) {
    console.error('Error finalizing closeout:', err);
    res.status(500).json({ error: err.message || 'Failed to finalize closeout' });
  }
});

// GET /api/closeout/history - List past daily closeout reports
router.get('/history', (req, res) => {
  try {
    const list = query(`
      SELECT *
      FROM daily_closeouts
      ORDER BY closeout_date DESC, created_at DESC
      LIMIT 60
    `) || [];
    res.json(list);
  } catch (err: any) {
    console.error('Error fetching closeout history:', err);
    res.status(500).json({ error: err.message || 'Failed to load closeout history' });
  }
});

// GET /api/closeout/:id - Get specific Z-report
router.get('/:id', (req, res) => {
  try {
    const record = get('SELECT * FROM daily_closeouts WHERE id = ?', [req.params.id]);
    if (!record) {
      return res.status(404).json({ error: 'Closeout record not found' });
    }
    res.json(record);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch closeout' });
  }
});

export default router;

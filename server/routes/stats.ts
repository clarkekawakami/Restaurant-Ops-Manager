import { Router } from 'express';
import { query, get } from '../db.ts';

const router = Router();

router.get('/dashboard', (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Today's completed sales
    const todayOrders = query(`
      SELECT total, payment_method, tip
      FROM orders
      WHERE payment_status = 'paid' AND (created_at LIKE ? OR paid_at LIKE ?)
    `, [`${todayStr}%`, `${todayStr}%`]);

    const todaySales = todayOrders.reduce((acc: number, cur: any) => acc + Number(cur.total || 0), 0);
    const todayTips = todayOrders.reduce((acc: number, cur: any) => acc + Number(cur.tip || 0), 0);

    const cashSales = todayOrders
      .filter((o: any) => o.payment_method === 'cash')
      .reduce((acc: number, cur: any) => acc + Number(cur.total || 0), 0);

    const cardSales = todayOrders
      .filter((o: any) => o.payment_method === 'card_terminal')
      .reduce((acc: number, cur: any) => acc + Number(cur.total || 0), 0);

    // Open active orders
    const openOrdersCount = get(`
      SELECT COUNT(*) as count
      FROM orders
      WHERE status IN ('active', 'in_kitchen', 'ready', 'served')
    `)?.count || 0;

    // Active clocked-in staff
    const activeStaffCount = get(`
      SELECT COUNT(*) as count
      FROM time_shifts
      WHERE status = 'open'
    `)?.count || 0;

    // Low stock inventory items
    const lowStockItems = query(`
      SELECT *
      FROM inventory_items
      WHERE current_stock <= min_threshold
    `);

    // Today reservations
    const todayReservations = query(`
      SELECT *
      FROM reservations
      WHERE reservation_date = ? AND status != 'cancelled'
    `, [todayStr]);

    res.json({
      todaySales: Math.round(todaySales * 100) / 100,
      todayOrderCount: todayOrders.length,
      cashSales: Math.round(cashSales * 100) / 100,
      cardSales: Math.round(cardSales * 100) / 100,
      todayTipsTotal: Math.round(todayTips * 100) / 100,
      openOrdersCount: Number(openOrdersCount),
      activeStaffCount: Number(activeStaffCount),
      lowStockCount: lowStockItems.length,
      lowStockItems,
      todayReservationsCount: todayReservations.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

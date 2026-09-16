import { Router } from 'express';
import { query, run, get } from '../db.ts';

const router = Router();

// List tips
router.get('/', (req, res) => {
  try {
    const { from_date, to_date, staff_id } = req.query;
    let sql = `
      SELECT t.*, s.name as staff_name, s.role as staff_role
      FROM tips t
      LEFT JOIN staff s ON t.staff_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (staff_id) {
      sql += ` AND t.staff_id = ?`;
      params.push(staff_id);
    }

    if (from_date) {
      sql += ` AND t.date >= ?`;
      params.push(from_date);
    }

    if (to_date) {
      sql += ` AND t.date <= ?`;
      params.push(to_date);
    }

    sql += ` ORDER BY t.date DESC, t.created_at DESC`;
    const tips = query(sql, params);
    res.json(tips);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Record tip
router.post('/', (req, res) => {
  try {
    const { date, staff_id, order_id, amount, tip_type, distribution_method, notes } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid tip amount is required' });
    }

    const tipId = 'tip_' + Date.now();
    const now = new Date().toISOString();
    const tipDate = date || now.split('T')[0];

    run(
      `INSERT INTO tips (id, date, staff_id, order_id, amount, tip_type, distribution_method, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipId,
        tipDate,
        staff_id || null,
        order_id || null,
        Number(amount),
        tip_type || 'cash_drop',
        distribution_method || 'direct',
        notes || '',
        now,
      ]
    );

    const created = get(`
      SELECT t.*, s.name as staff_name, s.role as staff_role
      FROM tips t
      LEFT JOIN staff s ON t.staff_id = s.id
      WHERE t.id = ?
    `, [tipId]);

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Distribute tip pool across staff active on a specific date based on hours worked
router.post('/distribute-pool', (req, res) => {
  try {
    const { date, pool_amount, notes, eligible_roles } = req.body;
    const amount = Number(pool_amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid pool amount is required' });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    // Find shifts on this date
    let shiftsSql = `
      SELECT ts.*, s.name as staff_name, s.role
      FROM time_shifts ts
      JOIN staff s ON ts.staff_id = s.id
      WHERE ts.clock_in LIKE ?
    `;
    const shifts = query(shiftsSql, [`${targetDate}%`]);

    // Filter shifts with positive hours or currently clocked in
    const eligibleShifts = shifts.filter((sh: any) => {
      if (Array.isArray(eligible_roles) && eligible_roles.length > 0) {
        if (!eligible_roles.includes(sh.role)) return false;
      }
      return sh.total_hours > 0 || sh.status === 'open';
    });

    if (eligibleShifts.length === 0) {
      return res.status(400).json({ error: `No staff shifts found on ${targetDate} for tip pooling.` });
    }

    // Calculate total hours
    const staffHoursMap = new Map<string, { staff_id: string; staff_name: string; hours: number }>();
    let totalEligibleHours = 0;

    for (const sh of eligibleShifts) {
      // If open shift, calculate hours up to now
      let h = sh.total_hours;
      if (sh.status === 'open') {
        const diffMs = Date.now() - new Date(sh.clock_in).getTime();
        h = Math.max(0.5, Math.round((diffMs / 3600000) * 100) / 100);
      }
      if (h <= 0) h = 1.0;

      const existing = staffHoursMap.get(sh.staff_id) || { staff_id: sh.staff_id, staff_name: sh.staff_name, hours: 0 };
      existing.hours += h;
      staffHoursMap.set(sh.staff_id, existing);
      totalEligibleHours += h;
    }

    const now = new Date().toISOString();
    const distributedRecords: any[] = [];

    // Distribute proportionally
    for (const [staffId, data] of staffHoursMap.entries()) {
      const shareRatio = data.hours / totalEligibleHours;
      const allocatedTip = Math.round(amount * shareRatio * 100) / 100;
      const tipId = 'tip_pool_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

      run(
        `INSERT INTO tips (id, date, staff_id, order_id, amount, tip_type, distribution_method, notes, created_at)
         VALUES (?, ?, ?, NULL, ?, 'pooled_distribution', 'hours_worked_pool', ?, ?)`,
        [
          tipId,
          targetDate,
          staffId,
          allocatedTip,
          `Pooled tip distribution (${data.hours.toFixed(1)}h of ${totalEligibleHours.toFixed(1)}h total). ${notes || ''}`,
          now,
        ]
      );

      distributedRecords.push({
        staff_id: staffId,
        staff_name: data.staff_name,
        hours: data.hours,
        allocated_tip: allocatedTip,
      });
    }

    res.json({
      success: true,
      target_date: targetDate,
      total_pool: amount,
      total_hours: totalEligibleHours,
      distributions: distributedRecords,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Payroll summary endpoint for external payroll systems (hours, wages, tips, gross)
router.get('/payroll-summary', (req, res) => {
  try {
    const { from_date, to_date } = req.query;

    const allStaff = query('SELECT * FROM staff WHERE is_active = 1 ORDER BY name ASC');

    let shiftsSql = `
      SELECT ts.*, s.hourly_rate
      FROM time_shifts ts
      JOIN staff s ON ts.staff_id = s.id
      WHERE 1=1
    `;
    const shiftParams: any[] = [];

    if (from_date) {
      shiftsSql += ` AND ts.clock_in >= ?`;
      shiftParams.push(`${from_date}T00:00:00.000Z`);
    }
    if (to_date) {
      shiftsSql += ` AND ts.clock_in <= ?`;
      shiftParams.push(`${to_date}T23:59:59.999Z`);
    }

    const shifts = query(shiftsSql, shiftParams);

    let tipsSql = `SELECT * FROM tips WHERE 1=1`;
    const tipParams: any[] = [];
    if (from_date) {
      tipsSql += ` AND date >= ?`;
      tipParams.push(from_date);
    }
    if (to_date) {
      tipsSql += ` AND date <= ?`;
      tipParams.push(to_date);
    }

    const tips = query(tipsSql, tipParams);

    const summary = allStaff.map((st: any) => {
      const staffShifts = shifts.filter((sh: any) => sh.staff_id === st.id);
      const totalHours = staffShifts.reduce((acc: number, cur: any) => acc + Number(cur.total_hours || 0), 0);
      const baseWages = Math.round(totalHours * Number(st.hourly_rate) * 100) / 100;

      const staffTips = tips.filter((t: any) => t.staff_id === st.id);
      const directTips = staffTips
        .filter((t: any) => t.tip_type !== 'pooled_distribution')
        .reduce((acc: number, cur: any) => acc + Number(cur.amount || 0), 0);
      const pooledTips = staffTips
        .filter((t: any) => t.tip_type === 'pooled_distribution')
        .reduce((acc: number, cur: any) => acc + Number(cur.amount || 0), 0);

      const totalTips = Math.round((directTips + pooledTips) * 100) / 100;
      const totalGross = Math.round((baseWages + totalTips) * 100) / 100;

      return {
        staff_id: st.id,
        staff_name: st.name,
        role: st.role,
        hourly_rate: Number(st.hourly_rate),
        total_hours: Math.round(totalHours * 100) / 100,
        base_wages: baseWages,
        direct_tips: Math.round(directTips * 100) / 100,
        pooled_tips: Math.round(pooledTips * 100) / 100,
        total_tips: totalTips,
        total_gross_pay: totalGross,
        shift_count: staffShifts.length,
      };
    });

    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CSV Export for external payroll systems (Gusto, ADP, QuickBooks, Paychex format)
router.get('/payroll-csv', (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const allStaff = query('SELECT * FROM staff WHERE is_active = 1 ORDER BY name ASC');

    let shiftsSql = `SELECT * FROM time_shifts WHERE 1=1`;
    const shiftParams: any[] = [];
    if (from_date) {
      shiftsSql += ` AND clock_in >= ?`;
      shiftParams.push(`${from_date}T00:00:00.000Z`);
    }
    if (to_date) {
      shiftsSql += ` AND clock_in <= ?`;
      shiftParams.push(`${to_date}T23:59:59.999Z`);
    }
    const shifts = query(shiftsSql, shiftParams);

    let tipsSql = `SELECT * FROM tips WHERE 1=1`;
    const tipParams: any[] = [];
    if (from_date) {
      tipsSql += ` AND date >= ?`;
      tipParams.push(from_date);
    }
    if (to_date) {
      tipsSql += ` AND date <= ?`;
      tipParams.push(to_date);
    }
    const tips = query(tipsSql, tipParams);

    const headers = [
      'Employee ID',
      'Employee Name',
      'Job Role',
      'Hourly Rate',
      'Regular Hours',
      'Base Pay',
      'Direct Tips',
      'Pooled Tips',
      'Total Tips (Taxable)',
      'Total Gross Compensation',
      'Shift Count',
      'Pay Period Start',
      'Pay Period End',
    ];

    const rows = allStaff.map((st: any) => {
      const staffShifts = shifts.filter((sh: any) => sh.staff_id === st.id);
      const totalHours = staffShifts.reduce((acc: number, cur: any) => acc + Number(cur.total_hours || 0), 0);
      const baseWages = Math.round(totalHours * Number(st.hourly_rate) * 100) / 100;

      const staffTips = tips.filter((t: any) => t.staff_id === st.id);
      const directTips = staffTips
        .filter((t: any) => t.tip_type !== 'pooled_distribution')
        .reduce((acc: number, cur: any) => acc + Number(cur.amount || 0), 0);
      const pooledTips = staffTips
        .filter((t: any) => t.tip_type === 'pooled_distribution')
        .reduce((acc: number, cur: any) => acc + Number(cur.amount || 0), 0);

      const totalTips = Math.round((directTips + pooledTips) * 100) / 100;
      const totalGross = Math.round((baseWages + totalTips) * 100) / 100;

      return [
        `"${st.id}"`,
        `"${st.name}"`,
        `"${st.role}"`,
        st.hourly_rate.toFixed(2),
        totalHours.toFixed(2),
        baseWages.toFixed(2),
        directTips.toFixed(2),
        pooledTips.toFixed(2),
        totalTips.toFixed(2),
        totalGross.toFixed(2),
        staffShifts.length,
        `"${from_date || 'All Time'}"`,
        `"${to_date || 'Current'}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="restaurant-payroll-${from_date || 'start'}-to-${to_date || 'end'}.csv"`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete tip record
router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM tips WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

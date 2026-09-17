import { Router } from 'express';
import { query, run, get } from '../db.ts';

const router = Router();

// Staff roster
router.get('/', (req, res) => {
  try {
    const staff = query(`
      SELECT s.*,
        (SELECT id FROM time_shifts WHERE staff_id = s.id AND status = 'open' LIMIT 1) as current_shift_id
      FROM staff s
      ORDER BY s.name ASC
    `);

    res.json(staff.map((s: any) => ({
      ...s,
      title: s.title || s.role || 'staff',
      role: s.title || s.role || 'staff',
      is_active: Boolean(s.is_active),
      admin_access: Boolean(s.admin_access),
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, title, role, hourly_rate, pin, admin_access } = req.body;
    const staffTitle = title || role;
    if (!name || !staffTitle || hourly_rate === undefined) {
      return res.status(400).json({ error: 'Name, title, and hourly rate are required' });
    }
    const id = 'staff_' + Date.now();
    const now = new Date().toISOString();

    run(
      `INSERT INTO staff (id, name, title, hourly_rate, pin, is_active, admin_access, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, name, staffTitle, Number(hourly_rate), pin || '1234', admin_access ? 1 : 0, now]
    );

    const created = get('SELECT * FROM staff WHERE id = ?', [id]);
    res.status(201).json({
      ...created,
      title: created.title,
      role: created.title,
      is_active: true,
      admin_access: Boolean(created.admin_access),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, title, role, hourly_rate, pin, is_active, admin_access } = req.body;
    const existing = get('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Staff member not found' });

    const staffTitle = title !== undefined ? title : (role !== undefined ? role : existing.title);

    run(
      `UPDATE staff
       SET name = ?, title = ?, hourly_rate = ?, pin = ?, is_active = ?, admin_access = ?
       WHERE id = ?`,
      [
        name ?? existing.name,
        staffTitle,
        hourly_rate !== undefined ? Number(hourly_rate) : existing.hourly_rate,
        pin ?? existing.pin,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        admin_access !== undefined ? (admin_access ? 1 : 0) : (existing.admin_access ?? 0),
        req.params.id
      ]
    );
    const updated = get('SELECT * FROM staff WHERE id = ?', [req.params.id]);
    res.json({
      ...updated,
      title: updated.title,
      role: updated.title,
      is_active: Boolean(updated.is_active),
      admin_access: Boolean(updated.admin_access),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Verify Administrator Credentials
router.post('/verify-admin', (req, res) => {
  try {
    const { staff_id, pin } = req.body;
    if (!staff_id || !pin) {
      return res.status(400).json({ error: 'Staff member ID and PIN code are required' });
    }
    const staff = get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    if (!Boolean(staff.admin_access)) {
      return res.status(403).json({ error: 'Selected staff member does not have administrator access' });
    }
    if (String(staff.pin) !== String(pin).trim()) {
      return res.status(401).json({ error: 'Invalid PIN for selected administrator' });
    }
    res.json({
      success: true,
      staff: {
        ...staff,
        title: staff.title || staff.role,
        role: staff.title || staff.role,
        is_active: Boolean(staff.is_active),
        admin_access: Boolean(staff.admin_access),
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clock-in
router.post('/clock-in', (req, res) => {
  try {
    const { staff_id, pin, notes } = req.body;
    const staff = get('SELECT * FROM staff WHERE id = ?', [staff_id]);
    if (!staff) return res.status(404).json({ error: 'Staff member not found' });

    if (pin && staff.pin !== pin) {
      return res.status(401).json({ error: 'Invalid Staff PIN code' });
    }

    // Check if already clocked in
    const activeShift = get("SELECT * FROM time_shifts WHERE staff_id = ? AND status = 'open'", [staff_id]);
    if (activeShift) {
      return res.status(400).json({ error: `${staff.name} is already clocked in.` });
    }

    const shiftId = 'shift_' + Date.now();
    const now = new Date().toISOString();

    run(
      `INSERT INTO time_shifts (id, staff_id, clock_in, clock_out, break_minutes, total_hours, status, notes)
       VALUES (?, ?, ?, NULL, 0, 0, 'open', ?)`,
      [shiftId, staff_id, now, notes || '']
    );

    const createdShift = get(`
      SELECT ts.*, s.name as staff_name, s.title as staff_title, s.title as staff_role, s.hourly_rate
      FROM time_shifts ts
      JOIN staff s ON ts.staff_id = s.id
      WHERE ts.id = ?
    `, [shiftId]);

    res.status(201).json(createdShift);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clock-out
router.post('/clock-out', (req, res) => {
  try {
    const { shift_id, staff_id, break_minutes, notes } = req.body;
    let shift: any = null;

    if (shift_id) {
      shift = get('SELECT * FROM time_shifts WHERE id = ?', [shift_id]);
    } else if (staff_id) {
      shift = get("SELECT * FROM time_shifts WHERE staff_id = ? AND status = 'open'", [staff_id]);
    }

    if (!shift) {
      return res.status(404).json({ error: 'No active shift found to clock out.' });
    }

    const clockOutTime = new Date();
    const clockInTime = new Date(shift.clock_in);
    const breakMins = Number(break_minutes || shift.break_minutes || 0);

    const diffMs = clockOutTime.getTime() - clockInTime.getTime();
    const diffHours = Math.max(0, (diffMs / (1000 * 60 * 60)) - (breakMins / 60));
    const totalHours = Math.round(diffHours * 100) / 100;
    const nowIso = clockOutTime.toISOString();

    run(
      `UPDATE time_shifts
       SET clock_out = ?, break_minutes = ?, total_hours = ?, status = 'completed', notes = ?
       WHERE id = ?`,
      [nowIso, breakMins, totalHours, notes || shift.notes || '', shift.id]
    );

    const updated = get(`
      SELECT ts.*, s.name as staff_name, s.title as staff_title, s.title as staff_role, s.hourly_rate
      FROM time_shifts ts
      JOIN staff s ON ts.staff_id = s.id
      WHERE ts.id = ?
    `, [shift.id]);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List shifts
router.get('/shifts', (req, res) => {
  try {
    const { status, staff_id, from_date, to_date } = req.query;
    let sql = `
      SELECT ts.*, s.name as staff_name, s.title as staff_title, s.title as staff_role, s.hourly_rate
      FROM time_shifts ts
      JOIN staff s ON ts.staff_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      sql += ` AND ts.status = ?`;
      params.push(status);
    }

    if (staff_id) {
      sql += ` AND ts.staff_id = ?`;
      params.push(staff_id);
    }

    if (from_date) {
      sql += ` AND ts.clock_in >= ?`;
      params.push(`${from_date}T00:00:00.000Z`);
    }

    if (to_date) {
      sql += ` AND ts.clock_in <= ?`;
      params.push(`${to_date}T23:59:59.999Z`);
    }

    sql += ` ORDER BY ts.clock_in DESC`;

    const shifts = query(sql, params);
    res.json(shifts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create manual shift (for retroactive shift adjustments)
router.post('/shifts/manual', (req, res) => {
  try {
    const { staff_id, clock_in, clock_out, break_minutes, notes } = req.body;
    if (!staff_id || !clock_in || !clock_out) {
      return res.status(400).json({ error: 'Staff, clock-in, and clock-out are required' });
    }

    const inTime = new Date(clock_in);
    const outTime = new Date(clock_out);
    const breakMins = Number(break_minutes || 0);
    const diffMs = outTime.getTime() - inTime.getTime();
    const totalHours = Math.max(0, Math.round(((diffMs / (1000 * 60 * 60)) - (breakMins / 60)) * 100) / 100);

    const shiftId = 'shift_' + Date.now();
    run(
      `INSERT INTO time_shifts (id, staff_id, clock_in, clock_out, break_minutes, total_hours, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [shiftId, staff_id, inTime.toISOString(), outTime.toISOString(), breakMins, totalHours, notes || 'Manual entry']
    );

    const created = get(`
      SELECT ts.*, s.name as staff_name, s.title as staff_title, s.title as staff_role, s.hourly_rate
      FROM time_shifts ts
      JOIN staff s ON ts.staff_id = s.id
      WHERE ts.id = ?
    `, [shiftId]);

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update shift details (manager edit)
router.put('/shifts/:id', (req, res) => {
  try {
    const { clock_in, clock_out, break_minutes, notes } = req.body;
    const shift = get('SELECT * FROM time_shifts WHERE id = ?', [req.params.id]);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });

    let totalHours = shift.total_hours;
    if (clock_in && clock_out) {
      const inTime = new Date(clock_in);
      const outTime = new Date(clock_out);
      const breakMins = Number(break_minutes ?? shift.break_minutes);
      const diffMs = outTime.getTime() - inTime.getTime();
      totalHours = Math.max(0, Math.round(((diffMs / (1000 * 60 * 60)) - (breakMins / 60)) * 100) / 100);
    }

    run(
      `UPDATE time_shifts
       SET clock_in = ?, clock_out = ?, break_minutes = ?, total_hours = ?, notes = ?
       WHERE id = ?`,
      [
        clock_in || shift.clock_in,
        clock_out || shift.clock_out,
        Number(break_minutes ?? shift.break_minutes),
        totalHours,
        notes ?? shift.notes,
        req.params.id
      ]
    );

    const updated = get(`
      SELECT ts.*, s.name as staff_name, s.title as staff_title, s.title as staff_role, s.hourly_rate
      FROM time_shifts ts
      JOIN staff s ON ts.staff_id = s.id
      WHERE ts.id = ?
    `, [req.params.id]);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete shift
router.delete('/shifts/:id', (req, res) => {
  try {
    run('DELETE FROM time_shifts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

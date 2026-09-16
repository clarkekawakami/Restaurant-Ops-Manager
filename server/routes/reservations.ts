import { Router } from 'express';
import { query, run, get } from '../db.ts';

const router = Router();

// GET reservations
router.get('/', (req, res) => {
  try {
    const { date, status } = req.query;
    let sql = `SELECT * FROM reservations WHERE 1=1`;
    const params: any[] = [];

    if (date) {
      sql += ` AND reservation_date = ?`;
      params.push(date);
    }

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY reservation_date ASC, reservation_time ASC`;
    const reservations = query(sql, params);
    res.json(reservations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST new reservation
router.post('/', (req, res) => {
  try {
    const guest_name = req.body.guest_name || req.body.customer_name;
    const guest_phone = req.body.guest_phone || req.body.customer_phone || '';
    const guest_email = req.body.guest_email || req.body.customer_email || '';
    const party_size = Number(req.body.party_size || 2);
    const reservation_date = req.body.reservation_date;
    const reservation_time = req.body.reservation_time;
    const table_number = req.body.table_number || 'Table 1';
    const special_requests = req.body.special_requests || req.body.notes || '';

    if (!guest_name || !reservation_date || !reservation_time || !party_size) {
      return res.status(400).json({ error: 'Guest name, party size, reservation date, and time are required' });
    }

    const id = 'res_' + Date.now();
    const now = new Date().toISOString();

    run(
      `INSERT INTO reservations 
        (id, guest_name, guest_phone, guest_email, party_size, reservation_date, reservation_time, table_number, status, special_requests, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
      [
        id,
        guest_name,
        guest_phone,
        guest_email,
        party_size,
        reservation_date,
        reservation_time,
        table_number,
        special_requests,
        now,
      ]
    );

    const created = get('SELECT * FROM reservations WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update reservation
router.put('/:id', (req, res) => {
  try {
    const guest_name = req.body.guest_name || req.body.customer_name;
    const guest_phone = req.body.guest_phone || req.body.customer_phone || '';
    const guest_email = req.body.guest_email || req.body.customer_email || '';
    const party_size = Number(req.body.party_size || 2);
    const reservation_date = req.body.reservation_date;
    const reservation_time = req.body.reservation_time;
    const table_number = req.body.table_number || 'Unassigned';
    const status = req.body.status || 'confirmed';
    const special_requests = req.body.special_requests || req.body.notes || '';

    run(
      `UPDATE reservations
       SET guest_name = ?, guest_phone = ?, guest_email = ?, party_size = ?, reservation_date = ?, reservation_time = ?, table_number = ?, status = ?, special_requests = ?
       WHERE id = ?`,
      [
        guest_name,
        guest_phone,
        guest_email,
        party_size,
        reservation_date,
        reservation_time,
        table_number,
        status,
        special_requests,
        req.params.id,
      ]
    );

    const updated = get('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH status
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    run('UPDATE reservations SET status = ? WHERE id = ?', [status, req.params.id]);
    const updated = get('SELECT * FROM reservations WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM reservations WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

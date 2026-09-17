import { Router } from 'express';
import { query, run, get } from '../db.ts';

const router = Router();

// ==========================================
// SEATING LOCATIONS (e.g. Main Dining Room, Bar, Patio)
// ==========================================

// GET all seating locations with table count and total seats capacity
router.get('/locations', (req, res) => {
  try {
    const locations = query(`
      SELECT 
        l.*,
        COUNT(t.id) as table_count,
        COALESCE(SUM(CASE WHEN t.is_active = 1 THEN t.seats ELSE 0 END), 0) as total_seats
      FROM seating_locations l
      LEFT JOIN dining_tables t ON l.id = t.location_id
      GROUP BY l.id
      ORDER BY l.display_order ASC, l.name ASC
    `);
    res.json(locations);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST new seating location
router.post('/locations', (req, res) => {
  try {
    const { name, display_order, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Location name is required' });
    }
    const trimmed = name.trim();

    const existing = get('SELECT id FROM seating_locations WHERE LOWER(name) = LOWER(?)', [trimmed]);
    if (existing) {
      return res.status(400).json({ error: 'A seating location with this name already exists' });
    }

    const id = 'loc_' + Date.now();
    const now = new Date().toISOString();
    run(
      'INSERT INTO seating_locations (id, name, display_order, description, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, trimmed, display_order || 0, description || '', now]
    );

    const created = get(`
      SELECT 
        l.*,
        0 as table_count,
        0 as total_seats
      FROM seating_locations l
      WHERE l.id = ?
    `, [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update seating location
router.put('/locations/:id', (req, res) => {
  try {
    const { name, display_order, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Location name is required' });
    }
    const trimmed = name.trim();

    const existingLoc = get('SELECT * FROM seating_locations WHERE id = ?', [req.params.id]);
    if (!existingLoc) {
      return res.status(404).json({ error: 'Seating location not found' });
    }

    // Check duplicate name on other locations
    const duplicate = get(
      'SELECT id FROM seating_locations WHERE LOWER(name) = LOWER(?) AND id != ?',
      [trimmed, req.params.id]
    );
    if (duplicate) {
      return res.status(400).json({ error: 'Another seating location already uses this name' });
    }

    run(
      'UPDATE seating_locations SET name = ?, display_order = ?, description = ? WHERE id = ?',
      [trimmed, display_order !== undefined ? display_order : existingLoc.display_order, description !== undefined ? description : existingLoc.description, req.params.id]
    );

    const updated = get(`
      SELECT 
        l.*,
        COUNT(t.id) as table_count,
        COALESCE(SUM(CASE WHEN t.is_active = 1 THEN t.seats ELSE 0 END), 0) as total_seats
      FROM seating_locations l
      LEFT JOIN dining_tables t ON l.id = t.location_id
      WHERE l.id = ?
      GROUP BY l.id
    `, [req.params.id]);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE seating location (cascades or reassigns tables)
router.delete('/locations/:id', (req, res) => {
  try {
    const existingLoc = get('SELECT * FROM seating_locations WHERE id = ?', [req.params.id]);
    if (!existingLoc) {
      return res.status(404).json({ error: 'Seating location not found' });
    }

    // Check if there are other locations
    const otherLoc = get('SELECT id FROM seating_locations WHERE id != ? LIMIT 1', [req.params.id]);

    if (otherLoc) {
      // Reassign tables to another location or delete
      // Cascade delete is clean, but let's delete tables associated with this location
      run('DELETE FROM dining_tables WHERE location_id = ?', [req.params.id]);
    }

    run('DELETE FROM seating_locations WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Seating location and associated tables deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DINING TABLES (within seating locations)
// ==========================================

// GET all dining tables, optionally filtered by location_id
router.get('/tables', (req, res) => {
  try {
    const { location_id } = req.query;
    let sql = `
      SELECT 
        t.*,
        l.name as location_name,
        l.display_order as location_order
      FROM dining_tables t
      JOIN seating_locations l ON t.location_id = l.id
    `;
    const params: any[] = [];
    if (location_id) {
      sql += ' WHERE t.location_id = ? ';
      params.push(location_id);
    }
    sql += ' ORDER BY l.display_order ASC, t.display_order ASC, t.table_number ASC';

    const tables = query(sql, params);
    res.json(tables);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST new dining table
router.post('/tables', (req, res) => {
  try {
    const { location_id, table_number, seats, shape, is_active, display_order } = req.body;
    if (!location_id) {
      return res.status(400).json({ error: 'Location is required' });
    }
    if (!table_number || !table_number.trim()) {
      return res.status(400).json({ error: 'Table number/name is required' });
    }

    const loc = get('SELECT id FROM seating_locations WHERE id = ?', [location_id]);
    if (!loc) {
      return res.status(404).json({ error: 'Selected seating location does not exist' });
    }

    // Check duplicate table number
    const existingTbl = get(
      'SELECT id FROM dining_tables WHERE LOWER(table_number) = LOWER(?)',
      [table_number.trim()]
    );
    if (existingTbl) {
      return res.status(400).json({ error: `Table '${table_number.trim()}' already exists` });
    }

    const id = 'tbl_' + Date.now();
    const now = new Date().toISOString();
    const seatCount = Number(seats) > 0 ? Math.floor(Number(seats)) : 4;

    run(
      `INSERT INTO dining_tables 
        (id, location_id, table_number, seats, shape, is_active, display_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        location_id,
        table_number.trim(),
        seatCount,
        shape || 'standard',
        is_active !== undefined ? (is_active ? 1 : 0) : 1,
        display_order || 0,
        now,
      ]
    );

    const created = get(`
      SELECT 
        t.*,
        l.name as location_name,
        l.display_order as location_order
      FROM dining_tables t
      JOIN seating_locations l ON t.location_id = l.id
      WHERE t.id = ?
    `, [id]);

    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update dining table
router.put('/tables/:id', (req, res) => {
  try {
    const { location_id, table_number, seats, shape, is_active, display_order } = req.body;
    const existing = get('SELECT * FROM dining_tables WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Dining table not found' });
    }

    const trimmedNumber = table_number ? table_number.trim() : existing.table_number;
    if (trimmedNumber !== existing.table_number) {
      const duplicate = get(
        'SELECT id FROM dining_tables WHERE LOWER(table_number) = LOWER(?) AND id != ?',
        [trimmedNumber, req.params.id]
      );
      if (duplicate) {
        return res.status(400).json({ error: `Another table already uses the name '${trimmedNumber}'` });
      }
    }

    const targetLocId = location_id || existing.location_id;
    const seatCount = seats !== undefined ? (Number(seats) > 0 ? Math.floor(Number(seats)) : 2) : existing.seats;

    run(
      `UPDATE dining_tables 
       SET location_id = ?, table_number = ?, seats = ?, shape = ?, is_active = ?, display_order = ?
       WHERE id = ?`,
      [
        targetLocId,
        trimmedNumber,
        seatCount,
        shape !== undefined ? shape : existing.shape,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        display_order !== undefined ? display_order : existing.display_order,
        req.params.id,
      ]
    );

    const updated = get(`
      SELECT 
        t.*,
        l.name as location_name,
        l.display_order as location_order
      FROM dining_tables t
      JOIN seating_locations l ON t.location_id = l.id
      WHERE t.id = ?
    `, [req.params.id]);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE dining table
router.delete('/tables/:id', (req, res) => {
  try {
    const existing = get('SELECT * FROM dining_tables WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Dining table not found' });
    }

    // Check if table currently has active open orders
    const activeOrder = get(
      "SELECT id, order_number FROM orders WHERE table_number = ? AND status NOT IN ('completed', 'cancelled') LIMIT 1",
      [existing.table_number]
    );
    if (activeOrder) {
      return res.status(400).json({
        error: `Cannot delete table '${existing.table_number}' because Order #${activeOrder.order_number} is currently active on it.`,
      });
    }

    run('DELETE FROM dining_tables WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: `Table '${existing.table_number}' deleted` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// COMPREHENSIVE SEATING PLAN OVERVIEW
// Returns locations with nested tables and current floor occupancy status
// ==========================================
router.get('/plan', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch locations
    const locations = query(`
      SELECT 
        l.*,
        COUNT(t.id) as table_count,
        COALESCE(SUM(CASE WHEN t.is_active = 1 THEN t.seats ELSE 0 END), 0) as total_seats
      FROM seating_locations l
      LEFT JOIN dining_tables t ON l.id = t.location_id
      GROUP BY l.id
      ORDER BY l.display_order ASC, l.name ASC
    `);

    // Fetch tables
    const tables = query(`
      SELECT 
        t.*,
        l.name as location_name
      FROM dining_tables t
      JOIN seating_locations l ON t.location_id = l.id
      ORDER BY l.display_order ASC, t.display_order ASC, t.table_number ASC
    `);

    // Active orders on tables
    const activeOrders = query(`
      SELECT id, order_number, table_number, guest_count, server_id, status, total, created_at
      FROM orders
      WHERE status NOT IN ('completed', 'cancelled')
    `);

    // Today's reservations
    const reservations = query(`
      SELECT id, guest_name, party_size, reservation_time, table_number, status
      FROM reservations
      WHERE reservation_date = ? AND status IN ('confirmed', 'seated')
    `, [today]);

    // Augment tables with live occupancy status
    const augmentedTables = tables.map((tbl: any) => {
      const activeOrder = activeOrders.find(
        (o: any) => o.table_number && o.table_number.toLowerCase() === tbl.table_number.toLowerCase()
      );
      const activeRes = reservations.find(
        (r: any) => r.table_number && r.table_number.toLowerCase() === tbl.table_number.toLowerCase()
      );

      let currentStatus: 'available' | 'occupied' | 'reserved' = 'available';
      if (activeOrder || activeRes?.status === 'seated') {
        currentStatus = 'occupied';
      } else if (activeRes?.status === 'confirmed') {
        currentStatus = 'reserved';
      }

      return {
        ...tbl,
        status: currentStatus,
        active_order: activeOrder || null,
        active_reservation: activeRes || null,
      };
    });

    // Group tables into locations
    const locationsWithTables = locations.map((loc: any) => {
      const locTables = augmentedTables.filter((t: any) => t.location_id === loc.id);
      return {
        ...loc,
        tables: locTables,
      };
    });

    res.json({
      locations: locationsWithTables,
      tables: augmentedTables,
      total_tables: tables.length,
      total_seats: tables.filter((t: any) => t.is_active === 1).reduce((acc: number, t: any) => acc + t.seats, 0),
      occupied_tables: augmentedTables.filter((t: any) => t.status === 'occupied').length,
      reserved_tables: augmentedTables.filter((t: any) => t.status === 'reserved').length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

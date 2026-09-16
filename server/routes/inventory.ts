import { Router } from 'express';
import { query, run, get } from '../db.ts';

const router = Router();

// Inventory Categories
router.get('/categories', (req, res) => {
  try {
    const categories = query(`
      SELECT c.*, COUNT(i.id) as item_count
      FROM inventory_categories c
      LEFT JOIN inventory_items i ON c.name = i.category
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `);
    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/categories', (req, res) => {
  try {
    const { name, display_order } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const trimmed = name.trim();

    const existing = get('SELECT id FROM inventory_categories WHERE LOWER(name) = LOWER(?)', [trimmed]);
    if (existing) {
      return res.status(400).json({ error: 'An inventory category with this name already exists' });
    }

    const id = 'inv_cat_' + Date.now();
    const now = new Date().toISOString();
    run(
      'INSERT INTO inventory_categories (id, name, display_order, created_at) VALUES (?, ?, ?, ?)',
      [id, trimmed, display_order || 0, now]
    );
    const created = get('SELECT * FROM inventory_categories WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/categories/:id', (req, res) => {
  try {
    const { name, display_order } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
    const trimmed = name.trim();
    const existingCat = get('SELECT * FROM inventory_categories WHERE id = ?', [req.params.id]);
    if (!existingCat) return res.status(404).json({ error: 'Category not found' });

    if (existingCat.name !== trimmed) {
      run('UPDATE inventory_items SET category = ? WHERE category = ?', [trimmed, existingCat.name]);
    }

    run(
      'UPDATE inventory_categories SET name = ?, display_order = ? WHERE id = ?',
      [trimmed, display_order || 0, req.params.id]
    );
    const updated = get('SELECT * FROM inventory_categories WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/categories/:id', (req, res) => {
  try {
    const cat = get('SELECT * FROM inventory_categories WHERE id = ?', [req.params.id]);
    if (cat) {
      run("UPDATE inventory_items SET category = 'General' WHERE category = ?", [cat.name]);
      run('DELETE FROM inventory_categories WHERE id = ?', [req.params.id]);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (req, res) => {
  try {
    const items = query(`
      SELECT * FROM inventory_items
      ORDER BY 
        CASE 
          WHEN current_stock <= 0 THEN 1
          WHEN current_stock <= min_threshold THEN 2
          ELSE 3
        END ASC,
        category ASC,
        name ASC
    `);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, category, unit, current_stock, min_threshold, unit_cost, supplier } = req.body;
    if (!name || !category || !unit) {
      return res.status(400).json({ error: 'Name, category, and unit are required' });
    }
    const id = 'inv_' + Date.now();
    const now = new Date().toISOString();

    run(
      `INSERT INTO inventory_items (id, name, category, unit, current_stock, min_threshold, unit_cost, supplier, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, category, unit, Number(current_stock || 0), Number(min_threshold || 5), Number(unit_cost || 0), supplier || '', now]
    );

    // Initial log
    if (Number(current_stock || 0) > 0) {
      run(
        `INSERT INTO inventory_logs (id, inventory_item_id, change_amount, change_type, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['log_' + Date.now(), id, Number(current_stock || 0), 'restock', 'Initial stock entry', now]
      );
    }

    const created = get('SELECT * FROM inventory_items WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, category, unit, min_threshold, unit_cost, supplier } = req.body;
    const now = new Date().toISOString();

    run(
      `UPDATE inventory_items
       SET name = ?, category = ?, unit = ?, min_threshold = ?, unit_cost = ?, supplier = ?, updated_at = ?
       WHERE id = ?`,
      [name, category, unit, Number(min_threshold || 0), Number(unit_cost || 0), supplier || '', now, req.params.id]
    );

    const updated = get('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Adjust stock (Restock, Waste, Manual Count Audit)
router.post('/:id/adjust', (req, res) => {
  try {
    const { change_amount, change_type, notes } = req.body;
    const item = get('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ error: 'Inventory item not found' });

    const delta = Number(change_amount);
    const newStock = Math.max(0, Number(item.current_stock) + delta);
    const now = new Date().toISOString();

    const lastRestocked = (change_type === 'restock' && delta > 0) ? now : item.last_restocked_at;

    run(
      'UPDATE inventory_items SET current_stock = ?, last_restocked_at = ?, updated_at = ? WHERE id = ?',
      [newStock, lastRestocked, now, req.params.id]
    );

    const logId = 'log_' + Date.now();
    run(
      `INSERT INTO inventory_logs (id, inventory_item_id, change_amount, change_type, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [logId, req.params.id, delta, change_type || 'manual_adjustment', notes || '', now]
    );

    const updated = get('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs', (req, res) => {
  try {
    const logs = query(`
      SELECT l.*, i.name as item_name, i.unit
      FROM inventory_logs l
      JOIN inventory_items i ON l.inventory_item_id = i.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM inventory_logs WHERE inventory_item_id = ?', [req.params.id]);
    run('DELETE FROM menu_item_ingredients WHERE inventory_item_id = ?', [req.params.id]);
    run('DELETE FROM inventory_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

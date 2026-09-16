import { Router } from 'express';
import { query, run, get } from '../db.ts';

const router = Router();

// Categories
router.get('/categories', (req, res) => {
  try {
    const categories = query(`
      SELECT c.*, COUNT(m.id) as item_count
      FROM menu_categories c
      LEFT JOIN menu_items m ON c.id = m.category_id
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
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = 'cat_' + Date.now();
    const now = new Date().toISOString();
    run(
      'INSERT INTO menu_categories (id, name, display_order, created_at) VALUES (?, ?, ?, ?)',
      [id, name, display_order || 0, now]
    );
    const created = get('SELECT * FROM menu_categories WHERE id = ?', [id]);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/categories/:id', (req, res) => {
  try {
    const { name, display_order } = req.body;
    run(
      'UPDATE menu_categories SET name = ?, display_order = ? WHERE id = ?',
      [name, display_order || 0, req.params.id]
    );
    const updated = get('SELECT * FROM menu_categories WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/categories/:id', (req, res) => {
  try {
    run('DELETE FROM menu_categories WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Menu Items
router.get('/items', (req, res) => {
  try {
    const items = query(`
      SELECT m.*, c.name as category_name
      FROM menu_items m
      LEFT JOIN menu_categories c ON m.category_id = c.id
      ORDER BY c.display_order ASC, m.name ASC
    `);

    // Fetch ingredients and cost drivers for each item
    const ingredients = query(`
      SELECT mii.*, ii.name as inventory_name, ii.unit, ii.unit_cost as inventory_unit_cost
      FROM menu_item_ingredients mii
      LEFT JOIN inventory_items ii ON mii.inventory_item_id = ii.id
    `);

    const itemsWithIngredients = items.map((item: any) => ({
      ...item,
      is_available: Boolean(item.is_available),
      ingredients: ingredients.filter((ing: any) => ing.menu_item_id === item.id),
    }));

    res.json(itemsWithIngredients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/items/:id', (req, res) => {
  try {
    const item = get(
      `SELECT m.*, c.name as category_name
       FROM menu_items m
       LEFT JOIN menu_categories c ON m.category_id = c.id
       WHERE m.id = ?`,
      [req.params.id]
    );

    if (!item) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    const ingredients = query(
      `SELECT mii.*, ii.name as inventory_name, ii.unit, ii.unit_cost as inventory_unit_cost
       FROM menu_item_ingredients mii
       LEFT JOIN inventory_items ii ON mii.inventory_item_id = ii.id
       WHERE mii.menu_item_id = ?`,
      [req.params.id]
    );

    res.json({
      ...item,
      is_available: Boolean(item.is_available),
      ingredients,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/items', (req, res) => {
  try {
    const { category_id, name, description, price, cost, pantry_cost, labor_cost, allergens, image_url, ingredients } = req.body;
    if (!name || !category_id || price === undefined) {
      return res.status(400).json({ error: 'Category, name, and price are required' });
    }
    const id = 'item_' + Date.now();
    const now = new Date().toISOString();

    // In aggregate, the primary ingredient cost drivers equal the raw food cost
    let finalRawFoodCost = Number(cost || 0);
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      finalRawFoodCost = ingredients.reduce((sum: number, ing: any) => sum + Number(ing.driver_cost || 0), 0);
    }

    run(
      `INSERT INTO menu_items (id, category_id, name, description, price, cost, pantry_cost, labor_cost, is_available, allergens, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
      [
        id,
        category_id,
        name,
        description || '',
        Number(price),
        Number(finalRawFoodCost),
        Number(pantry_cost || 0),
        Number(labor_cost || 0),
        allergens || '',
        image_url || '',
        now,
      ]
    );

    if (Array.isArray(ingredients)) {
      for (const ing of ingredients) {
        if (ing.driver_name || ing.inventory_item_id || ing.driver_cost !== undefined) {
          const ingId = 'ing_' + Math.random().toString(36).substring(2, 9);
          run(
            `INSERT INTO menu_item_ingredients (id, menu_item_id, inventory_item_id, quantity_used, driver_name, driver_cost)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              ingId,
              id,
              ing.inventory_item_id || '',
              Number(ing.quantity_used || 1),
              ing.driver_name || '',
              Number(ing.driver_cost || 0),
            ]
          );
        }
      }
    }

    const created = get('SELECT * FROM menu_items WHERE id = ?', [id]);
    res.status(201).json({ ...created, is_available: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/items/:id', (req, res) => {
  try {
    const { category_id, name, description, price, cost, pantry_cost, labor_cost, allergens, image_url, is_available, ingredients } = req.body;
    const { id } = req.params;

    // In aggregate, the primary ingredient cost drivers equal the raw food cost
    let finalRawFoodCost = Number(cost || 0);
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      finalRawFoodCost = ingredients.reduce((sum: number, ing: any) => sum + Number(ing.driver_cost || 0), 0);
    }

    run(
      `UPDATE menu_items
       SET category_id = ?, name = ?, description = ?, price = ?, cost = ?, pantry_cost = ?, labor_cost = ?, allergens = ?, image_url = ?, is_available = ?
       WHERE id = ?`,
      [
        category_id,
        name,
        description || '',
        Number(price),
        Number(finalRawFoodCost),
        Number(pantry_cost || 0),
        Number(labor_cost || 0),
        allergens || '',
        image_url || '',
        is_available ? 1 : 0,
        id,
      ]
    );

    // Update ingredients and cost drivers
    if (Array.isArray(ingredients)) {
      run('DELETE FROM menu_item_ingredients WHERE menu_item_id = ?', [id]);
      for (const ing of ingredients) {
        if (ing.driver_name || ing.inventory_item_id || ing.driver_cost !== undefined) {
          const ingId = 'ing_' + Math.random().toString(36).substring(2, 9);
          run(
            `INSERT INTO menu_item_ingredients (id, menu_item_id, inventory_item_id, quantity_used, driver_name, driver_cost)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              ingId,
              id,
              ing.inventory_item_id || '',
              Number(ing.quantity_used || 1),
              ing.driver_name || '',
              Number(ing.driver_cost || 0),
            ]
          );
        }
      }
    }

    const updated = get('SELECT * FROM menu_items WHERE id = ?', [id]);
    res.json({ ...updated, is_available: Boolean(updated.is_available) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/items/:id/availability', (req, res) => {
  try {
    const { is_available } = req.body;
    run('UPDATE menu_items SET is_available = ? WHERE id = ?', [is_available ? 1 : 0, req.params.id]);
    res.json({ success: true, is_available });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:id', (req, res) => {
  try {
    run('DELETE FROM menu_item_ingredients WHERE menu_item_id = ?', [req.params.id]);
    run('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

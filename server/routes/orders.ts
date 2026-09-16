import { Router } from 'express';
import { query, run, get } from '../db.ts';

const router = Router();

// GET all orders (with filters: status, date, type)
router.get('/', (req, res) => {
  try {
    const { status, date, limit } = req.query;
    let sql = `
      SELECT o.*, s.name as server_name
      FROM orders o
      LEFT JOIN staff s ON o.server_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      if (status === 'open') {
        sql += ` AND o.status IN ('active', 'in_kitchen', 'ready', 'served')`;
      } else {
        sql += ` AND o.status = ?`;
        params.push(status);
      }
    }

    if (date) {
      sql += ` AND o.created_at LIKE ?`;
      params.push(`${date}%`);
    }

    sql += ` ORDER BY o.created_at DESC`;

    if (limit) {
      sql += ` LIMIT ?`;
      params.push(Number(limit));
    }

    const orders = query(sql, params);

    // Fetch items for each order
    const orderIds = orders.map((o: any) => `'${o.id}'`).join(',');
    let allItems: any[] = [];
    if (orderIds.length > 0) {
      allItems = query(`SELECT * FROM order_items WHERE order_id IN (${orderIds})`);
    }

    const result = orders.map((order: any) => ({
      ...order,
      items: allItems.filter((it: any) => it.order_id === order.id),
    }));

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET single order
router.get('/:id', (req, res) => {
  try {
    const order = get(`
      SELECT o.*, s.name as server_name
      FROM orders o
      LEFT JOIN staff s ON o.server_id = s.id
      WHERE o.id = ?
    `, [req.params.id]);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    const items = query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ ...order, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST create order
router.post('/', (req, res) => {
  try {
    const { order_type, table_number, guest_count, server_id, items } = req.body;

    // Generate order number
    const lastOrder = get('SELECT MAX(order_number) as max_num FROM orders');
    const orderNumber = ((lastOrder?.max_num || 100) + 1);

    const orderId = 'ord_' + Date.now();
    const now = new Date().toISOString();

    let subtotal = 0;
    const validatedItems: any[] = [];

    if (Array.isArray(items)) {
      for (const it of items) {
        const itemTotal = Number(it.unit_price) * Number(it.quantity);
        subtotal += itemTotal;
        validatedItems.push({
          id: 'oi_' + Math.random().toString(36).substring(2, 9),
          menu_item_id: it.menu_item_id,
          name: it.name,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          total_price: itemTotal,
          notes: it.notes || '',
          status: 'pending',
        });
      }
    }

    const TAX_RATE = 0.0825; // 8.25% standard tax
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    run(
      `INSERT INTO orders 
        (id, order_number, order_type, table_number, guest_count, server_id, status, subtotal, tax, tip, total, payment_status, payment_method, payment_notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, ?, 'unpaid', NULL, '', ?, ?)`,
      [
        orderId,
        orderNumber,
        order_type || 'dine_in',
        table_number || 'Takeout',
        Number(guest_count || 1),
        server_id || null,
        subtotal,
        tax,
        total,
        now,
        now,
      ]
    );

    for (const it of validatedItems) {
      run(
        `INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, total_price, notes, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [it.id, orderId, it.menu_item_id, it.name, it.quantity, it.unit_price, it.total_price, it.notes, it.status]
      );
    }

    const createdOrder = get(`
      SELECT o.*, s.name as server_name
      FROM orders o
      LEFT JOIN staff s ON o.server_id = s.id
      WHERE o.id = ?
    `, [orderId]);

    res.status(201).json({ ...createdOrder, items: validatedItems });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update order items or details
router.put('/:id', (req, res) => {
  try {
    const { order_type, table_number, guest_count, server_id, status, items } = req.body;
    const { id } = req.params;
    const now = new Date().toISOString();

    const existing = get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Order not found' });

    let subtotal = 0;
    if (Array.isArray(items)) {
      run('DELETE FROM order_items WHERE order_id = ?', [id]);
      for (const it of items) {
        const itemTotal = Number(it.unit_price) * Number(it.quantity);
        subtotal += itemTotal;
        const itemId = it.id || 'oi_' + Math.random().toString(36).substring(2, 9);
        run(
          `INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, total_price, notes, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [itemId, id, it.menu_item_id, it.name, Number(it.quantity), Number(it.unit_price), itemTotal, it.notes || '', it.status || 'pending']
        );
      }
    } else {
      subtotal = existing.subtotal;
    }

    const tax = Math.round(subtotal * 0.0825 * 100) / 100;
    const tip = existing.tip || 0;
    const total = Math.round((subtotal + tax + tip) * 100) / 100;

    run(
      `UPDATE orders 
       SET order_type = ?, table_number = ?, guest_count = ?, server_id = ?, status = ?, subtotal = ?, tax = ?, total = ?, updated_at = ?
       WHERE id = ?`,
      [
        order_type ?? existing.order_type,
        table_number ?? existing.table_number,
        Number(guest_count ?? existing.guest_count),
        server_id ?? existing.server_id,
        status ?? existing.status,
        subtotal,
        tax,
        total,
        now,
        id,
      ]
    );

    const updated = get(`
      SELECT o.*, s.name as server_name
      FROM orders o
      LEFT JOIN staff s ON o.server_id = s.id
      WHERE o.id = ?
    `, [id]);
    const updatedItems = query('SELECT * FROM order_items WHERE order_id = ?', [id]);

    res.json({ ...updated, items: updatedItems });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH order status (active -> in_kitchen -> ready -> served -> completed)
router.patch('/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const now = new Date().toISOString();
    run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [status, now, req.params.id]);

    // If order items exist and status is served or in_kitchen, update item statuses
    if (status === 'in_kitchen') {
      run("UPDATE order_items SET status = 'cooking' WHERE order_id = ? AND status = 'pending'", [req.params.id]);
    } else if (status === 'ready' || status === 'served') {
      run("UPDATE order_items SET status = 'served' WHERE order_id = ?", [req.params.id]);
    }

    const updated = get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST process payment: Cash or Standalone Card Terminal
router.post('/:id/pay', (req, res) => {
  try {
    const { payment_method, payment_notes, tip_amount, cash_tendered } = req.body;
    const { id } = req.params;

    if (!payment_method || !['cash', 'card_terminal'].includes(payment_method)) {
      return res.status(400).json({ error: 'Payment method must be cash or card_terminal' });
    }

    const order = get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const tip = Number(tip_amount || 0);
    const newTotal = Math.round((order.subtotal + order.tax + tip) * 100) / 100;
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    let fullNotes = payment_notes || '';
    if (payment_method === 'cash' && cash_tendered) {
      const tendered = Number(cash_tendered);
      const changeDue = Math.max(0, Math.round((tendered - newTotal) * 100) / 100);
      fullNotes = `Cash Tendered: $${tendered.toFixed(2)} | Change: $${changeDue.toFixed(2)}. ${fullNotes}`;
    }

    run(
      `UPDATE orders
       SET payment_status = 'paid', payment_method = ?, payment_notes = ?, tip = ?, total = ?, status = 'completed', paid_at = ?, updated_at = ?
       WHERE id = ?`,
      [payment_method, fullNotes, tip, newTotal, now, now, id]
    );

    // Record Tip if amount > 0
    if (tip > 0) {
      const tipId = 'tip_' + Date.now();
      const tipType = payment_method === 'card_terminal' ? 'card_terminal_tip' : 'cash_drop';
      run(
        `INSERT INTO tips (id, date, staff_id, order_id, amount, tip_type, distribution_method, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'direct', ?, ?)`,
        [tipId, todayStr, order.server_id || null, id, tip, tipType, `Tip from Order #${order.order_number} (${payment_method})`, now]
      );
    }

    // Auto-deplete inventory based on linked menu item ingredients
    try {
      const orderItems = query('SELECT * FROM order_items WHERE order_id = ?', [id]);
      for (const item of orderItems) {
        const ingredients = query('SELECT * FROM menu_item_ingredients WHERE menu_item_id = ?', [item.menu_item_id]);
        for (const ing of ingredients) {
          if (!ing.inventory_item_id) continue;
          const qtyToDeduct = Number(ing.quantity_used) * Number(item.quantity);
          run(
            'UPDATE inventory_items SET current_stock = MAX(0, current_stock - ?) WHERE id = ?',
            [qtyToDeduct, ing.inventory_item_id]
          );
          run(
            `INSERT INTO inventory_logs (id, inventory_item_id, change_amount, change_type, notes, created_at)
             VALUES (?, ?, ?, 'order_depletion', ?, ?)`,
            ['log_' + Math.random().toString(36).substring(2, 9), ing.inventory_item_id, -qtyToDeduct, `Depleted by Order #${order.order_number}`, now]
          );
        }
      }
    } catch (invErr) {
      console.error('Inventory depletion notice:', invErr);
    }

    const updated = get(`
      SELECT o.*, s.name as server_name
      FROM orders o
      LEFT JOIN staff s ON o.server_id = s.id
      WHERE o.id = ?
    `, [id]);
    const items = query('SELECT * FROM order_items WHERE order_id = ?', [id]);

    res.json({ ...updated, items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE order (or cancel)
router.delete('/:id', (req, res) => {
  try {
    run('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
    run('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

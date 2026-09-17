import initSqlJs, { Database, SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';

let dbInstance: Database | null = null;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'restaurant.db');

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(fileBuffer);
    } catch (err) {
      console.error('Error loading existing database file, creating fresh DB:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  saveDb();

  return dbInstance;
}

export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Error saving SQLite database to disk:', err);
  }
}

export function query<T = any>(sql: string, params: SqlValue[] = []): T[] {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  if (params.length > 0) {
    stmt.bind(params);
  }
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export function get<T = any>(sql: string, params: SqlValue[] = []): T | undefined {
  const rows = query<T>(sql, params);
  return rows.length > 0 ? rows[0] : undefined;
}

export function run(sql: string, params: SqlValue[] = []): { changes: number } {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  const changes = dbInstance.getRowsModified();
  saveDb();
  return { changes };
}

function initSchema(db: Database) {
  // Single-tenant tables: NO organization table and NO org_id foreign keys
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      cost REAL DEFAULT 0,
      pantry_cost REAL DEFAULT 0,
      labor_cost REAL DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      allergens TEXT DEFAULT '',
      image_url TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      min_threshold REAL NOT NULL DEFAULT 5,
      unit_cost REAL NOT NULL DEFAULT 0,
      supplier TEXT,
      last_restocked_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_item_ingredients (
      id TEXT PRIMARY KEY,
      menu_item_id TEXT NOT NULL,
      inventory_item_id TEXT DEFAULT '',
      quantity_used REAL NOT NULL DEFAULT 1,
      driver_name TEXT DEFAULT '',
      driver_cost REAL DEFAULT 0,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_logs (
      id TEXT PRIMARY KEY,
      inventory_item_id TEXT NOT NULL,
      change_amount REAL NOT NULL,
      change_type TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      hourly_rate REAL NOT NULL,
      pin TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      admin_access INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_shifts (
      id TEXT PRIMARY KEY,
      staff_id TEXT NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT,
      break_minutes INTEGER DEFAULT 0,
      total_hours REAL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open',
      notes TEXT,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tips (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      staff_id TEXT,
      order_id TEXT,
      amount REAL NOT NULL,
      tip_type TEXT NOT NULL,
      distribution_method TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number INTEGER NOT NULL,
      order_type TEXT NOT NULL,
      table_number TEXT,
      guest_count INTEGER DEFAULT 1,
      server_id TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      tip REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT,
      payment_notes TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (server_id) REFERENCES staff(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      guest_name TEXT NOT NULL,
      guest_phone TEXT,
      guest_email TEXT,
      party_size INTEGER NOT NULL,
      reservation_date TEXT NOT NULL,
      reservation_time TEXT NOT NULL,
      table_number TEXT,
      status TEXT NOT NULL DEFAULT 'confirmed',
      special_requests TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seating_locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0,
      description TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dining_tables (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      table_number TEXT NOT NULL,
      seats INTEGER NOT NULL DEFAULT 4,
      shape TEXT DEFAULT 'standard',
      is_active INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (location_id) REFERENCES seating_locations(id) ON DELETE CASCADE
    );
  `);

  // Ensure seating_locations and dining_tables are initialized if empty
  try {
    const locCount = db.exec('SELECT COUNT(*) as cnt FROM seating_locations');
    const hasLocs = locCount.length > 0 ? (locCount[0].values[0][0] as number) > 0 : false;
    if (!hasLocs) {
      const now = new Date().toISOString();
      // 1. Insert Locations
      db.run(`INSERT INTO seating_locations (id, name, display_order, description, created_at) VALUES
        ('loc_main', 'Main Dining Room', 1, 'Central dining room with booths and standard tables', '${now}'),
        ('loc_bar', 'Bar', 2, 'Cocktail bar counter stools and high-top perimeter tables', '${now}'),
        ('loc_patio', 'Patio', 3, 'Outdoor garden terrace with umbrella tables', '${now}');
      `);

      // 2. Insert Tables for each location with seat capacities
      db.run(`INSERT INTO dining_tables (id, location_id, table_number, seats, shape, is_active, display_order, created_at) VALUES
        ('tbl_1', 'loc_main', 'Table 1', 2, 'standard', 1, 1, '${now}'),
        ('tbl_2', 'loc_main', 'Table 2', 4, 'standard', 1, 2, '${now}'),
        ('tbl_3', 'loc_main', 'Table 3', 4, 'booth', 1, 3, '${now}'),
        ('tbl_4', 'loc_main', 'Table 4', 4, 'standard', 1, 4, '${now}'),
        ('tbl_5', 'loc_main', 'Table 5', 6, 'booth', 1, 5, '${now}'),
        ('tbl_6', 'loc_main', 'Table 6', 8, 'standard', 1, 6, '${now}'),
        ('tbl_7', 'loc_bar', 'Bar 1', 2, 'bar', 1, 1, '${now}'),
        ('tbl_8', 'loc_bar', 'Bar 2', 2, 'bar', 1, 2, '${now}'),
        ('tbl_9', 'loc_bar', 'Bar 3', 2, 'bar', 1, 3, '${now}'),
        ('tbl_10', 'loc_bar', 'High Top 1', 4, 'standard', 1, 4, '${now}'),
        ('tbl_11', 'loc_patio', 'Patio 1', 4, 'outdoor', 1, 1, '${now}'),
        ('tbl_12', 'loc_patio', 'Patio 2', 4, 'outdoor', 1, 2, '${now}'),
        ('tbl_13', 'loc_patio', 'Patio 3', 6, 'outdoor', 1, 3, '${now}');
      `);
      console.log('Seeded initial seating locations (Main Dining Room, Bar, Patio) and dining tables');
    }
  } catch (err) {
    console.error('Error initializing seating locations & dining tables:', err);
  }

  // Migrate pantry_cost and labor_cost columns if they do not exist yet
  try {
    const tableInfo = db.exec("PRAGMA table_info(menu_items)");
    if (tableInfo.length > 0) {
      const colNames = tableInfo[0].values.map((v: any) => v[1]);
      if (!colNames.includes('pantry_cost')) {
        db.run("ALTER TABLE menu_items ADD COLUMN pantry_cost REAL DEFAULT 0");
      }
      if (!colNames.includes('labor_cost')) {
        db.run("ALTER TABLE menu_items ADD COLUMN labor_cost REAL DEFAULT 0");
      }
    }
  } catch (err) {
    console.error('Migration error for menu_items costing columns:', err);
  }

  // Populate realistic baseline costing for pre-seeded items if they are currently 0
  try {
    db.run(`UPDATE menu_items SET pantry_cost = 0.65, labor_cost = 1.50 WHERE id = 'item_1' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 0.85, labor_cost = 1.75 WHERE id = 'item_2' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 1.20, labor_cost = 4.00 WHERE id = 'item_3' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 1.10, labor_cost = 3.50 WHERE id = 'item_4' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 0.75, labor_cost = 3.25 WHERE id = 'item_5' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 0.80, labor_cost = 2.50 WHERE id = 'item_6' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 0.50, labor_cost = 1.20 WHERE id = 'item_7' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 0.45, labor_cost = 1.10 WHERE id = 'item_8' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 0.40, labor_cost = 1.80 WHERE id = 'item_9' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 0.50, labor_cost = 2.00 WHERE id = 'item_10' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 0.15, labor_cost = 0.80 WHERE id = 'item_11' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
    db.run(`UPDATE menu_items SET pantry_cost = 0.25, labor_cost = 0.75 WHERE id = 'item_12' AND (pantry_cost = 0 OR pantry_cost IS NULL)`);
  } catch (err) {
    console.error('Error seeding baseline costing:', err);
  }

  // Migrate menu_item_ingredients columns if they do not exist
  try {
    const miiInfo = db.exec("PRAGMA table_info(menu_item_ingredients)");
    if (miiInfo.length > 0) {
      const colNames = miiInfo[0].values.map((v: any) => v[1]);
      if (!colNames.includes('driver_name')) {
        db.run("ALTER TABLE menu_item_ingredients ADD COLUMN driver_name TEXT DEFAULT ''");
      }
      if (!colNames.includes('driver_cost')) {
        db.run("ALTER TABLE menu_item_ingredients ADD COLUMN driver_cost REAL DEFAULT 0");
      }
    }
  } catch (err) {
    console.error('Migration error for menu_item_ingredients:', err);
  }

  // Seed baseline major cost drivers for menu items if table is empty
  try {
    const ingCount = db.exec('SELECT COUNT(*) as cnt FROM menu_item_ingredients');
    const hasIngs = ingCount.length > 0 ? (ingCount[0].values[0][0] as number) > 0 : false;
    if (!hasIngs) {
      db.run(`INSERT INTO menu_item_ingredients (id, menu_item_id, inventory_item_id, quantity_used, driver_name, driver_cost) VALUES
        ('mii_1', 'item_1', 'inv_3', 1, 'Organic Burrata Cheese', 3.10),
        ('mii_2', 'item_1', 'inv_4', 0.5, 'Heirloom Vine Tomatoes', 1.10),
        ('mii_3', 'item_2', '', 1, 'Tender Calamari Rings & Tentacles', 3.80),
        ('mii_4', 'item_3', 'inv_1', 1, 'Prime Ribeye Steak (12oz Cut)', 14.50),
        ('mii_5', 'item_4', 'inv_2', 1, 'Fresh Atlantic Salmon Fillet', 9.20),
        ('mii_6', 'item_4', '', 1, 'Braised Leeks & Citrus Micro Greens', 0.60),
        ('mii_7', 'item_5', 'inv_5', 0.75, 'Fresh Tagliatelle Pasta', 2.10),
        ('mii_8', 'item_5', 'inv_7', 0.2, 'Aged Grana Padano Parmesan', 1.70),
        ('mii_9', 'item_5', 'inv_6', 0.08, 'Black Truffle Oil Drizzle', 2.30),
        ('mii_10', 'item_6', '', 1, 'Slow-Simmered Beef & Pork Ragù', 3.80),
        ('mii_11', 'item_6', 'inv_7', 0.2, 'Artisan Rigatoni & Grated Parmesan', 1.70),
        ('mii_12', 'item_7', '', 1, 'Hand-Cut Russet Potatoes', 1.20),
        ('mii_13', 'item_7', 'inv_7', 0.1, 'Parmesan & Truffle Essence', 1.00),
        ('mii_14', 'item_8', '', 1, 'Fresh Broccolini & Toasted Almonds', 2.00),
        ('mii_15', 'item_9', 'inv_10', 0.1, 'Dark Roast Espresso Extract', 1.20),
        ('mii_16', 'item_9', '', 1, 'Mascarpone Cream & Savoiardi', 1.80),
        ('mii_17', 'item_10', 'inv_9', 0.25, 'Madagascar Vanilla Bean Gelato', 1.85),
        ('mii_18', 'item_10', '', 1, 'Warm Dark Molten Chocolate Core', 1.65),
        ('mii_19', 'item_11', 'inv_11', 0.25, 'Chianti Classico DOCG (6oz)', 2.88),
        ('mii_20', 'item_11', '', 1, 'Cellar Reserve Service Allocation', 0.32),
        ('mii_21', 'item_12', 'inv_12', 0.33, 'San Pellegrino Sparkling Base', 0.60),
        ('mii_22', 'item_12', '', 1, 'Blood Orange Puree & Mint', 0.60);
      `);
    }
  } catch (err) {
    console.error('Error seeding baseline ingredients:', err);
  }

  // Ensure inventory_categories table has initial categories
  try {
    const invCatCount = db.exec('SELECT COUNT(*) as cnt FROM inventory_categories');
    const hasInvCats = invCatCount.length > 0 ? (invCatCount[0].values[0][0] as number) > 0 : false;
    if (!hasInvCats) {
      const now = new Date().toISOString();
      const initialCats = ['Produce', 'Meat', 'Seafood', 'Dairy', 'Pantry', 'Frozen', 'Beverage'];
      initialCats.forEach((name, idx) => {
        db.run(
          'INSERT OR IGNORE INTO inventory_categories (id, name, display_order, created_at) VALUES (?, ?, ?, ?)',
          [`inv_cat_${idx + 1}`, name, idx + 1, now]
        );
      });
      // Also ensure any existing distinct category from inventory_items is captured
      const distinctItems = db.exec('SELECT DISTINCT category FROM inventory_items');
      if (distinctItems.length > 0 && distinctItems[0].values.length > 0) {
        distinctItems[0].values.forEach((row: any, i: number) => {
          const catName = row[0] as string;
          if (catName && !initialCats.includes(catName)) {
            db.run(
              'INSERT OR IGNORE INTO inventory_categories (id, name, display_order, created_at) VALUES (?, ?, ?, ?)',
              [`inv_cat_extra_${i + 1}`, catName, initialCats.length + i + 1, now]
            );
          }
        });
      }
    }
  } catch (err) {
    console.error('Error initializing inventory_categories:', err);
  }

  // Migrate staff table: rename/add title and add admin_access column if needed
  try {
    const staffInfo = db.exec("PRAGMA table_info(staff)");
    if (staffInfo.length > 0) {
      const colNames = staffInfo[0].values.map((v: any) => v[1]);
      if (colNames.includes('role') && !colNames.includes('title')) {
        db.run("ALTER TABLE staff RENAME COLUMN role TO title;");
      } else if (!colNames.includes('title')) {
        db.run("ALTER TABLE staff ADD COLUMN title TEXT DEFAULT 'staff';");
        if (colNames.includes('role')) {
          db.run("UPDATE staff SET title = role WHERE role IS NOT NULL;");
        }
      }
      if (!colNames.includes('admin_access')) {
        db.run("ALTER TABLE staff ADD COLUMN admin_access INTEGER DEFAULT 0;");
        db.run("UPDATE staff SET admin_access = 1 WHERE title = 'manager' OR id = 'staff_6';");
      }
    }
  } catch (err) {
    console.error('Migration error for staff columns:', err);
  }

  // Check if we need to seed
  const categoriesCount = db.exec('SELECT COUNT(*) as cnt FROM menu_categories');
  const count = categoriesCount.length > 0 ? categoriesCount[0].values[0][0] as number : 0;
  if (count === 0) {
    seedData(db);
  }
}

function seedData(db: Database) {
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];

  // 1. Menu Categories
  db.run(`INSERT INTO menu_categories (id, name, display_order, created_at) VALUES
    ('cat_1', 'Appetizers & Starters', 1, '${now}'),
    ('cat_2', 'Artisan Mains & Steaks', 2, '${now}'),
    ('cat_3', 'Handcrafted Pastas', 3, '${now}'),
    ('cat_4', 'Sides & Salads', 4, '${now}'),
    ('cat_5', 'Desserts', 5, '${now}'),
    ('cat_6', 'Craft Beverages & Wine', 6, '${now}');
  `);

  // 2. Inventory Items
  db.run(`INSERT INTO inventory_items (id, name, category, unit, current_stock, min_threshold, unit_cost, supplier, updated_at) VALUES
    ('inv_1', 'Prime Ribeye Steaks (12oz)', 'Meat', 'cuts', 18, 10, 14.50, 'Valley Prime Meats', '${now}'),
    ('inv_2', 'Fresh Atlantic Salmon Fillets', 'Seafood', 'lbs', 14.5, 8, 9.20, 'Coastal Catch Seafood', '${now}'),
    ('inv_3', 'Organic Burrata Cheese', 'Dairy', 'balls', 24, 8, 3.10, 'Artisan Dairy Co.', '${now}'),
    ('inv_4', 'Heirloom Vine Tomatoes', 'Produce', 'lbs', 32, 15, 2.20, 'Green Valley Farm', '${now}'),
    ('inv_5', 'Fresh Tagliatelle Pasta', 'Pantry', 'lbs', 22, 10, 2.80, 'Pasta Fresca', '${now}'),
    ('inv_6', 'Black Truffle Oil', 'Pantry', 'bottles', 4, 2, 28.00, 'Gourmet Imports', '${now}'),
    ('inv_7', 'Grana Padano Parmesan', 'Dairy', 'lbs', 12, 5, 8.50, 'Euro Imports', '${now}'),
    ('inv_8', 'Fresh Basil Leaves', 'Produce', 'bunches', 15, 6, 1.25, 'Green Valley Farm', '${now}'),
    ('inv_9', 'Madagascar Vanilla Bean Gelato', 'Frozen', 'quarts', 8, 4, 7.50, 'Sweet Alpine Creamery', '${now}'),
    ('inv_10', 'Espresso Beans (Dark Roast)', 'Beverage', 'lbs', 16, 5, 12.00, 'Summit Roasters', '${now}'),
    ('inv_11', 'Chianti Classico Red Wine', 'Beverage', 'bottles', 28, 12, 11.50, 'Tuscany Cellars', '${now}'),
    ('inv_12', 'San Pellegrino Sparkling (750ml)', 'Beverage', 'bottles', 42, 20, 1.80, 'Beverage Depot', '${now}');
  `);

  // 3. Menu Items
  db.run(`INSERT INTO menu_items (id, category_id, name, description, price, cost, pantry_cost, labor_cost, is_available, allergens, image_url, created_at) VALUES
    ('item_1', 'cat_1', 'Truffle Burrata Bruschetta', 'Toasted sourdough with creamy burrata, heirloom tomatoes, fresh basil, and white truffle glaze', 16.50, 4.20, 0.65, 1.50, 1, 'Dairy, Gluten', 'https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_2', 'cat_1', 'Crisp Calamari Fritti', 'Tender calamari rings with lemon herb aioli and roasted garlic marinara', 15.00, 3.80, 0.85, 1.75, 1, 'Seafood, Gluten, Eggs', 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_3', 'cat_2', 'Prime Grilled Ribeye (12oz)', 'Charred rosemary butter, roasted garlic shallot demi-glace, and sea salt', 39.00, 14.50, 1.20, 4.00, 1, 'Dairy', 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_4', 'cat_2', 'Pan-Seared Atlantic Salmon', 'Crisp skin salmon over braised leeks, citrus beurre blanc, and micro greens', 31.00, 9.80, 1.10, 3.50, 1, 'Fish, Dairy', 'https://images.unsplash.com/photo-1485921325833-c519f76c4927?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_5', 'cat_3', 'Handmade Tagliatelle al Tartufo', 'Fresh egg pasta tossed with black truffle butter, forest mushrooms, and aged Grana Padano', 26.50, 6.10, 0.75, 3.25, 1, 'Dairy, Gluten, Eggs', 'https://images.unsplash.com/photo-1621996346565-e3d5d6281292?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_6', 'cat_3', 'Rustic Rigatoni Bolognese', 'Slow-simmered beef, pork, San Marzano tomatoes, and freshly grated parmesan', 24.00, 5.50, 0.80, 2.50, 1, 'Gluten, Dairy', 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_7', 'cat_4', 'Truffle Parmesan Fries', 'Hand-cut russet potatoes, white truffle oil, shaved parmesan, and parsley aioli', 11.00, 2.20, 0.50, 1.20, 1, 'Dairy, Eggs', 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_8', 'cat_4', 'Charred Broccolini', 'Garlic chili oil, toasted almonds, and lemon zest', 10.50, 2.00, 0.45, 1.10, 1, 'Tree Nuts', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_9', 'cat_5', 'Classic Espresso Tiramisu', 'Savoiardi ladyfingers, mascarpone cream, dark espresso, and Dutch cocoa powder', 12.00, 3.00, 0.40, 1.80, 1, 'Dairy, Gluten, Eggs', 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_10', 'cat_5', 'Molten Dark Chocolate Cake', 'Warm chocolate center with vanilla bean gelato and raspberry coulis', 13.50, 3.50, 0.50, 2.00, 1, 'Dairy, Gluten, Eggs', 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&auto=format&fit=crop&q=80', '${now}'),
    ('item_11', 'cat_6', 'Chianti Classico (Glass)', 'Tuscan red with notes of dark cherry, cedar, and dried herbs', 14.00, 3.20, 0.15, 0.80, 1, 'Sulfites', '', '${now}'),
    ('item_12', 'cat_6', 'Sparkling Blood Orange Soda', 'Fresh pressed Sicilian blood orange juice, sparkling mineral water, mint', 6.50, 1.20, 0.25, 0.75, 1, '', '', '${now}');
  `);

  // 4. Staff members
  db.run(`INSERT INTO staff (id, name, title, hourly_rate, pin, is_active, admin_access, created_at) VALUES
    ('staff_1', 'Elena Vasquez', 'server', 16.50, '1234', 1, 0, '${now}'),
    ('staff_2', 'Marcus Chen', 'server', 16.50, '2345', 1, 0, '${now}'),
    ('staff_3', 'Dave Miller', 'bartender', 18.00, '3456', 1, 0, '${now}'),
    ('staff_4', 'Chef Antonio Rossi', 'head_chef', 28.00, '4567', 1, 0, '${now}'),
    ('staff_5', 'Sarah Jenkins', 'host', 16.00, '5678', 1, 0, '${now}'),
    ('staff_6', 'Liam O''Connor', 'manager', 26.00, '9999', 1, 1, '${now}');
  `);

  // 5. Active and past shifts for Staff
  const clockIn1 = `${todayStr}T11:00:00.000Z`;
  const clockIn2 = `${todayStr}T11:30:00.000Z`;
  const clockIn3 = `${todayStr}T12:00:00.000Z`;
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  db.run(`INSERT INTO time_shifts (id, staff_id, clock_in, clock_out, break_minutes, total_hours, status, notes) VALUES
    ('shift_1', 'staff_1', '${clockIn1}', NULL, 0, 0, 'open', 'Lunch floor shift'),
    ('shift_2', 'staff_2', '${clockIn2}', NULL, 0, 0, 'open', 'Patio & Section B'),
    ('shift_3', 'staff_4', '${clockIn3}', NULL, 0, 0, 'open', 'Kitchen prep & line'),
    ('shift_past_1', 'staff_1', '${yesterdayStr}T11:00:00.000Z', '${yesterdayStr}T17:30:00.000Z', 30, 6.0, 'completed', 'Completed evening dinner service'),
    ('shift_past_2', 'staff_2', '${yesterdayStr}T11:30:00.000Z', '${yesterdayStr}T18:00:00.000Z', 30, 6.0, 'completed', 'Completed floor shift'),
    ('shift_past_3', 'staff_3', '${yesterdayStr}T16:00:00.000Z', '${yesterdayStr}T23:00:00.000Z', 45, 6.25, 'completed', 'Bar evening rush');
  `);

  // 6. Tips for Staff
  db.run(`INSERT INTO tips (id, date, staff_id, order_id, amount, tip_type, distribution_method, notes, created_at) VALUES
    ('tip_1', '${yesterdayStr}', 'staff_1', 'ord_comp_1', 42.00, 'card_terminal_tip', 'direct', 'Dinner section card tip', '${yesterdayStr}T20:00:00.000Z'),
    ('tip_2', '${yesterdayStr}', 'staff_2', 'ord_comp_2', 38.50, 'card_terminal_tip', 'direct', 'Patio service card tip', '${yesterdayStr}T20:30:00.000Z'),
    ('tip_3', '${yesterdayStr}', 'staff_3', NULL, 65.00, 'cash_drop', 'direct', 'Bar cash jar tip drop', '${yesterdayStr}T23:00:00.000Z'),
    ('tip_4', '${todayStr}', 'staff_1', NULL, 25.00, 'cash_drop', 'direct', 'Lunch cash tips', '${now}');
  `);

  // 7. Orders (Active & Completed sales)
  db.run(`INSERT INTO orders (id, order_number, order_type, table_number, guest_count, server_id, status, subtotal, tax, tip, total, payment_status, payment_method, payment_notes, paid_at, created_at, updated_at) VALUES
    ('ord_active_1', 101, 'dine_in', 'Table 4', 2, 'staff_1', 'active', 76.50, 6.31, 0, 82.81, 'unpaid', NULL, NULL, NULL, '${now}', '${now}'),
    ('ord_active_2', 102, 'dine_in', 'Table 8', 4, 'staff_2', 'in_kitchen', 123.00, 10.15, 0, 133.15, 'unpaid', NULL, NULL, NULL, '${now}', '${now}'),
    ('ord_comp_1', 99, 'dine_in', 'Table 2', 2, 'staff_1', 'completed', 82.00, 6.77, 18.00, 106.77, 'paid', 'card_terminal', 'Station 1 - Terminal Ref: #9812 - Card Auth OK', '${now}', '${now}', '${now}'),
    ('ord_comp_2', 100, 'takeout', 'Takeout #1', 1, 'staff_1', 'completed', 38.50, 3.18, 5.00, 46.68, 'paid', 'cash', 'Cash Tendered: $50.00 - Change Given: $3.32', '${now}', '${now}', '${now}');
  `);

  // Order items
  db.run(`INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, unit_price, total_price, notes, status) VALUES
    ('oi_1', 'ord_active_1', 'item_1', 'Truffle Burrata Bruschetta', 1, 16.50, 16.50, 'Extra balsamic glaze', 'served'),
    ('oi_2', 'ord_active_1', 'item_3', 'Prime Grilled Ribeye (12oz)', 1, 39.00, 39.00, 'Medium rare, rosemary butter on side', 'cooking'),
    ('oi_3', 'ord_active_1', 'item_6', 'Rustic Rigatoni Bolognese', 1, 24.00, 24.00, 'Extra parmesan', 'cooking'),
    ('oi_4', 'ord_active_2', 'item_2', 'Crisp Calamari Fritti', 2, 15.00, 30.00, 'Light lemon aioli', 'cooking'),
    ('oi_5', 'ord_active_2', 'item_4', 'Pan-Seared Atlantic Salmon', 2, 31.00, 62.00, 'Citrus reduction', 'pending'),
    ('oi_6', 'ord_active_2', 'item_5', 'Handmade Tagliatelle al Tartufo', 1, 26.50, 26.50, 'Fresh ground pepper', 'pending'),
    ('oi_7', 'ord_active_2', 'item_8', 'Charred Broccolini', 1, 10.50, 10.50, 'No almonds (allergy alert)', 'pending');
  `);

  // 8. Reservations
  db.run(`INSERT INTO reservations (id, guest_name, guest_phone, guest_email, party_size, reservation_date, reservation_time, table_number, status, special_requests, created_at) VALUES
    ('res_1', 'Sophia Montgomery', '(555) 234-5678', 'sophia.m@example.com', 4, '${todayStr}', '18:30', 'Table 6', 'confirmed', 'Celebrating anniversary, quiet booth preferred', '${now}'),
    ('res_2', 'Dr. Julian Thorne', '(555) 876-5432', 'jthorne@clinic.org', 2, '${todayStr}', '19:00', 'Table 3', 'confirmed', 'Window table if available', '${now}'),
    ('res_3', 'Lucas & Emma Vance', '(555) 432-1098', 'vance.l@domain.com', 6, '${todayStr}', '20:15', 'Table 10', 'confirmed', 'High chair needed for 1 infant', '${now}'),
    ('res_4', 'Rachel Kim', '(555) 901-2345', 'rkim@techfirm.co', 3, '${todayStr}', '12:30', 'Table 4', 'seated', 'Business lunch, separate receipts', '${now}');
  `);

  // 9. Initial Inventory Logs
  db.run(`INSERT INTO inventory_logs (id, inventory_item_id, change_amount, change_type, notes, created_at) VALUES
    ('log_1', 'inv_1', 20, 'restock', 'Weekly butcher delivery received', '${now}'),
    ('log_2', 'inv_2', 15, 'restock', 'Fresh catch delivery', '${now}'),
    ('log_3', 'inv_1', -2, 'order_depletion', 'Kitchen prep shift 101/102', '${now}');
  `);
}

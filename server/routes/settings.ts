import { Router, Request, Response } from 'express';
import { getBusinessProfile, updateBusinessProfile, resetAndSeedDatabase, query } from '../db.ts';

const router = Router();

// GET /api/settings/profile
router.get('/profile', (req: Request, res: Response) => {
  try {
    const profile = getBusinessProfile();
    res.json(profile);
  } catch (err: any) {
    console.error('Error fetching business profile:', err);
    res.status(500).json({ error: 'Failed to fetch business profile' });
  }
});

// PUT /api/settings/profile
router.put('/profile', (req: Request, res: Response) => {
  try {
    const updated = updateBusinessProfile(req.body);
    res.json(updated);
  } catch (err: any) {
    console.error('Error updating business profile:', err);
    res.status(500).json({ error: 'Failed to update business profile' });
  }
});

// GET /api/settings/status - Quick summary of current DB state
router.get('/status', (req: Request, res: Response) => {
  try {
    const profile = getBusinessProfile();
    const menuCount = query<{ count: number }>('SELECT COUNT(*) as count FROM menu_items')[0]?.count || 0;
    const categoryCount = query<{ count: number }>('SELECT COUNT(*) as count FROM menu_categories')[0]?.count || 0;
    const staffCount = query<{ count: number }>('SELECT COUNT(*) as count FROM staff')[0]?.count || 0;
    const orderCount = query<{ count: number }>('SELECT COUNT(*) as count FROM orders')[0]?.count || 0;
    const tableCount = query<{ count: number }>('SELECT COUNT(*) as count FROM dining_tables')[0]?.count || 0;
    const inventoryCount = query<{ count: number }>('SELECT COUNT(*) as count FROM inventory_items')[0]?.count || 0;

    res.json({
      profile,
      database_mode: profile?.database_mode || 'demo',
      counts: {
        menuItems: menuCount,
        menuCategories: categoryCount,
        staff: staffCount,
        orders: orderCount,
        tables: tableCount,
        inventoryItems: inventoryCount,
      },
    });
  } catch (err: any) {
    console.error('Error getting database status:', err);
    res.status(500).json({ error: 'Failed to get database status' });
  }
});

// POST /api/settings/reinitialize - Re-seed as demo or minimal operational
router.post('/reinitialize', (req: Request, res: Response) => {
  try {
    const { mode, branding, adminUser } = req.body;

    if (mode !== 'demo' && mode !== 'minimal') {
      res.status(400).json({ error: 'Invalid mode: must be "demo" or "minimal"' });
      return;
    }

    const updatedProfile = resetAndSeedDatabase({
      mode,
      branding,
      adminUser,
    });

    res.json({
      success: true,
      mode,
      profile: updatedProfile,
      message:
        mode === 'demo'
          ? 'Full demo database seeded successfully with sample menu, orders, staff, and tables.'
          : 'Minimal operational database initialized successfully. Ready for live operations.',
    });
  } catch (err: any) {
    console.error('Error reinitializing database:', err);
    res.status(500).json({ error: 'Failed to reinitialize database' });
  }
});

export default router;

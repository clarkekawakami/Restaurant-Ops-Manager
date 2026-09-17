import {
  MenuItem,
  MenuCategory,
  InventoryCategory,
  InventoryItem,
  InventoryLog,
  StaffMember,
  TimeShift,
  TipRecord,
  PayrollSummaryRow,
  Order,
  Reservation,
  DashboardStats,
  SeatingLocation,
  DiningTable,
  SeatingPlanOverview,
} from '../types.ts';

const jsonHeaders = { 'Content-Type': 'application/json' };

export const api = {
  // Stats
  getDashboardStats: async (): Promise<DashboardStats & { cashSales: number; cardSales: number; lowStockCount: number }> => {
    const res = await fetch('/api/stats/dashboard');
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },
  getStats: async (): Promise<DashboardStats & { cashSales: number; cardSales: number; lowStockCount: number }> => {
    const res = await fetch('/api/stats/dashboard');
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  // Menu
  getCategories: async (): Promise<MenuCategory[]> => {
    const res = await fetch('/api/menu/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },
  createCategory: async (data: { name: string; display_order?: number }): Promise<MenuCategory> => {
    const res = await fetch('/api/menu/categories', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create category');
    return res.json();
  },
  deleteCategory: async (id: string): Promise<void> => {
    const res = await fetch(`/api/menu/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete category');
  },
  getMenuItems: async (): Promise<MenuItem[]> => {
    const res = await fetch('/api/menu/items');
    if (!res.ok) throw new Error('Failed to fetch menu items');
    return res.json();
  },
  createMenuItem: async (data: Partial<MenuItem> & { ingredients?: any[] }): Promise<MenuItem> => {
    const res = await fetch('/api/menu/items', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create menu item');
    return res.json();
  },
  updateMenuItem: async (id: string, data: Partial<MenuItem> & { ingredients?: any[] }): Promise<MenuItem> => {
    const res = await fetch(`/api/menu/items/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update menu item');
    return res.json();
  },
  toggleMenuItemAvailability: async (id: string, is_available: boolean): Promise<void> => {
    const res = await fetch(`/api/menu/items/${id}/availability`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ is_available }),
    });
    if (!res.ok) throw new Error('Failed to update availability');
  },
  deleteMenuItem: async (id: string): Promise<void> => {
    const res = await fetch(`/api/menu/items/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete menu item');
  },

  // Inventory
  getInventoryCategories: async (): Promise<InventoryCategory[]> => {
    const res = await fetch('/api/inventory/categories');
    if (!res.ok) throw new Error('Failed to fetch inventory categories');
    return res.json();
  },
  createInventoryCategory: async (data: { name: string; display_order?: number }): Promise<InventoryCategory> => {
    const res = await fetch('/api/inventory/categories', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to create inventory category');
    }
    return res.json();
  },
  updateInventoryCategory: async (id: string, data: { name: string; display_order?: number }): Promise<InventoryCategory> => {
    const res = await fetch(`/api/inventory/categories/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to update inventory category');
    }
    return res.json();
  },
  deleteInventoryCategory: async (id: string): Promise<void> => {
    const res = await fetch(`/api/inventory/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete inventory category');
  },
  getInventory: async (): Promise<InventoryItem[]> => {
    const res = await fetch('/api/inventory');
    if (!res.ok) throw new Error('Failed to fetch inventory');
    return res.json();
  },
  createInventoryItem: async (data: Partial<InventoryItem>): Promise<InventoryItem> => {
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create inventory item');
    return res.json();
  },
  updateInventoryItem: async (id: string, data: Partial<InventoryItem>): Promise<InventoryItem> => {
    const res = await fetch(`/api/inventory/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update inventory item');
    return res.json();
  },
  adjustStock: async (id: string, change_amount: number, change_type: string, notes?: string): Promise<InventoryItem> => {
    const res = await fetch(`/api/inventory/${id}/adjust`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ change_amount, change_type, notes }),
    });
    if (!res.ok) throw new Error('Failed to adjust stock');
    return res.json();
  },
  getInventoryLogs: async (): Promise<InventoryLog[]> => {
    const res = await fetch('/api/inventory/logs');
    if (!res.ok) throw new Error('Failed to fetch inventory logs');
    return res.json();
  },
  deleteInventoryItem: async (id: string): Promise<void> => {
    const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete inventory item');
  },

  // Orders
  getOrders: async (params?: { status?: string; date?: string; limit?: number }): Promise<Order[]> => {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/api/orders?${query}`);
    if (!res.ok) throw new Error('Failed to fetch orders');
    return res.json();
  },
  getOrder: async (id: string): Promise<Order> => {
    const res = await fetch(`/api/orders/${id}`);
    if (!res.ok) throw new Error('Failed to fetch order');
    return res.json();
  },
  createOrder: async (data: {
    order_type: string;
    table_number: string;
    guest_count: number;
    server_id?: string | null;
    items: Array<{ menu_item_id: string; name: string; quantity: number; unit_price: number; notes?: string }>;
  }): Promise<Order> => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create order');
    return res.json();
  },
  updateOrderStatus: async (id: string, status: string): Promise<Order> => {
    const res = await fetch(`/api/orders/${id}/status`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update order status');
    return res.json();
  },
  payOrder: async (
    id: string,
    data: {
      payment_method: 'cash' | 'card_terminal';
      payment_notes?: string;
      tip_amount?: number;
      cash_tendered?: number;
    }
  ): Promise<Order> => {
    const res = await fetch(`/api/orders/${id}/pay`, {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to process payment');
    }
    return res.json();
  },
  deleteOrder: async (id: string): Promise<void> => {
    const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete order');
  },

  // Staff & Shifts
  getStaff: async (): Promise<StaffMember[]> => {
    const res = await fetch('/api/staff');
    if (!res.ok) throw new Error('Failed to fetch staff');
    return res.json();
  },
  createStaff: async (data: { name: string; title: string; role?: string; hourly_rate: number; pin: string; admin_access?: boolean }): Promise<StaffMember> => {
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add staff member');
    return res.json();
  },
  updateStaff: async (id: string, data: Partial<StaffMember>): Promise<StaffMember> => {
    const res = await fetch(`/api/staff/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update staff member');
    return res.json();
  },
  verifyAdmin: async (staff_id: string, pin: string): Promise<{ success: boolean; staff: StaffMember }> => {
    const res = await fetch('/api/staff/verify-admin', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ staff_id, pin }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to verify admin credentials');
    }
    return res.json();
  },
  clockIn: async (staff_id: string, pin?: string, notes?: string): Promise<TimeShift> => {
    const res = await fetch('/api/staff/clock-in', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify({ staff_id, pin, notes }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to clock in');
    }
    return res.json();
  },
  clockOut: async (data: { shift_id?: string; staff_id?: string; break_minutes?: number; notes?: string }): Promise<TimeShift> => {
    const res = await fetch('/api/staff/clock-out', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to clock out');
    }
    return res.json();
  },
  getShifts: async (params?: { status?: string; staff_id?: string; from_date?: string; to_date?: string }): Promise<TimeShift[]> => {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/api/staff/shifts?${query}`);
    if (!res.ok) throw new Error('Failed to fetch shifts');
    return res.json();
  },
  createManualShift: async (data: {
    staff_id: string;
    clock_in: string;
    clock_out: string;
    break_minutes?: number;
    notes?: string;
  }): Promise<TimeShift> => {
    const res = await fetch('/api/staff/shifts/manual', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to add manual shift');
    return res.json();
  },
  updateShift: async (id: string, data: Partial<TimeShift>): Promise<TimeShift> => {
    const res = await fetch(`/api/staff/shifts/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update shift');
    return res.json();
  },
  deleteShift: async (id: string): Promise<void> => {
    const res = await fetch(`/api/staff/shifts/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete shift');
  },

  // Tips & Payroll
  getTips: async (params?: { from_date?: string; to_date?: string; staff_id?: string }): Promise<TipRecord[]> => {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/api/tips?${query}`);
    if (!res.ok) throw new Error('Failed to fetch tips');
    return res.json();
  },
  createTip: async (data: Partial<TipRecord>): Promise<TipRecord> => {
    const res = await fetch('/api/tips', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to record tip');
    return res.json();
  },
  distributeTipPool: async (data: {
    date?: string;
    pool_amount: number;
    notes?: string;
    eligible_roles?: string[];
  }): Promise<any> => {
    const res = await fetch('/api/tips/distribute-pool', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to distribute tip pool');
    }
    return res.json();
  },
  getPayrollSummary: async (from_date?: string, to_date?: string): Promise<PayrollSummaryRow[]> => {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    const res = await fetch(`/api/tips/payroll-summary?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch payroll summary');
    return res.json();
  },
  getPayrollCsvUrl: (from_date?: string, to_date?: string): string => {
    const params = new URLSearchParams();
    if (from_date) params.append('from_date', from_date);
    if (to_date) params.append('to_date', to_date);
    return `/api/tips/payroll-csv?${params.toString()}`;
  },

  // Reservations
  getReservations: async (params?: { date?: string; status?: string }): Promise<Reservation[]> => {
    const query = new URLSearchParams(params as any).toString();
    const res = await fetch(`/api/reservations?${query}`);
    if (!res.ok) throw new Error('Failed to fetch reservations');
    return res.json();
  },
  createReservation: async (data: Partial<Reservation>): Promise<Reservation> => {
    const res = await fetch('/api/reservations', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create reservation');
    }
    return res.json();
  },
  updateReservation: async (id: string, data: Partial<Reservation>): Promise<Reservation> => {
    const res = await fetch(`/api/reservations/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update reservation');
    return res.json();
  },
  updateReservationStatus: async (id: string, status: string): Promise<Reservation> => {
    const res = await fetch(`/api/reservations/${id}/status`, {
      method: 'PATCH',
      headers: jsonHeaders,
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update reservation status');
    return res.json();
  },
  deleteReservation: async (id: string): Promise<void> => {
    const res = await fetch(`/api/reservations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete reservation');
  },

  // Seating & Floor Plan
  getSeatingLocations: async (): Promise<SeatingLocation[]> => {
    const res = await fetch('/api/seating/locations');
    if (!res.ok) throw new Error('Failed to fetch seating locations');
    return res.json();
  },
  createSeatingLocation: async (data: { name: string; display_order?: number; description?: string }): Promise<SeatingLocation> => {
    const res = await fetch('/api/seating/locations', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create seating location');
    }
    return res.json();
  },
  updateSeatingLocation: async (id: string, data: { name?: string; display_order?: number; description?: string }): Promise<SeatingLocation> => {
    const res = await fetch(`/api/seating/locations/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update seating location');
    }
    return res.json();
  },
  deleteSeatingLocation: async (id: string): Promise<void> => {
    const res = await fetch(`/api/seating/locations/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete seating location');
    }
  },

  getDiningTables: async (locationId?: string): Promise<DiningTable[]> => {
    const url = locationId ? `/api/seating/tables?location_id=${encodeURIComponent(locationId)}` : '/api/seating/tables';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch dining tables');
    return res.json();
  },
  createDiningTable: async (data: {
    location_id: string;
    table_number: string;
    seats: number;
    shape?: string;
    is_active?: boolean | number;
    display_order?: number;
  }): Promise<DiningTable> => {
    const res = await fetch('/api/seating/tables', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create dining table');
    }
    return res.json();
  },
  updateDiningTable: async (
    id: string,
    data: {
      location_id?: string;
      table_number?: string;
      seats?: number;
      shape?: string;
      is_active?: boolean | number;
      display_order?: number;
    }
  ): Promise<DiningTable> => {
    const res = await fetch(`/api/seating/tables/${id}`, {
      method: 'PUT',
      headers: jsonHeaders,
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update dining table');
    }
    return res.json();
  },
  deleteDiningTable: async (id: string): Promise<void> => {
    const res = await fetch(`/api/seating/tables/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete dining table');
    }
  },

  getSeatingPlan: async (): Promise<SeatingPlanOverview> => {
    const res = await fetch('/api/seating/plan');
    if (!res.ok) throw new Error('Failed to fetch seating plan');
    return res.json();
  },
};

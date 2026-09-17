export type OrderType = 'dine_in' | 'takeout' | 'delivery' | 'bar';

export type OrderStatus = 'active' | 'in_kitchen' | 'ready' | 'served' | 'completed' | 'cancelled';

export type PaymentMethod = 'cash' | 'card_terminal';

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded';

export interface MenuItem {
  id: string;
  category_id: string;
  category_name?: string;
  name: string;
  description: string;
  price: number;
  cost: number; // Base food / raw ingredient cost
  pantry_cost?: number; // Estimated seasonings, oils, garnishes, butter, packaging
  labor_cost?: number; // Estimated prep & line labor cost per dish
  is_available: boolean;
  allergens: string; // comma-separated or json
  image_url?: string;
  created_at: string;
  ingredients?: MenuItemIngredient[];
}

export interface MenuItemIngredient {
  id?: string;
  menu_item_id?: string;
  inventory_item_id: string; // empty string if unlinked custom ingredient
  inventory_name?: string;
  driver_name?: string; // e.g. "Primary Protein Cut"
  driver_cost?: number; // Cost contribution ($) of this driver
  quantity_used: number; // Recipe portion quantity
  unit?: string;
  unit_cost?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  display_order: number;
  item_count?: number;
}

export interface InventoryCategory {
  id: string;
  name: string;
  display_order: number;
  item_count?: number;
}

export interface SeatingLocation {
  id: string;
  name: string; // e.g. "Main Dining Room", "Bar", "Patio"
  display_order: number;
  description?: string;
  table_count?: number;
  total_seats?: number;
  created_at?: string;
  tables?: DiningTable[];
}

export type TableShape = 'standard' | 'booth' | 'bar' | 'outdoor' | 'round';
export type TableOccupancyStatus = 'available' | 'occupied' | 'reserved';

export interface DiningTable {
  id: string;
  location_id: string;
  location_name?: string;
  location_order?: number;
  table_number: string; // e.g. "Table 1", "Bar 1", "Patio 1"
  seats: number; // The number of seats at this table
  shape?: TableShape | string;
  is_active: boolean | number;
  display_order?: number;
  created_at?: string;
  // Dynamic occupancy metadata from backend
  status?: TableOccupancyStatus;
  active_order?: {
    id: string;
    order_number: number;
    guest_count: number;
    total: number;
    status: string;
    created_at: string;
  } | null;
  active_reservation?: {
    id: string;
    guest_name: string;
    party_size: number;
    reservation_time: string;
    status: string;
  } | null;
}

export interface SeatingPlanOverview {
  locations: SeatingLocation[];
  tables: DiningTable[];
  total_tables: number;
  total_seats: number;
  occupied_tables: number;
  reserved_tables: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_threshold: number;
  unit_cost: number;
  supplier: string;
  last_restocked_at?: string;
  updated_at: string;
}

export interface InventoryLog {
  id: string;
  inventory_item_id: string;
  item_name?: string;
  change_amount: number;
  change_type: 'manual_adjustment' | 'order_depletion' | 'restock' | 'waste';
  notes: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  name: string;
  title: 'server' | 'bartender' | 'line_cook' | 'head_chef' | 'host' | 'manager' | 'dishwasher' | string;
  role?: string; // backwards compatibility alias for title
  hourly_rate: number;
  pin: string;
  is_active: boolean;
  admin_access: boolean;
  current_shift_id?: string | null;
  created_at: string;
}

export interface TimeShift {
  id: string;
  staff_id: string;
  staff_name?: string;
  staff_title?: string;
  staff_role?: string;
  clock_in: string;
  clock_out?: string | null;
  break_minutes: number;
  total_hours: number;
  status: 'open' | 'completed';
  notes: string;
  hourly_rate?: number;
  direct_tips?: number;
}

export interface TipRecord {
  id: string;
  date: string;
  staff_id: string | null;
  staff_name?: string;
  order_id?: string | null;
  amount: number;
  tip_type: 'direct_server' | 'pooled_distribution' | 'cash_drop' | 'card_terminal_tip';
  distribution_method: 'direct' | 'hours_worked_pool' | 'custom';
  notes: string;
  created_at: string;
}

export interface PayrollSummaryRow {
  staff_id: string;
  staff_name: string;
  title: string;
  role?: string;
  hourly_rate: number;
  total_hours: number;
  base_wages: number;
  direct_tips: number;
  pooled_tips: number;
  total_tips: number;
  total_gross_pay: number;
  shift_count: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  status: 'pending' | 'cooking' | 'served';
}

export interface Order {
  id: string;
  order_number: number;
  order_type: OrderType;
  table_number: string;
  guest_count: number;
  server_id: string | null;
  server_name?: string;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_notes: string; // e.g. "Terminal #2, Ref: 4892" or "Cash $50.00, Change: $7.25"
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export type ReservationStatus = 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  guest_name?: string;
  customer_name: string;
  guest_phone?: string;
  customer_phone?: string;
  guest_email?: string;
  customer_email?: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  table_number: string;
  status: ReservationStatus;
  special_requests?: string;
  notes?: string;
  created_at: string;
}

export interface DashboardStats {
  todaySales: number;
  todayOrderCount: number;
  openOrdersCount: number;
  activeStaffCount: number;
  todayTipsTotal: number;
  lowStockItemsCount: number;
  todayReservationsCount: number;
}

export type AppStats = DashboardStats & {
  cashSales?: number;
  cardSales?: number;
  lowStockCount?: number;
};

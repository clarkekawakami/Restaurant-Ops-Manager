import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Clock,
  CheckCircle,
  ChefHat,
  Search,
  Filter,
  CreditCard,
  Banknote,
  Eye,
  Trash2,
  ChevronRight,
  ArrowRight,
  Users,
  Utensils,
  AlertCircle,
  Sparkles,
  MapPin,
  Armchair,
} from 'lucide-react';
import { Order, MenuItem, MenuCategory, StaffMember, OrderStatus, DiningTable, SeatingLocation } from '../types.ts';
import { api } from '../lib/api.ts';
import { PaymentModal } from './PaymentModal.tsx';
import { ReceiptModal } from './ReceiptModal.tsx';

interface OrdersModuleProps {
  staffList: StaffMember[];
  onStatsRefresh: () => void;
  preselectedTable?: string | null;
}

export const OrdersModule: React.FC<OrdersModuleProps> = ({
  staffList,
  onStatsRefresh,
  preselectedTable,
}) => {
  const [subView, setSubView] = useState<'active' | 'create' | 'history'>('active');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [diningTables, setDiningTables] = useState<DiningTable[]>([]);
  const [seatingLocations, setSeatingLocations] = useState<SeatingLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // New Order State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState<string>('');
  const [orderType, setOrderType] = useState<'dine_in' | 'takeout' | 'bar'>('dine_in');
  const [tableNumber, setTableNumber] = useState<string>(preselectedTable || 'Table 1');
  const [guestCount, setGuestCount] = useState<number>(2);
  const [assignedServerId, setAssignedServerId] = useState<string>('');
  const [cartItems, setCartItems] = useState<
    Array<{
      menu_item_id: string;
      name: string;
      unit_price: number;
      quantity: number;
      notes: string;
    }>
  >([]);

  // Modals
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [viewingReceiptOrder, setViewingReceiptOrder] = useState<Order | null>(null);

  // History filters
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('today');
  const [historyMethodFilter, setHistoryMethodFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (preselectedTable && diningTables.length > 0) {
      setTableNumber(preselectedTable);
      const match = diningTables.find(
        (dt) => dt.table_number.toLowerCase() === preselectedTable.toLowerCase()
      );
      if (match) {
        setSelectedLocationId(match.location_id);
        if (match.seats) setGuestCount(match.seats);
      }
      setSubView('create');
    } else if (!selectedLocationId && seatingLocations.length > 0) {
      const match = diningTables.find(
        (dt) => dt.table_number.toLowerCase() === tableNumber.toLowerCase()
      );
      if (match) {
        setSelectedLocationId(match.location_id);
      } else {
        setSelectedLocationId(seatingLocations[0].id);
        const locTables = diningTables.filter((dt) => dt.location_id === seatingLocations[0].id);
        if (locTables.length > 0 && (!tableNumber || tableNumber === 'Table 1')) {
          setTableNumber(locTables[0].table_number);
          if (locTables[0].seats) setGuestCount(locTables[0].seats);
        }
      }
    }
  }, [preselectedTable, diningTables, seatingLocations]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedOrders, fetchedItems, fetchedCats, fetchedTables, fetchedLocations] = await Promise.all([
        api.getOrders(),
        api.getMenuItems(),
        api.getCategories(),
        api.getDiningTables().catch(() => []),
        api.getSeatingLocations().catch(() => []),
      ]);
      setOrders(fetchedOrders);
      setMenuItems(fetchedItems);
      setCategories(fetchedCats);
      setDiningTables(fetchedTables);
      setSeatingLocations(fetchedLocations);
      if (staffList.length > 0 && !assignedServerId) {
        setAssignedServerId(staffList[0].id);
      }
    } catch (err) {
      console.error('Error fetching orders data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Cart operations
  const handleAddToCart = (item: MenuItem) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.menu_item_id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menu_item_id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          unit_price: item.price,
          quantity: 1,
          notes: '',
        },
      ];
    });
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    setCartItems((prev) => {
      const copy = [...prev];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) {
        return copy.filter((_, i) => i !== index);
      }
      copy[index].quantity = newQty;
      return copy;
    });
  };

  const handleUpdateItemNote = (index: number, note: string) => {
    setCartItems((prev) => {
      const copy = [...prev];
      copy[index].notes = note;
      return copy;
    });
  };

  const cartSubtotal = cartItems.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);
  const cartTax = Math.round(cartSubtotal * 0.0825 * 100) / 100;
  const cartTotal = Math.round((cartSubtotal + cartTax) * 100) / 100;

  const handleCreateOrder = async () => {
    if (cartItems.length === 0) return;
    const finalTable = tableNumber.trim() || (orderType === 'takeout' ? 'Takeout' : 'Table 1');
    try {
      await api.createOrder({
        order_type: orderType,
        table_number: finalTable,
        guest_count: guestCount,
        server_id: assignedServerId || null,
        items: cartItems,
      });
      // reset
      setCartItems([]);
      setSubView('active');
      loadData();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Error creating order');
    }
  };

  const handleAdvanceStatus = async (order: Order) => {
    const nextStatusMap: Record<OrderStatus, OrderStatus> = {
      active: 'in_kitchen',
      in_kitchen: 'ready',
      ready: 'served',
      served: 'served',
      completed: 'completed',
      cancelled: 'cancelled',
    };
    const next = nextStatusMap[order.status];
    if (next && next !== order.status) {
      try {
        await api.updateOrderStatus(order.id, next);
        loadData();
        onStatsRefresh();
      } catch (err: any) {
        console.error(err);
      }
    }
  };

  const activeOrders = orders.filter((o) => ['active', 'in_kitchen', 'ready', 'served'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'completed');

  // Filtered completed orders
  const todayStr = new Date().toISOString().split('T')[0];
  const filteredCompleted = completedOrders.filter((o) => {
    if (historyDateFilter === 'today') {
      const datePart = (o.paid_at || o.created_at).split('T')[0];
      if (datePart !== todayStr) return false;
    }
    if (historyMethodFilter !== 'all') {
      if (o.payment_method !== historyMethodFilter) return false;
    }
    return true;
  });

  const totalSalesRevenue = filteredCompleted.reduce((acc, o) => acc + o.total, 0);
  const totalCashVolume = filteredCompleted
    .filter((o) => o.payment_method === 'cash')
    .reduce((acc, o) => acc + o.total, 0);
  const totalCardVolume = filteredCompleted
    .filter((o) => o.payment_method === 'card_terminal')
    .reduce((acc, o) => acc + o.total, 0);
  const totalTipsCollected = filteredCompleted.reduce((acc, o) => acc + o.tip, 0);

  // Filtered tables for selected seating location
  const availableTablesForLocation = diningTables.filter(
    (dt) => dt.location_id === selectedLocationId
  );

  // Filtered menu items
  const filteredMenuItems = menuItems.filter((item) => {
    if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
    if (menuSearch) {
      const q = menuSearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.allergens.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Sub-navigation Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            id="tab-active-tickets"
            onClick={() => setSubView('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              subView === 'active'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Active Tickets</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px]">
              {activeOrders.length}
            </span>
          </button>

          <button
            id="tab-create-order"
            onClick={() => setSubView('create')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              subView === 'create'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Order / POS</span>
          </button>

          <button
            id="tab-sales-history"
            onClick={() => setSubView('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              subView === 'history'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Sales & Payments</span>
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Cash & Standalone Card Station Active
          </span>
        </div>
      </div>

      {/* VIEW 1: ACTIVE TICKETS */}
      {subView === 'active' && (
        <div className="space-y-4">
          {activeOrders.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
              <Utensils className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <h3 className="font-heading font-bold text-slate-700 text-base">No Active Tickets</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                The floor is clear. Click below to start a new dine-in table, bar tab, or takeout order.
              </p>
              <button
                onClick={() => setSubView('create')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create New Ticket
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeOrders.map((order) => {
                const statusStyles: Record<
                  OrderStatus,
                  { bg: string; text: string; label: string; icon: any }
                > = {
                  active: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Floor Active', icon: Clock },
                  in_kitchen: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', label: 'In Kitchen', icon: ChefHat },
                  ready: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Ready to Serve', icon: CheckCircle },
                  served: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-800', label: 'Served / Dining', icon: Utensils },
                  completed: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-800', label: 'Completed', icon: CheckCircle },
                  cancelled: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', label: 'Cancelled', icon: AlertCircle },
                };

                const currentConfig = statusStyles[order.status];
                const StatusIcon = currentConfig.icon;

                return (
                  <div
                    key={order.id}
                    id={`ticket-${order.order_number}`}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between overflow-hidden hover:border-slate-300 transition"
                  >
                    {/* Ticket Header */}
                    <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-black text-slate-900 text-lg">
                            #{order.order_number}
                          </span>
                          <span className="text-xs font-bold text-slate-700 px-2 py-0.5 rounded-md bg-white border border-slate-200">
                            {order.table_number}
                          </span>
                          <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                            {order.order_type}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Server: <span className="font-medium text-slate-700">{order.server_name || 'Unassigned'}</span> &bull; {order.guest_count} guests
                        </p>
                      </div>

                      <div
                        className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${currentConfig.bg} ${currentConfig.text}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" />
                        <span>{currentConfig.label}</span>
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="p-4 space-y-2 flex-1 max-h-60 overflow-y-auto">
                      {order.items.map((item) => (
                        <div key={item.id} className="text-xs flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 font-mono">{item.quantity}x</span>
                              <span className="font-medium text-slate-800">{item.name}</span>
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-amber-700 italic pl-5 mt-0.5">
                                Note: {item.notes}
                              </p>
                            )}
                          </div>
                          <span className="font-mono text-slate-600 font-medium">
                            ${item.total_price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Total & Action Bar */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-3">
                      <div className="flex justify-between items-baseline text-xs">
                        <span className="text-slate-500">Subtotal (${order.subtotal.toFixed(2)}) + Tax</span>
                        <div className="text-right">
                          <span className="text-sm font-bold font-mono text-slate-900">
                            Total: ${order.total.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {order.status !== 'served' ? (
                          <button
                            onClick={() => handleAdvanceStatus(order)}
                            className="py-2 px-3 rounded-xl text-xs font-bold bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                            <span>
                              {order.status === 'active'
                                ? 'Send Kitchen'
                                : order.status === 'in_kitchen'
                                ? 'Mark Ready'
                                : 'Mark Served'}
                            </span>
                          </button>
                        ) : (
                          <div className="py-2 px-3 rounded-xl text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 text-center">
                            Served to Table
                          </div>
                        )}

                        <button
                          id={`btn-pay-${order.order_number}`}
                          onClick={() => setPayingOrder(order)}
                          className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                          <span>Pay & Close</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: NEW ORDER BUILDER */}
      {subView === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Menu Selector (Left 7-8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-4">
            {/* Search & Category Pills */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search dishes, ingredients, allergens..."
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All Items
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredMenuItems.map((item) => {
                const isAvailable = item.is_available;
                return (
                  <div
                    key={item.id}
                    onClick={() => isAvailable && handleAddToCart(item)}
                    className={`p-3.5 rounded-xl border transition flex flex-col justify-between ${
                      isAvailable
                        ? 'bg-white border-slate-200 hover:border-slate-400 hover:shadow-xs cursor-pointer'
                        : 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-heading font-bold text-sm text-slate-900 leading-tight">
                          {item.name}
                        </h4>
                        <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                          ${item.price.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      {item.allergens ? (
                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                          {item.allergens}
                        </span>
                      ) : (
                        <span className="text-slate-400">Fresh prepared</span>
                      )}

                      {isAvailable ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add
                        </span>
                      ) : (
                        <span className="text-red-600 font-bold">86'd / Sold Out</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Ticket Slip (Right 4-5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-20 flex flex-col">
              {/* Slip Header Configuration */}
              <div className="p-4 bg-slate-900 text-white space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-400" />
                    <span className="font-heading font-bold text-sm">Active POS Ticket</span>
                  </div>
                  <span className="text-[11px] font-mono bg-slate-800 px-2 py-0.5 rounded text-amber-300">
                    Draft
                  </span>
                </div>

                {/* Order Type, Location, Table & Server Selection */}
                <div className="space-y-2.5 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">Order Type</label>
                      <select
                        value={orderType}
                        onChange={(e: any) => {
                          const newType = e.target.value;
                          setOrderType(newType);
                          if (newType === 'takeout') {
                            setTableNumber('Takeout');
                          } else if (newType === 'bar') {
                            const barLoc = seatingLocations.find((l) => l.name.toLowerCase().includes('bar'));
                            if (barLoc) {
                              setSelectedLocationId(barLoc.id);
                              const barTables = diningTables.filter((dt) => dt.location_id === barLoc.id);
                              if (barTables.length > 0) {
                                setTableNumber(barTables[0].table_number);
                                if (barTables[0].seats) setGuestCount(barTables[0].seats);
                              }
                            }
                          } else if (tableNumber === 'Takeout') {
                            const locTables = diningTables.filter((dt) => dt.location_id === selectedLocationId);
                            if (locTables.length > 0) {
                              setTableNumber(locTables[0].table_number);
                              if (locTables[0].seats) setGuestCount(locTables[0].seats);
                            } else if (diningTables.length > 0) {
                              setTableNumber(diningTables[0].table_number);
                              setSelectedLocationId(diningTables[0].location_id);
                            }
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-400"
                      >
                        <option value="dine_in">Dine-In</option>
                        <option value="bar">Bar Tab</option>
                        <option value="takeout">Takeout</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">Guests</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={guestCount}
                        onChange={(e) => setGuestCount(Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 font-mono"
                      />
                    </div>
                  </div>

                  {/* Seating Location & Table Dropdowns */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400" />
                        Seating Location
                      </label>
                      <select
                        value={selectedLocationId}
                        onChange={(e) => {
                          const locId = e.target.value;
                          setSelectedLocationId(locId);
                          const locTables = diningTables.filter((dt) => dt.location_id === locId);
                          if (locTables.length > 0) {
                            setTableNumber(locTables[0].table_number);
                            if (locTables[0].seats) {
                              setGuestCount(locTables[0].seats);
                            }
                          } else {
                            setTableNumber('');
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 font-medium truncate"
                      >
                        <option value="">-- Select Location --</option>
                        {seatingLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1 flex items-center gap-1">
                        <Armchair className="w-3 h-3 text-amber-400" />
                        Assigned Table
                      </label>
                      <select
                        value={tableNumber}
                        disabled={!selectedLocationId && orderType !== 'takeout'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTableNumber(val);
                          const match = diningTables.find(
                            (dt) => dt.table_number.toLowerCase() === val.toLowerCase()
                          );
                          if (match && match.seats) {
                            setGuestCount(match.seats);
                          }
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed truncate"
                      >
                        {!selectedLocationId && orderType !== 'takeout' ? (
                          <option value="">-- Select location first --</option>
                        ) : availableTablesForLocation.length === 0 ? (
                          orderType === 'takeout' ? (
                            <option value="Takeout">Takeout / Counter</option>
                          ) : (
                            <option value="">No tables configured</option>
                          )
                        ) : (
                          <>
                            <option value="">-- Select Table --</option>
                            {availableTablesForLocation.map((dt) => (
                              <option key={dt.id} value={dt.table_number}>
                                {dt.table_number} ({dt.seats} seats)
                              </option>
                            ))}
                            {orderType === 'takeout' && (
                              <option value="Takeout">Takeout / Counter</option>
                            )}
                          </>
                        )}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-medium mb-1">Server Assigned</label>
                    <select
                      value={assignedServerId}
                      onChange={(e) => setAssignedServerId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-amber-400"
                    >
                      <option value="">-- Select Server --</option>
                      {staffList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.title || st.role})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Items in Cart */}
              <div className="p-4 flex-1 overflow-y-auto max-h-80 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <Utensils className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p>Select items from the menu to start order</p>
                  </div>
                ) : (
                  cartItems.map((cartItem, idx) => (
                    <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">{cartItem.name}</span>
                        <span className="font-mono font-bold text-slate-800">
                          ${(cartItem.unit_price * cartItem.quantity).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleUpdateQuantity(idx, -1)}
                            className="w-6 h-6 rounded-md bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-bold w-6 text-center text-slate-900">
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(idx, 1)}
                            className="w-6 h-6 rounded-md bg-white border border-slate-300 text-slate-700 flex items-center justify-center font-bold hover:bg-slate-100 cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <input
                          type="text"
                          placeholder="Special prep note..."
                          value={cartItem.notes}
                          onChange={(e) => handleUpdateItemNote(idx, e.target.value)}
                          className="flex-1 ml-2 px-2 py-1 text-[11px] bg-white rounded border border-slate-200 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Total Calculation & Action */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3">
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono">${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax (8.25%):</span>
                    <span className="font-mono">${cartTax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total:</span>
                    <span className="font-mono text-base">${cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={cartItems.length === 0}
                    onClick={() => setCartItems([])}
                    className="p-2.5 text-xs text-slate-500 hover:text-red-600 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 transition cursor-pointer disabled:opacity-30"
                    title="Clear Ticket"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    id="btn-send-kitchen"
                    disabled={cartItems.length === 0}
                    onClick={handleCreateOrder}
                    className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                  >
                    <ChefHat className="w-4 h-4 text-amber-400" />
                    <span>Send Order to Floor (${cartTotal.toFixed(2)})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: COMPLETED SALES HISTORY */}
      {subView === 'history' && (
        <div className="space-y-6">
          {/* Revenue Breakdown Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block">Total Settled Sales</span>
              <span className="font-mono text-2xl font-black text-slate-900">
                ${totalSalesRevenue.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {filteredCompleted.length} completed transactions
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cash Volume</span>
              </div>
              <span className="font-mono text-2xl font-black text-emerald-700">
                ${totalCashVolume.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Cash drawer deposits</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <CreditCard className="w-3.5 h-3.5 text-slate-700" />
                <span>Standalone Card Terminal</span>
              </div>
              <span className="font-mono text-2xl font-black text-slate-800">
                ${totalCardVolume.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Independent reader batches</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block">Recorded Staff Tips</span>
              <span className="font-mono text-2xl font-black text-amber-600">
                ${totalTipsCollected.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">For payroll tip reporting</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-700">Filter History:</span>
              <select
                value={historyDateFilter}
                onChange={(e) => setHistoryDateFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:ring-1 focus:ring-slate-900"
              >
                <option value="today">Today Only</option>
                <option value="all">All Past Sales</option>
              </select>

              <select
                value={historyMethodFilter}
                onChange={(e) => setHistoryMethodFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium focus:ring-1 focus:ring-slate-900"
              >
                <option value="all">All Payment Methods</option>
                <option value="card_terminal">Standalone Card Terminal</option>
                <option value="cash">Cash Tender</option>
              </select>
            </div>
          </div>

          {/* Completed Sales Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Order #</th>
                    <th className="p-3.5">Date / Time</th>
                    <th className="p-3.5">Table & Type</th>
                    <th className="p-3.5">Server</th>
                    <th className="p-3.5">Method</th>
                    <th className="p-3.5">Authorization / Details</th>
                    <th className="p-3.5">Tip</th>
                    <th className="p-3.5">Total Paid</th>
                    <th className="p-3.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredCompleted.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No completed sales found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCompleted.map((order) => {
                      const timeStr = order.paid_at
                        ? new Date(order.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <tr key={order.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5 font-bold font-mono text-slate-900">
                            #{order.order_number}
                          </td>
                          <td className="p-3.5 text-slate-600">{timeStr}</td>
                          <td className="p-3.5">
                            <span className="font-semibold text-slate-800">{order.table_number}</span>
                            <span className="text-[10px] text-slate-400 block uppercase">
                              {order.order_type}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-700">{order.server_name || '—'}</td>
                          <td className="p-3.5">
                            {order.payment_method === 'card_terminal' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                                <CreditCard className="w-3 h-3 text-slate-600" />
                                Standalone Card
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Banknote className="w-3 h-3 text-emerald-600" />
                                Cash
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-500 max-w-xs truncate font-mono text-[11px]">
                            {order.payment_notes || '—'}
                          </td>
                          <td className="p-3.5 font-mono text-amber-700 font-semibold">
                            ${order.tip.toFixed(2)}
                          </td>
                          <td className="p-3.5 font-mono font-bold text-slate-900 text-sm">
                            ${order.total.toFixed(2)}
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => setViewingReceiptOrder(order)}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="View Customer Receipt"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payment Processing Modal */}
      {payingOrder && (
        <PaymentModal
          order={payingOrder}
          staffList={staffList}
          onClose={() => setPayingOrder(null)}
          onPaymentSuccess={(paidOrder) => {
            setPayingOrder(null);
            loadData();
            onStatsRefresh();
            setViewingReceiptOrder(paidOrder);
          }}
        />
      )}

      {/* Customer Receipt Modal */}
      {viewingReceiptOrder && (
        <ReceiptModal
          order={viewingReceiptOrder}
          onClose={() => setViewingReceiptOrder(null)}
        />
      )}
    </div>
  );
};

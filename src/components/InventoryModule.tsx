import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Layers,
  Plus,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Search,
  Filter,
  History,
  ShoppingCart,
  Edit2,
  Trash2,
  X,
  RotateCcw,
  DollarSign,
  Package,
} from 'lucide-react';
import { InventoryItem, InventoryLog, InventoryCategory, StaffMember } from '../types.ts';
import { api } from '../lib/api.ts';
import { AdminAuthModal } from './AdminAuthModal.tsx';

interface InventoryModuleProps {
  onStatsRefresh: () => void;
  currentUser?: StaffMember | null;
  staffList?: StaffMember[];
  onRequireAdminAuth?: (admin: StaffMember) => void;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  onStatsRefresh,
  currentUser,
  staffList = [],
  onRequireAdminAuth,
}) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [activeTab, setActiveTab] = useState<'inventory' | 'logs' | 'reorder'>('inventory');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Admin access control
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState<boolean>(false);
  const [adminPendingAction, setAdminPendingAction] = useState<(() => void) | null>(null);

  const requireAdmin = (action: () => void) => {
    if (currentUser?.admin_access) {
      action();
    } else {
      setAdminPendingAction(() => action);
      setIsAdminAuthOpen(true);
    }
  };

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [inventoryCategories, setInventoryCategories] = useState<InventoryCategory[]>([]);
  const [newCatName, setNewCatName] = useState<string>('');

  // Form states
  const [itemForm, setItemForm] = useState({
    name: '',
    category: 'Produce',
    unit: 'lbs',
    current_stock: '',
    min_threshold: '5',
    unit_cost: '',
    supplier: '',
  });

  const [adjustForm, setAdjustForm] = useState({
    change_type: 'restock',
    amount: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedItems, fetchedLogs, fetchedCats] = await Promise.all([
        api.getInventory(),
        api.getInventoryLogs(),
        api.getInventoryCategories(),
      ]);
      setItems(fetchedItems);
      setLogs(fetchedLogs);
      setInventoryCategories(fetchedCats);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenNewItem = () => {
    setEditingItem(null);
    setItemForm({
      name: '',
      category: inventoryCategories.length > 0 ? inventoryCategories[0].name : 'Produce',
      unit: 'lbs',
      current_stock: '10',
      min_threshold: '5',
      unit_cost: '2.50',
      supplier: '',
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      current_stock: item.current_stock.toString(),
      min_threshold: item.min_threshold.toString(),
      unit_cost: item.unit_cost.toString(),
      supplier: item.supplier || '',
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.unit) return;

    try {
      if (editingItem) {
        await api.updateInventoryItem(editingItem.id, {
          name: itemForm.name,
          category: itemForm.category,
          unit: itemForm.unit,
          min_threshold: Number(itemForm.min_threshold),
          unit_cost: Number(itemForm.unit_cost),
          supplier: itemForm.supplier,
        });
      } else {
        await api.createInventoryItem({
          name: itemForm.name,
          category: itemForm.category,
          unit: itemForm.unit,
          current_stock: Number(itemForm.current_stock || 0),
          min_threshold: Number(itemForm.min_threshold || 5),
          unit_cost: Number(itemForm.unit_cost || 0),
          supplier: itemForm.supplier,
        });
      }
      setIsItemModalOpen(false);
      loadData();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save inventory item');
    }
  };

  const handleOpenAdjust = (item: InventoryItem) => {
    setAdjustingItem(item);
    setAdjustForm({
      change_type: 'restock',
      amount: '',
      notes: '',
    });
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem || !adjustForm.amount) return;

    try {
      let delta = Number(adjustForm.amount);
      if (adjustForm.change_type === 'waste') {
        delta = -Math.abs(delta);
      } else if (adjustForm.change_type === 'manual_adjustment') {
        // user inputs delta
      } else {
        delta = Math.abs(delta);
      }

      await api.adjustStock(
        adjustingItem.id,
        delta,
        adjustForm.change_type,
        adjustForm.notes || `${adjustForm.change_type} operation`
      );

      setAdjustingItem(null);
      loadData();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to adjust stock');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this inventory item?')) return;
    try {
      await api.deleteInventoryItem(id);
      loadData();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.createInventoryCategory({
        name: newCatName.trim(),
        display_order: inventoryCategories.length + 1,
      });
      setNewCatName('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create inventory category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this inventory category? Items in this category will be reassigned to General.')) return;
    try {
      await api.deleteInventoryCategory(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete inventory category');
    }
  };

  // Metrics
  const totalValuation = items.reduce((acc, i) => acc + i.current_stock * i.unit_cost, 0);
  const lowStockItems = items.filter((i) => i.current_stock <= i.min_threshold && i.current_stock > 0);
  const outOfStockItems = items.filter((i) => i.current_stock <= 0);

  // Filter items
  const categories = Array.from(
    new Set([
      ...inventoryCategories.map((c) => c.name),
      ...items.map((i) => i.category),
    ])
  ).filter(Boolean).sort();

  const filteredItems = items.filter((item) => {
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (statusFilter === 'low' && (item.current_stock > item.min_threshold || item.current_stock <= 0)) return false;
    if (statusFilter === 'out' && item.current_stock > 0) return false;
    if (statusFilter === 'ok' && item.current_stock <= item.min_threshold) return false;

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.supplier && item.supplier.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">Inventory Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor raw ingredients, units, low stock alerts, cost valuation, and audit stock movements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-manage-inventory-categories"
            onClick={() => requireAdmin(() => setIsCategoryModalOpen(true))}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Manage Inventory Item Categories</span>
          </button>

          <button
            id="btn-add-inventory-item"
            onClick={() => requireAdmin(handleOpenNewItem)}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Stock Item</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Total Inventory Value</span>
          <span className="font-mono text-2xl font-black text-slate-900">
            ${totalValuation.toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-400 block mt-1">{items.length} unique items tracked</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Low Stock Alerts</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="font-mono text-2xl font-black text-amber-600">
            {lowStockItems.length}
          </span>
          <span className="text-[11px] text-amber-700/80 block mt-1">Below minimum threshold</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Depleted / Out</span>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <span className="font-mono text-2xl font-black text-red-600">
            {outOfStockItems.length}
          </span>
          <span className="text-[11px] text-red-600/80 block mt-1">Immediate restock required</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-medium">Adequate Stock</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="font-mono text-2xl font-black text-emerald-700">
            {items.length - lowStockItems.length - outOfStockItems.length}
          </span>
          <span className="text-[11px] text-emerald-700/80 block mt-1">Above safety thresholds</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'inventory'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Boxes className="w-3.5 h-3.5" />
          <span>Stock Levels ({items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reorder')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'reorder'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Reorder Generator ({lowStockItems.length + outOfStockItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'logs'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Audit Trail & Usage Logs</span>
        </button>
      </div>

      {/* TAB 1: STOCK LEVELS */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by ingredient name, supplier, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-lg border border-slate-200 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:ring-1 focus:ring-slate-900"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:ring-1 focus:ring-slate-900"
              >
                <option value="all">All Stock Statuses</option>
                <option value="low">Low Stock Only</option>
                <option value="out">Depleted Only</option>
                <option value="ok">Well Stocked</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Ingredient Item</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Current Stock Level</th>
                    <th className="p-3.5">Safety Min</th>
                    <th className="p-3.5">Unit Cost</th>
                    <th className="p-3.5">Total Value</th>
                    <th className="p-3.5">Supplier</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Quick Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        No inventory items matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => {
                      const isOut = item.current_stock <= 0;
                      const isLow = item.current_stock <= item.min_threshold && !isOut;
                      const val = item.current_stock * item.unit_cost;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5">
                            <span className="font-bold text-slate-900 block">{item.name}</span>
                            <span className="text-[11px] text-slate-400">ID: {item.id}</span>
                          </td>

                          <td className="p-3.5 text-slate-600 font-medium">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px]">
                              {item.category}
                            </span>
                          </td>

                          <td className="p-3.5 font-mono">
                            <span className="font-bold text-slate-900 text-sm">
                              {item.current_stock}
                            </span>{' '}
                            <span className="text-slate-500">{item.unit}</span>
                          </td>

                          <td className="p-3.5 font-mono text-slate-600">
                            {item.min_threshold} {item.unit}
                          </td>

                          <td className="p-3.5 font-mono text-slate-700">
                            ${item.unit_cost.toFixed(2)}
                          </td>

                          <td className="p-3.5 font-mono font-semibold text-slate-900">
                            ${val.toFixed(2)}
                          </td>

                          <td className="p-3.5 text-slate-600 max-w-[150px] truncate">
                            {item.supplier || '—'}
                          </td>

                          <td className="p-3.5 text-center">
                            {isOut ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800 border border-red-200">
                                Depleted (0)
                              </span>
                            ) : isLow ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                Low Stock
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                                In Stock
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => requireAdmin(() => handleOpenAdjust(item))}
                                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Adjust</span>
                              </button>

                              <button
                                onClick={() => requireAdmin(() => handleOpenEditItem(item))}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Edit Item Details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => requireAdmin(() => handleDeleteItem(item.id))}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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

      {/* TAB 2: REORDER GENERATOR */}
      {activeTab === 'reorder' && (
        <div className="space-y-4">
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start justify-between">
            <div>
              <h4 className="font-heading font-bold text-sm text-amber-950">
                Automated Restock & Purchase Order Suggestion
              </h4>
              <p className="mt-0.5 text-amber-800">
                These {lowStockItems.length + outOfStockItems.length} items have fallen below their configured safety reorder thresholds.
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 rounded-lg bg-amber-900 text-white font-bold text-xs hover:bg-amber-800 transition cursor-pointer"
            >
              Print Purchase List
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Item Name</th>
                  <th className="p-3.5">Current Stock</th>
                  <th className="p-3.5">Threshold</th>
                  <th className="p-3.5">Suggested Order Qty</th>
                  <th className="p-3.5">Est. Cost</th>
                  <th className="p-3.5">Primary Supplier</th>
                  <th className="p-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...outOfStockItems, ...lowStockItems].map((item) => {
                  const suggested = Math.ceil(item.min_threshold * 2 - item.current_stock);
                  const estCost = suggested * item.unit_cost;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-bold text-slate-900">{item.name}</td>
                      <td className="p-3.5 font-mono text-red-600 font-bold">
                        {item.current_stock} {item.unit}
                      </td>
                      <td className="p-3.5 font-mono text-slate-500">
                        {item.min_threshold} {item.unit}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-emerald-700">
                        +{suggested} {item.unit}
                      </td>
                      <td className="p-3.5 font-mono text-slate-800 font-semibold">
                        ${estCost.toFixed(2)}
                      </td>
                      <td className="p-3.5 text-slate-600">{item.supplier || 'Standard Distributor'}</td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => handleOpenAdjust(item)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer"
                        >
                          Receive Delivery
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT TRAIL & LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <span className="font-heading font-bold text-sm text-slate-900">
              Stock Movement History & Order Depletion Logs
            </span>
            <span className="text-xs text-slate-500">Last 100 events</span>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Item</th>
                <th className="p-3.5">Change Amount</th>
                <th className="p-3.5">Event Type</th>
                <th className="p-3.5">Notes & Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => {
                const isPositive = log.change_amount > 0;
                const formattedDate = new Date(log.created_at).toLocaleString();

                return (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5 text-slate-500 font-mono text-[11px]">{formattedDate}</td>
                    <td className="p-3.5 font-bold text-slate-900">{log.item_name}</td>
                    <td className="p-3.5 font-mono font-bold">
                      <span className={isPositive ? 'text-emerald-700' : 'text-red-600'}>
                        {isPositive ? `+${log.change_amount}` : log.change_amount} {log.unit}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {log.change_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600 max-w-sm">{log.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* QUICK STOCK ADJUST MODAL */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-heading text-sm font-bold text-slate-900">
                  Adjust Stock: {adjustingItem.name}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Current Stock: <span className="font-bold text-slate-800 font-mono">{adjustingItem.current_stock} {adjustingItem.unit}</span>
                </p>
              </div>
              <button
                onClick={() => setAdjustingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adjustment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'restock', label: '+ Received Restock' },
                    { id: 'waste', label: '- Waste / Spoilage' },
                    { id: 'manual_adjustment', label: '+/- Audit / Count' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setAdjustForm({ ...adjustForm, change_type: t.id })}
                      className={`p-2 rounded-lg border text-center text-[11px] font-bold transition cursor-pointer ${
                        adjustForm.change_type === t.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quantity ({adjustingItem.unit}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  placeholder="e.g. 10"
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, amount: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono font-bold text-sm focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Invoice #9923 or prep shift drop"
                  value={adjustForm.notes}
                  onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                >
                  Save Stock Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT INVENTORY ITEM MODAL */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-heading text-base font-bold text-slate-900">
                {editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
              </h3>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Ingredient / Stock Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Atlantic Salmon Fillets"
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category</label>
                  <select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {inventoryCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {itemForm.category && !inventoryCategories.some((c) => c.name === itemForm.category) && (
                      <option value={itemForm.category}>{itemForm.category}</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Measurement Unit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. lbs, cuts, bottles"
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                {!editingItem && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Initial Stock</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0"
                      value={itemForm.current_stock}
                      onChange={(e) => setItemForm({ ...itemForm, current_stock: e.target.value })}
                      className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Min Threshold <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    placeholder="5"
                    value={itemForm.min_threshold}
                    onChange={(e) => setItemForm({ ...itemForm, min_threshold: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={itemForm.unit_cost}
                    onChange={(e) => setItemForm({ ...itemForm, unit_cost: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Supplier / Vendor</label>
                  <input
                    type="text"
                    placeholder="e.g. Green Valley Farms"
                    value={itemForm.supplier}
                    onChange={(e) => setItemForm({ ...itemForm, supplier: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
                >
                  Save Stock Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE INVENTORY ITEM CATEGORIES MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-heading text-base font-bold text-slate-900">Manage Inventory Item Categories</h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="New category name..."
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
                >
                  Add Category
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {inventoryCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{cat.name}</span>
                      <span className="text-[11px] text-slate-500 ml-2">
                        ({cat.item_count || 0} {cat.item_count === 1 ? 'item' : 'items'})
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                      title="Delete category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {inventoryCategories.length === 0 && (
                  <p className="text-center text-slate-400 py-4">No inventory categories yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN AUTHORIZATION MODAL */}
      <AdminAuthModal
        isOpen={isAdminAuthOpen}
        onClose={() => {
          setIsAdminAuthOpen(false);
          setAdminPendingAction(null);
        }}
        adminStaffList={staffList.filter((s) => s.admin_access)}
        onSuccess={(authenticatedAdmin) => {
          if (onRequireAdminAuth) {
            onRequireAdminAuth(authenticatedAdmin);
          }
          setIsAdminAuthOpen(false);
          if (adminPendingAction) {
            adminPendingAction();
            setAdminPendingAction(null);
          }
        }}
        title="Administrator Access Required"
        description="Administrator authorization is required to modify inventory items, categories, or adjust stock levels."
      />
    </div>
  );
};

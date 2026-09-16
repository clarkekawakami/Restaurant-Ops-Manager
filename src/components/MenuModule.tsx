import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  TrendingUp,
  Layers,
  Sparkles,
  Calculator,
  Percent,
  DollarSign,
  ChefHat,
  Info,
  Scale,
  PackagePlus,
  Package,
  ArrowRight,
} from 'lucide-react';
import { MenuItem, MenuCategory, InventoryCategory, InventoryItem } from '../types.ts';
import { api } from '../lib/api.ts';
import { InventorySkuLookup } from './InventorySkuLookup.tsx';

interface CostDriverRow {
  driver_name: string;
  inventory_item_id: string;
  quantity_used: number;
  driver_cost: number;
}

export const MenuModule: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<InventoryCategory[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');

  // New Inventory Item (SKU) on-the-fly creation modal
  const [isNewSkuModalOpen, setIsNewSkuModalOpen] = useState<boolean>(false);
  const [targetDriverIdxForNewSku, setTargetDriverIdxForNewSku] = useState<number | null>(null);
  const [newSkuData, setNewSkuData] = useState({
    name: '',
    category: 'Meat & Poultry',
    unit: 'lbs',
    current_stock: '25',
    min_threshold: '5',
    unit_cost: '6.50',
    supplier: '',
  });

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    description: '',
    price: '',
    pantry_cost: '1.50',
    labor_cost: '3.00',
    allergens: '',
    image_url: '',
    ingredients: [] as CostDriverRow[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedItems, fetchedCats, fetchedInv, fetchedInvCats] = await Promise.all([
        api.getMenuItems(),
        api.getCategories(),
        api.getInventory(),
        api.getInventoryCategories(),
      ]);
      setItems(fetchedItems);
      setCategories(fetchedCats);
      setInventoryList(fetchedInv);
      setInventoryCategories(fetchedInvCats);
    } catch (err) {
      console.error('Error loading menu:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenNewItem = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category_id: categories.length > 0 ? categories[0].id : '',
      description: '',
      price: '28.00',
      pantry_cost: '1.50',
      labor_cost: '3.00',
      allergens: '',
      image_url: '',
      ingredients: [
        {
          driver_name: '',
          inventory_item_id: '',
          quantity_used: 1,
          driver_cost: 0,
        },
      ],
    });
    setIsItemModalOpen(true);
  };

  const handleOpenEditItem = (item: MenuItem) => {
    setEditingItem(item);
    const drivers: CostDriverRow[] =
      item.ingredients && item.ingredients.length > 0
        ? item.ingredients.map((ing) => {
            const inv = inventoryList.find((i) => i.id === ing.inventory_item_id);
            const qty = ing.quantity_used || 1;
            const cost =
              ing.driver_cost !== undefined && ing.driver_cost !== null
                ? Number(ing.driver_cost)
                : inv
                ? Number((inv.unit_cost * qty).toFixed(2))
                : Number(item.cost || 0);

            return {
              driver_name: ing.driver_name || (inv ? inv.name : ''),
              inventory_item_id: ing.inventory_item_id || '',
              quantity_used: qty,
              driver_cost: cost,
            };
          })
        : [
            {
              driver_name: '',
              inventory_item_id: '',
              quantity_used: 1,
              driver_cost: 0,
            },
          ];

    setFormData({
      name: item.name,
      category_id: item.category_id,
      description: item.description || '',
      price: item.price.toString(),
      pantry_cost: (item.pantry_cost ?? 1.5).toString(),
      labor_cost: (item.labor_cost ?? 3.0).toString(),
      allergens: item.allergens || '',
      image_url: item.image_url || '',
      ingredients: drivers,
    });
    setIsItemModalOpen(true);
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    const newStatus = !item.is_available;
    try {
      await api.toggleMenuItemAvailability(item.id, newStatus);
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, is_available: newStatus } : it))
      );
    } catch (err: any) {
      alert(err.message || 'Failed to toggle availability');
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this menu item?')) return;
    try {
      await api.deleteMenuItem(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  // Cost driver rows management
  const handleAddCostDriver = () => {
    setFormData((prev) => ({
      ...prev,
      ingredients: [
        ...prev.ingredients,
        {
          driver_name: '',
          inventory_item_id: '',
          quantity_used: 1,
          driver_cost: 0,
        },
      ],
    }));
  };

  const handleRemoveCostDriver = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx),
    }));
  };

  const handleSelectDriverSku = (idx: number, item: InventoryItem | null) => {
    setFormData((prev) => {
      const copy = [...prev.ingredients];
      if (!item) {
        copy[idx] = {
          ...copy[idx],
          inventory_item_id: '',
          driver_name: '',
          driver_cost: 0,
        };
      } else {
        const qty = Number(copy[idx].quantity_used) || 1;
        copy[idx] = {
          ...copy[idx],
          inventory_item_id: item.id,
          driver_name: item.name,
          quantity_used: qty,
          driver_cost: Number((item.unit_cost * qty).toFixed(2)),
        };
      }
      return { ...prev, ingredients: copy };
    });
  };

  const handleUpdateCostDriver = (idx: number, field: keyof CostDriverRow, value: any) => {
    setFormData((prev) => {
      const copy = [...prev.ingredients];
      const row = { ...copy[idx], [field]: value };

      // When selecting a new inventory SKU, auto-fill unit cost & calculate driver cost
      if (field === 'inventory_item_id') {
        const inv = inventoryList.find((i) => i.id === value);
        if (inv) {
          row.driver_name = inv.name;
          const qty = Number(row.quantity_used) || 1;
          row.driver_cost = Number((inv.unit_cost * qty).toFixed(2));
        }
      }

      // When modifying quantity of a linked SKU, re-compute driver cost
      if (field === 'quantity_used' && row.inventory_item_id) {
        const inv = inventoryList.find((i) => i.id === row.inventory_item_id);
        if (inv) {
          const qty = Number(value) || 0;
          row.driver_cost = Number((inv.unit_cost * qty).toFixed(2));
        }
      }

      copy[idx] = row;
      return { ...prev, ingredients: copy };
    });
  };

  // New SKU creation workflow
  const handleOpenNewSkuModal = (targetIdx: number | null, initialName?: string) => {
    setTargetDriverIdxForNewSku(targetIdx);
    const existingName =
      initialName ||
      (targetIdx !== null && formData.ingredients[targetIdx]?.driver_name
        ? formData.ingredients[targetIdx].driver_name
        : '');
    const existingCost =
      targetIdx !== null && formData.ingredients[targetIdx]?.driver_cost
        ? formData.ingredients[targetIdx].driver_cost.toString()
        : '6.50';

    setNewSkuData({
      name: existingName,
      category: 'Meat & Poultry',
      unit: 'lbs',
      current_stock: '25',
      min_threshold: '5',
      unit_cost: existingCost,
      supplier: '',
    });
    setIsNewSkuModalOpen(true);
  };

  const handleCreateNewSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuData.name.trim()) {
      alert('Please enter an inventory item name');
      return;
    }

    try {
      const created = await api.createInventoryItem({
        name: newSkuData.name.trim(),
        category: newSkuData.category,
        unit: newSkuData.unit,
        current_stock: Number(newSkuData.current_stock) || 0,
        min_threshold: Number(newSkuData.min_threshold) || 0,
        unit_cost: Number(newSkuData.unit_cost) || 0,
        supplier: newSkuData.supplier.trim() || 'Direct Supplier',
      });

      // Refetch inventory to update list
      const refreshed = await api.getInventory();
      setInventoryList(refreshed);

      if (targetDriverIdxForNewSku !== null && targetDriverIdxForNewSku >= 0) {
        // Link to existing driver row
        setFormData((prev) => {
          const copy = [...prev.ingredients];
          if (copy[targetDriverIdxForNewSku]) {
            const qty = copy[targetDriverIdxForNewSku].quantity_used || 1;
            copy[targetDriverIdxForNewSku] = {
              ...copy[targetDriverIdxForNewSku],
              driver_name: copy[targetDriverIdxForNewSku].driver_name || created.name,
              inventory_item_id: created.id,
              quantity_used: qty,
              driver_cost: Number((created.unit_cost * qty).toFixed(2)),
            };
          }
          return { ...prev, ingredients: copy };
        });
      } else {
        // Triggered from header button: add as a new cost driver row
        setFormData((prev) => ({
          ...prev,
          ingredients: [
            ...prev.ingredients,
            {
              driver_name: created.name,
              inventory_item_id: created.id,
              quantity_used: 1,
              driver_cost: created.unit_cost,
            },
          ],
        }));
      }

      setIsNewSkuModalOpen(false);
      setTargetDriverIdxForNewSku(null);
    } catch (err: any) {
      alert(err.message || 'Failed to create inventory item');
    }
  };

  // Live calculations
  // Sum of all primary ingredient cost drivers is the Raw Food Cost
  const aggregateRawFoodCost = formData.ingredients.reduce(
    (sum, d) => sum + (Number(d.driver_cost) || 0),
    0
  );

  const modalPrice = Number(formData.price || 0);
  const modalPantryCost = Number(formData.pantry_cost || 0);
  const modalLaborCost = Number(formData.labor_cost || 0);
  const modalTotalPrimeCost = aggregateRawFoodCost + modalPantryCost + modalLaborCost;
  const modalGrossProfit = modalPrice - modalTotalPrimeCost;
  const modalMarginPct = modalPrice > 0 ? (modalGrossProfit / modalPrice) * 100 : 0;

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category_id || !formData.price) {
      alert('Please fill all required fields (Name, Category, Selling Price)');
      return;
    }

    // Require all major cost drivers to be linked to an inventory item
    for (let i = 0; i < formData.ingredients.length; i++) {
      const ing = formData.ingredients[i];
      if (!ing.inventory_item_id) {
        alert(
          `Cost Driver #${i + 1} (${ing.driver_name || 'Unnamed'}) must be linked to an inventory item. Please select or create an inventory SKU.`
        );
        return;
      }
    }

    try {
      const payload = {
        name: formData.name,
        category_id: formData.category_id,
        description: formData.description,
        price: Number(formData.price),
        cost: aggregateRawFoodCost,
        pantry_cost: Number(formData.pantry_cost || 0),
        labor_cost: Number(formData.labor_cost || 0),
        allergens: formData.allergens,
        image_url: formData.image_url,
        ingredients: formData.ingredients.map((ing) => ({
          driver_name: ing.driver_name,
          inventory_item_id: ing.inventory_item_id || '',
          quantity_used: Number(ing.quantity_used) || 1,
          driver_cost: Number(ing.driver_cost) || 0,
        })),
      };

      if (editingItem) {
        await api.updateMenuItem(editingItem.id, payload);
      } else {
        await api.createMenuItem(payload);
      }

      setIsItemModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save menu item');
    }
  };

  // Category creation
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.createCategory({ name: newCatName.trim(), display_order: categories.length + 1 });
      setNewCatName('');
      setIsCategoryModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Delete this category and unassign items?')) return;
    try {
      await api.deleteCategory(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    if (selectedCategory !== 'all' && item.category_id !== selectedCategory) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.allergens.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate overall menu costing stats
  const totalItemCount = items.length;
  const menuStats = items.reduce(
    (acc, it) => {
      const fCost = Number(it.cost || 0);
      const pCost = Number(it.pantry_cost || 0);
      const lCost = Number(it.labor_cost || 0);
      const tCost = fCost + pCost + lCost;
      const profit = it.price - tCost;
      const margin = it.price > 0 ? (profit / it.price) * 100 : 0;

      acc.totalPrice += it.price;
      acc.totalFoodCost += fCost;
      acc.totalPantryCost += pCost;
      acc.totalLaborCost += lCost;
      acc.totalPlateCost += tCost;
      acc.totalMarginPct += margin;
      if (margin >= 60) acc.healthyMarginCount++;
      if (margin < 50) acc.lowMarginCount++;
      return acc;
    },
    {
      totalPrice: 0,
      totalFoodCost: 0,
      totalPantryCost: 0,
      totalLaborCost: 0,
      totalPlateCost: 0,
      totalMarginPct: 0,
      healthyMarginCount: 0,
      lowMarginCount: 0,
    }
  );

  const avgMargin = totalItemCount > 0 ? menuStats.totalMarginPct / totalItemCount : 0;
  const avgFoodCost = totalItemCount > 0 ? menuStats.totalFoodCost / totalItemCount : 0;
  const avgPantryCost = totalItemCount > 0 ? menuStats.totalPantryCost / totalItemCount : 0;
  const avgLaborCost = totalItemCount > 0 ? menuStats.totalLaborCost / totalItemCount : 0;
  const avgTotalCost = totalItemCount > 0 ? menuStats.totalPlateCost / totalItemCount : 0;
  const avgPrice = totalItemCount > 0 ? menuStats.totalPrice / totalItemCount : 0;

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">Menu Item Management</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure dishes, categories, costing (raw food, estimated pantry, labor), profit margins, and recipe inventory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Manage Menu Item Categories</span>
          </button>

          <button
            id="btn-add-menu-item"
            onClick={handleOpenNewItem}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Add Menu Item</span>
          </button>
        </div>
      </div>

      {/* Costing & Gross Margin Analytics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Gross Margin</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            {avgMargin.toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="font-medium text-emerald-700">Target: 60%–70%</span> across active items
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Plate Cost</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            ${avgTotalCost.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-x-2">
            <span>Food: <strong className="text-slate-700 font-mono">${avgFoodCost.toFixed(2)}</strong></span>
            <span>Pantry: <strong className="text-slate-700 font-mono">${avgPantryCost.toFixed(2)}</strong></span>
            <span>Labor: <strong className="text-slate-700 font-mono">${avgLaborCost.toFixed(2)}</strong></span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Avg Menu Price</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900">
            ${avgPrice.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {totalItemCount} total active dishes listed
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Margin Health</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600">{menuStats.healthyMarginCount}</span>
            <span className="text-xs text-slate-500 font-medium">healthy (≥60%)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {menuStats.lowMarginCount > 0 ? (
              <span className="text-amber-700 font-medium">
                {menuStats.lowMarginCount} dish{menuStats.lowMarginCount > 1 ? 'es' : ''} below 50% margin
              </span>
            ) : (
              <span className="text-emerald-700 font-medium">All dishes meet minimum margin targets</span>
            )}
          </p>
        </div>
      </div>

      {/* Search & Category Pills */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search items by name, ingredients, or allergens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
            All Categories ({items.length})
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
              {cat.name} ({cat.item_count || 0})
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="p-3.5">Dish / Item</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Sale Price</th>
                <th className="p-3.5">Cost Breakdown</th>
                <th className="p-3.5">Gross Margin</th>
                <th className="p-3.5">Allergens</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    No menu items found. Click "Add Menu Item" above to get started.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const foodCost = Number(item.cost || 0);
                  const pantryCost = Number(item.pantry_cost || 0);
                  const laborCost = Number(item.labor_cost || 0);
                  const totalCost = foodCost + pantryCost + laborCost;
                  const profit = item.price - totalCost;
                  const marginPct = item.price > 0 ? (profit / item.price) * 100 : 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                              <BookOpen className="w-5 h-5 text-slate-300" />
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block text-xs">{item.name}</span>
                            <span className="text-[11px] text-slate-500 line-clamp-1 max-w-xs">
                              {item.description}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-slate-600 font-medium">
                        {item.category_name || 'General'}
                      </td>

                      <td className="p-3.5 font-mono font-bold text-slate-900">
                        ${item.price.toFixed(2)}
                      </td>

                      <td className="p-3.5">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          ${totalCost.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">prime</span>
                        </div>
                        <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-x-1 mt-0.5">
                          <span title="Raw food cost (sum of cost drivers)">Food: ${foodCost.toFixed(2)}</span>
                          <span>•</span>
                          <span title="Estimated pantry buffer">Pantry: ${pantryCost.toFixed(2)}</span>
                          <span>•</span>
                          <span title="Estimated prep & cook labor">Labor: ${laborCost.toFixed(2)}</span>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono">
                        <div className="font-bold text-slate-900 text-xs">
                          +${profit.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">profit</span>
                        </div>
                        <div className="mt-1">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              marginPct >= 60
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : marginPct >= 45
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                            }`}
                          >
                            {marginPct.toFixed(1)}% margin
                          </span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {item.allergens ? (
                          <span className="inline-block text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                            {item.allergens}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">None</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggleAvailability(item)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition cursor-pointer border ${
                            item.is_available
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
                          }`}
                        >
                          {item.is_available ? 'In Stock' : '86’d / Sold Out'}
                        </button>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEditItem(item)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
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

      {/* CREATE / EDIT MENU ITEM MODAL */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <ChefHat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold text-slate-900">
                    {editingItem ? 'Edit Menu Item with Multiple Cost Drivers' : 'Create Menu Item with Multiple Cost Drivers'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Link key raw food cost drivers to perpetual inventory SKUs for accurate plate margins.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Menu Item Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-700 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Menu Item Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Filet Mignon & Jumbo Prawns (Surf & Turf)"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold uppercase tracking-wider text-[10px] mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-xs"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Menu Description */}
              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Menu Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Appetizing guest-facing description for floor waitstaff..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-xs"
                />
              </div>

              {/* Selling Price */}
              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[10px] mb-1">
                  Menu Selling Price ($) <span className="text-red-500">*</span>
                </label>
                <div className="relative max-w-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold">
                    $
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="28.00"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full pl-7 pr-3 py-2 bg-white rounded-lg border border-slate-300 font-mono font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-sm"
                  />
                </div>
              </div>

              {/* MAJOR COST DRIVERS CARD */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                  <div>
                    <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs uppercase tracking-wider">
                      <Scale className="w-4 h-4 text-amber-600" />
                      <span>Major Cost Drivers ({formData.ingredients.length})</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Add 1 or more key ingredients that drive this item's raw food cost
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenNewSkuModal(null)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 transition cursor-pointer flex items-center gap-1"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      <span>+ Add Inventory Item</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCostDriver}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 transition cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Cost Driver</span>
                    </button>
                  </div>
                </div>

                {formData.ingredients.length === 0 ? (
                  <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-slate-500 text-xs mb-2">No cost drivers specified yet.</p>
                    <button
                      type="button"
                      onClick={handleAddCostDriver}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
                    >
                      Add First Cost Driver
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {formData.ingredients.map((driver, idx) => {
                      const linkedInv = inventoryList.find((i) => i.id === driver.inventory_item_id);
                      return (
                        <div
                          key={idx}
                          className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                            {/* Combined Driver Name / Component & Inventory SKU Searchable Select */}
                            <div className="sm:col-span-7">
                              <div className="flex justify-between items-center mb-1">
                                <label className="block text-slate-700 font-semibold text-[10px]">
                                  Driver Name / Component <span className="text-red-500 font-bold" title="Required">*</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleOpenNewSkuModal(idx, driver.driver_name)}
                                  className="text-[10px] font-bold text-amber-700 hover:text-amber-800 hover:underline cursor-pointer flex items-center gap-0.5"
                                  title="Create a new SKU and link to this row"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>New SKU</span>
                                </button>
                              </div>
                              <InventorySkuLookup
                                value={driver.inventory_item_id}
                                driverName={driver.driver_name}
                                inventoryList={inventoryList}
                                placeholder="enter ingredient name here"
                                onSelect={(item) => handleSelectDriverSku(idx, item)}
                                onOpenNewSkuModal={(initialName) => handleOpenNewSkuModal(idx, initialName)}
                                isRequired
                              />
                              {!driver.inventory_item_id && (
                                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                                  <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                                  <span>Inventory SKU required — type 3+ characters to search</span>
                                </p>
                              )}
                            </div>

                            {/* Portion Qty */}
                            <div className="sm:col-span-2">
                              <label className="block text-slate-600 font-semibold text-[10px] mb-1">
                                Portion Qty
                              </label>
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  value={driver.quantity_used}
                                  onChange={(e) => handleUpdateCostDriver(idx, 'quantity_used', e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white text-xs font-mono text-center"
                                />
                                <span className="text-[10px] text-slate-500 whitespace-nowrap font-medium">
                                  {linkedInv?.unit || 'unit'}
                                </span>
                              </div>
                            </div>

                            {/* Driver Cost ($) & Remove button */}
                            <div className="sm:col-span-3 flex items-start gap-1.5">
                              <div className="flex-1">
                                <label className="block text-slate-600 font-semibold text-[10px] mb-1">
                                  Driver Cost ($)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2 top-1.5 text-slate-400 font-mono text-xs">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={driver.driver_cost}
                                    onChange={(e) => handleUpdateCostDriver(idx, 'driver_cost', Number(e.target.value))}
                                    className="w-full pl-5 pr-2 py-1.5 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white font-mono font-bold text-slate-900 text-xs"
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveCostDriver(idx)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer mt-4"
                                title="Delete Cost Driver"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* SKU status footer if linked */}
                          {linkedInv && (
                            <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                                <Check className="w-3 h-3" />
                                Linked to perpetual stock: {linkedInv.name} (${linkedInv.unit_cost.toFixed(2)} / {linkedInv.unit})
                              </span>
                              <span className="text-slate-400">
                                Stock on hand: {linkedInv.current_stock} {linkedInv.unit}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Aggregate Summary */}
                <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <span className="text-slate-600">
                    Primary ingredient cost drivers in aggregate form the <strong>Raw Food Cost</strong>:
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-xs">
                    Aggregate Raw Food Cost: ${aggregateRawFoodCost.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* ESTIMATED PANTRY & LABOR BUFFERS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-slate-800 font-bold uppercase tracking-wider text-[10px] mb-0.5">
                    Flat Pantry Buffer ($)
                  </label>
                  <p className="text-[10px] text-slate-500 mb-2">
                    Seasonings, cooking fats, micro-garnishes
                  </p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-slate-400 font-mono text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.pantry_cost}
                      onChange={(e) => setFormData({ ...formData, pantry_cost: e.target.value })}
                      className="w-full pl-6 pr-3 py-1.5 bg-white rounded-lg border border-slate-300 font-mono font-bold text-slate-900 text-xs"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-slate-800 font-bold uppercase tracking-wider text-[10px] mb-0.5">
                    Generalized Labor Cost ($)
                  </label>
                  <p className="text-[10px] text-slate-500 mb-2">
                    Estimated prep cook & line cook allocation
                  </p>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-slate-400 font-mono text-xs">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.labor_cost}
                      onChange={(e) => setFormData({ ...formData, labor_cost: e.target.value })}
                      className="w-full pl-6 pr-3 py-1.5 bg-white rounded-lg border border-slate-300 font-mono font-bold text-slate-900 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* LIVE MARGIN CALCULATION METRICS */}
              <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs">
                <div className="grid grid-cols-3 gap-4 text-center divide-x divide-slate-800">
                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Total Prime Cost
                    </div>
                    <div className="text-lg font-mono font-bold text-white">
                      ${modalTotalPrimeCost.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Food (${aggregateRawFoodCost.toFixed(2)}) + Pantry (${Number(formData.pantry_cost || 0).toFixed(2)}) + Labor (${Number(formData.labor_cost || 0).toFixed(2)})
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Estimated Unit Profit
                    </div>
                    <div
                      className={`text-lg font-mono font-bold ${
                        modalGrossProfit >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {modalGrossProfit >= 0 ? '+' : ''}${modalGrossProfit.toFixed(2)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Selling Price minus Total Prime Cost
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Profit Margin
                    </div>
                    <div
                      className={`text-lg font-bold font-mono ${
                        modalMarginPct >= 60
                          ? 'text-emerald-400'
                          : modalMarginPct >= 45
                          ? 'text-amber-400'
                          : 'text-red-400'
                      }`}
                    >
                      {modalMarginPct.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {modalMarginPct >= 60
                        ? 'Healthy (≥60%)'
                        : modalMarginPct >= 45
                        ? 'Moderate (45-59%)'
                        : 'Low (<45%)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Details: Allergens & Image URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Allergens</label>
                  <input
                    type="text"
                    placeholder="e.g. Dairy, Gluten, Shellfish, Tree Nuts"
                    value={formData.allergens}
                    onChange={(e) => setFormData({ ...formData, allergens: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Image URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    className="w-full px-3 py-1.5 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
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
                  {editingItem ? 'Save Changes' : 'Create Menu Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW INVENTORY ITEM (SKU) MODAL */}
      {isNewSkuModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-bold text-slate-900">
                    Create New Inventory Item (SKU)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Define and immediately link for perpetual inventory tracking
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsNewSkuModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewSku} className="p-6 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Item / SKU Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Wild Jumbo Sea Scallops (U-10)"
                  value={newSkuData.name}
                  onChange={(e) => setNewSkuData({ ...newSkuData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Category</label>
                  <select
                    value={newSkuData.category}
                    onChange={(e) => setNewSkuData({ ...newSkuData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {inventoryCategories.length > 0 ? (
                      inventoryCategories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Meat">Meat</option>
                        <option value="Seafood">Seafood</option>
                        <option value="Produce">Produce</option>
                        <option value="Dairy">Dairy</option>
                        <option value="Pantry">Pantry</option>
                        <option value="Beverage">Beverage</option>
                        <option value="Frozen">Frozen</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit of Measure</label>
                  <select
                    value={newSkuData.unit}
                    onChange={(e) => setNewSkuData({ ...newSkuData, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  >
                    <option value="lbs">lbs</option>
                    <option value="oz">oz</option>
                    <option value="cuts">cuts</option>
                    <option value="portions">portions</option>
                    <option value="bottles">bottles</option>
                    <option value="kg">kg</option>
                    <option value="each">each</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Unit Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newSkuData.unit_cost}
                    onChange={(e) => setNewSkuData({ ...newSkuData, unit_cost: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white rounded-lg border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Stock on Hand</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newSkuData.current_stock}
                    onChange={(e) => setNewSkuData({ ...newSkuData, current_stock: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Min Threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newSkuData.min_threshold}
                    onChange={(e) => setNewSkuData({ ...newSkuData, min_threshold: e.target.value })}
                    className="w-full px-2.5 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Primary Supplier (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Pacific Seafood Co."
                  value={newSkuData.supplier}
                  onChange={(e) => setNewSkuData({ ...newSkuData, supplier: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewSkuModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 cursor-pointer shadow-xs"
                >
                  Create & Link SKU
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE CATEGORIES MODAL */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-heading text-base font-bold text-slate-900">Manage Menu Item Categories</h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
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
                  className="px-3.5 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 shrink-0"
                >
                  Add Category
                </button>
              </form>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div>
                      <span className="font-bold text-slate-800">{cat.name}</span>
                      <span className="text-[11px] text-slate-500 ml-2">({cat.item_count || 0} items)</span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Armchair,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Users,
  Search,
  CheckCircle,
  Clock,
  Utensils,
  X,
  ShieldCheck,
  AlertCircle,
  LayoutGrid,
  List,
  Sparkles,
  MapPin,
  Coffee,
  Sun,
  Wine,
} from 'lucide-react';
import {
  SeatingLocation,
  DiningTable,
  SeatingPlanOverview,
  StaffMember,
  TableShape,
} from '../types.ts';
import { api } from '../lib/api.ts';
import { AdminAuthModal } from './AdminAuthModal.tsx';

interface SeatingModuleProps {
  currentUser?: StaffMember | null;
  staffList?: StaffMember[];
  onRequireAdminAuth?: (admin: StaffMember) => void;
  onSeatAndOpenOrder?: (tableNumber: string) => void;
  onStatsRefresh?: () => void;
}

export const SeatingModule: React.FC<SeatingModuleProps> = ({
  currentUser,
  staffList = [],
  onRequireAdminAuth,
  onSeatAndOpenOrder,
  onStatsRefresh,
}) => {
  const [locations, setLocations] = useState<SeatingLocation[]>([]);
  const [tables, setTables] = useState<DiningTable[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'occupied' | 'reserved'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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

  // Locations modal state
  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);
  const [newLocationName, setNewLocationName] = useState<string>('');
  const [newLocationDesc, setNewLocationDesc] = useState<string>('');
  const [editingLocation, setEditingLocation] = useState<SeatingLocation | null>(null);

  // Table modal state
  const [isTableModalOpen, setIsTableModalOpen] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<DiningTable | null>(null);
  const [tableForm, setTableForm] = useState<{
    location_id: string;
    table_number: string;
    seats: number;
    shape: TableShape;
    is_active: boolean;
  }>({
    location_id: '',
    table_number: '',
    seats: 4,
    shape: 'standard',
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const plan: SeatingPlanOverview = await api.getSeatingPlan();
      setLocations(plan.locations || []);
      setTables(plan.tables || []);
    } catch (err) {
      console.error('Error fetching seating plan:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Table CRUD
  const handleOpenNewTable = (preselectedLocId?: string) => {
    requireAdmin(() => {
      setEditingTable(null);
      const defaultLoc = preselectedLocId || (locations.length > 0 ? locations[0].id : '');
      setTableForm({
        location_id: defaultLoc,
        table_number: '',
        seats: 4,
        shape: 'standard',
        is_active: true,
      });
      setIsTableModalOpen(true);
    });
  };

  const handleOpenEditTable = (tbl: DiningTable) => {
    requireAdmin(() => {
      setEditingTable(tbl);
      setTableForm({
        location_id: tbl.location_id,
        table_number: tbl.table_number,
        seats: tbl.seats,
        shape: (tbl.shape as TableShape) || 'standard',
        is_active: Boolean(tbl.is_active),
      });
      setIsTableModalOpen(true);
    });
  };

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableForm.table_number.trim() || !tableForm.location_id) {
      alert('Please provide a table name/number and select a seating location.');
      return;
    }

    try {
      if (editingTable) {
        await api.updateDiningTable(editingTable.id, {
          location_id: tableForm.location_id,
          table_number: tableForm.table_number.trim(),
          seats: Number(tableForm.seats),
          shape: tableForm.shape,
          is_active: tableForm.is_active ? 1 : 0,
        });
      } else {
        await api.createDiningTable({
          location_id: tableForm.location_id,
          table_number: tableForm.table_number.trim(),
          seats: Number(tableForm.seats),
          shape: tableForm.shape,
          is_active: tableForm.is_active ? 1 : 0,
        });
      }

      setIsTableModalOpen(false);
      loadData();
      if (onStatsRefresh) onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save table');
    }
  };

  const handleDeleteTable = (tbl: DiningTable) => {
    requireAdmin(async () => {
      if (!confirm(`Are you sure you want to remove '${tbl.table_number}' from the floor plan?`)) return;
      try {
        await api.deleteDiningTable(tbl.id);
        loadData();
        if (onStatsRefresh) onStatsRefresh();
      } catch (err: any) {
        alert(err.message || 'Failed to delete table');
      }
    });
  };

  // Location CRUD
  const handleOpenLocationsModal = () => {
    requireAdmin(() => {
      setEditingLocation(null);
      setNewLocationName('');
      setNewLocationDesc('');
      setIsLocationModalOpen(true);
    });
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) return;

    try {
      if (editingLocation) {
        await api.updateSeatingLocation(editingLocation.id, {
          name: newLocationName.trim(),
          description: newLocationDesc.trim(),
        });
        setEditingLocation(null);
      } else {
        await api.createSeatingLocation({
          name: newLocationName.trim(),
          display_order: locations.length + 1,
          description: newLocationDesc.trim(),
        });
      }
      setNewLocationName('');
      setNewLocationDesc('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save location');
    }
  };

  const handleDeleteLocation = async (loc: SeatingLocation) => {
    if (!confirm(`Delete seating location '${loc.name}'? All tables inside this location will also be deleted.`)) {
      return;
    }

    try {
      await api.deleteSeatingLocation(loc.id);
      if (selectedLocationId === loc.id) {
        setSelectedLocationId('all');
      }
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete location');
    }
  };

  // Calculations & Metrics
  const totalCapacity = tables.filter((t) => t.is_active).reduce((sum, t) => sum + t.seats, 0);
  const occupiedCount = tables.filter((t) => t.status === 'occupied').length;
  const reservedCount = tables.filter((t) => t.status === 'reserved').length;
  const availableCount = tables.filter((t) => t.status === 'available' && t.is_active).length;

  // Filter tables
  const filteredTables = tables.filter((t) => {
    if (selectedLocationId !== 'all' && t.location_id !== selectedLocationId) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = t.table_number.toLowerCase().includes(q);
      const matchLoc = t.location_name?.toLowerCase().includes(q);
      const matchSeats = `${t.seats} seats`.includes(q) || `${t.seats} seat`.includes(q);
      return matchName || matchLoc || matchSeats;
    }
    return true;
  });

  const getLocationIcon = (locName: string) => {
    const lower = locName.toLowerCase();
    if (lower.includes('bar') || lower.includes('lounge')) return Wine;
    if (lower.includes('patio') || lower.includes('garden') || lower.includes('terrace')) return Sun;
    return Armchair;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-xl font-bold text-slate-900 dark:text-white">
              Restaurant Seating & Floor Plan
            </h2>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              Configurable Floor
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Configure seating locations (e.g. Main Dining Room, Bar, Patio), customize tables, and specify seat capacities.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Manage Locations Button */}
          <button
            id="btn-manage-locations"
            onClick={handleOpenLocationsModal}
            className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Layers className="w-4 h-4 text-amber-500" />
            <span>Manage Locations ({locations.length})</span>
          </button>

          {/* Add Table Button */}
          <button
            id="btn-add-table"
            onClick={() => handleOpenNewTable(selectedLocationId !== 'all' ? selectedLocationId : undefined)}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white hover:bg-slate-800 dark:hover:bg-amber-400 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4 text-amber-400 dark:text-slate-950" />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Locations</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <span className="font-mono text-2xl font-black text-slate-900 dark:text-white mt-1 block">
            {locations.length}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block truncate">
            {locations.map((l) => l.name).join(', ') || 'No locations set'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Tables</span>
            <LayoutGrid className="w-4 h-4 text-slate-400" />
          </div>
          <span className="font-mono text-2xl font-black text-slate-900 dark:text-white mt-1 block">
            {tables.length}
          </span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 block">
            {availableCount} available right now
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Dining Capacity</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <span className="font-mono text-2xl font-black text-slate-900 dark:text-white mt-1 block">
            {totalCapacity}
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 block">
            Total configured seats
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Floor Occupancy</span>
            <Utensils className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
              {occupiedCount}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              seated &bull; {reservedCount} reserved
            </span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full transition-all"
              style={{
                width: tables.length > 0 ? `${((occupiedCount + reservedCount) / tables.length) * 100}%` : '0%',
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Location Tabs & Controls */}
      <div className="space-y-3">
        {/* Location selection tabs (like Inventory category pills) */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none max-w-full">
            <button
              id="tab-location-all"
              onClick={() => setSelectedLocationId('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                selectedLocationId === 'all'
                  ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-2xs border border-transparent dark:border-slate-700'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span>All Locations</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                {tables.length}
              </span>
            </button>

            {locations.map((loc) => {
              const LocIcon = getLocationIcon(loc.name);
              const isSelected = selectedLocationId === loc.id;
              return (
                <button
                  key={loc.id}
                  id={`tab-location-${loc.id}`}
                  onClick={() => setSelectedLocationId(loc.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-2xs border border-transparent dark:border-slate-700'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <LocIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>{loc.name}</span>
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    {loc.table_count || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View mode toggle: Grid vs List */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-slate-900 text-white dark:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Visual Floor Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-900 text-white dark:bg-slate-800'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Table Directory View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tables (e.g. Table 4, Bar 1, 6 seats)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 dark:focus:ring-amber-400 focus:outline-hidden"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(['all', 'available', 'occupied', 'reserved'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-slate-900 dark:bg-slate-800 text-white'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tables Content: Grid View or List View */}
      {filteredTables.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
          <Armchair className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="font-heading font-bold text-slate-700 dark:text-slate-200 text-base">
            No Tables Match Criteria
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            {searchTerm || statusFilter !== 'all' || selectedLocationId !== 'all'
              ? 'Try resetting search or location filters.'
              : 'Add tables and define seating capacity to configure your dining floor.'}
          </p>
          <button
            onClick={() => handleOpenNewTable(selectedLocationId !== 'all' ? selectedLocationId : undefined)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 dark:bg-amber-500 dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-amber-400 transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredTables.map((tbl) => {
            const isOccupied = tbl.status === 'occupied';
            const isReserved = tbl.status === 'reserved';
            const LocIcon = getLocationIcon(tbl.location_name || '');

            return (
              <div
                key={tbl.id}
                className={`p-4 rounded-2xl border transition flex flex-col justify-between shadow-2xs ${
                  isOccupied
                    ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80'
                    : isReserved
                    ? 'bg-purple-50/60 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800/80'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
              >
                <div>
                  {/* Top table info & actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-heading font-black text-base text-slate-900 dark:text-white">
                          {tbl.table_number}
                        </span>
                        {!tbl.is_active && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-semibold">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        <LocIcon className="w-3 h-3 text-slate-400" />
                        <span>{tbl.location_name || 'General'}</span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        isOccupied
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                          : isReserved
                          ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                          : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      }`}
                    >
                      {tbl.status || 'Available'}
                    </span>
                  </div>

                  {/* Seat count and shape badge */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                      <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>{tbl.seats} seats</span>
                    </div>

                    {tbl.shape && tbl.shape !== 'standard' && (
                      <span className="text-[10px] capitalize font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                        {tbl.shape}
                      </span>
                    )}
                  </div>

                  {/* Active occupancy details */}
                  {isOccupied && tbl.active_order && (
                    <div className="mt-3 p-2 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
                      <div className="font-bold flex justify-between">
                        <span>Order #{tbl.active_order.order_number}</span>
                        <span className="font-mono">${tbl.active_order.total.toFixed(2)}</span>
                      </div>
                      <div className="text-[11px] text-amber-800 dark:text-amber-300">
                        {tbl.active_order.guest_count} guests &bull; Status: {tbl.active_order.status}
                      </div>
                    </div>
                  )}

                  {isReserved && tbl.active_reservation && (
                    <div className="mt-3 p-2 rounded-xl bg-purple-100/70 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-900 dark:text-purple-200 space-y-0.5">
                      <div className="font-bold">{tbl.active_reservation.guest_name}</div>
                      <div className="text-[11px] text-purple-800 dark:text-purple-300">
                        Party of {tbl.active_reservation.party_size} &bull; {tbl.active_reservation.reservation_time}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditTable(tbl)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Edit table configuration"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTable(tbl)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Remove table"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {onSeatAndOpenOrder && (
                    <button
                      onClick={() => onSeatAndOpenOrder(tbl.table_number)}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <Utensils className="w-3 h-3 text-amber-400" />
                      <span>{isOccupied ? 'View Order' : 'Seat / POS'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Table Number / Name</th>
                  <th className="p-3.5">Seating Location</th>
                  <th className="p-3.5">Seats (Capacity)</th>
                  <th className="p-3.5">Shape / Style</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTables.map((tbl) => (
                  <tr key={tbl.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition">
                    <td className="p-3.5 font-bold font-heading text-slate-900 dark:text-white text-sm">
                      {tbl.table_number}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300 font-medium">
                      {tbl.location_name || 'General'}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {tbl.seats} seats
                      </span>
                    </td>
                    <td className="p-3.5 capitalize text-slate-500 dark:text-slate-400">
                      {tbl.shape || 'Standard'}
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          tbl.status === 'occupied'
                            ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300'
                            : tbl.status === 'reserved'
                            ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-300 border-purple-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border-emerald-300'
                        }`}
                      >
                        {tbl.status || 'Available'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onSeatAndOpenOrder && (
                          <button
                            onClick={() => onSeatAndOpenOrder(tbl.table_number)}
                            className="px-2 py-1 text-xs font-bold rounded-lg bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 cursor-pointer"
                          >
                            Open POS
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditTable(tbl)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTable(tbl)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MANAGE SEATING LOCATIONS MODAL */}
      {isLocationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="font-heading text-base font-bold text-slate-900 dark:text-white">
                  Manage Seating Locations
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Configure dining zones (e.g. Main Dining Room, Bar, Patio)
                </p>
              </div>
              <button
                onClick={() => setIsLocationModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Form to add or edit location */}
              <form onSubmit={handleCreateLocation} className="space-y-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-200 block">
                  {editingLocation ? `Edit Location: ${editingLocation.name}` : 'Add New Seating Location'}
                </span>
                <input
                  type="text"
                  required
                  placeholder="Location name (e.g. Main Dining Room, Bar, Patio)..."
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
                <input
                  type="text"
                  placeholder="Optional description (e.g. Outdoor garden with umbrella booths)..."
                  value={newLocationDesc}
                  onChange={(e) => setNewLocationDesc(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 focus:outline-hidden text-[11px]"
                />
                <div className="flex justify-end gap-2 pt-1">
                  {editingLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLocation(null);
                        setNewLocationName('');
                        setNewLocationDesc('');
                      }}
                      className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white font-bold rounded-lg hover:bg-slate-800 dark:hover:bg-amber-400 cursor-pointer"
                  >
                    {editingLocation ? 'Update Location' : 'Add Location'}
                  </button>
                </div>
              </form>

              {/* List of existing locations */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <span className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">
                  Configured Locations ({locations.length})
                </span>
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">{loc.name}</span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.2 rounded">
                          {loc.table_count || 0} tables &bull; {loc.total_seats || 0} seats
                        </span>
                      </div>
                      {loc.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{loc.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocation(loc);
                          setNewLocationName(loc.name);
                          setNewLocationDesc(loc.description || '');
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
                        title="Edit location"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLocation(loc)}
                        className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                        title="Delete location"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {locations.length === 0 && (
                  <p className="text-center text-slate-400 py-4">No seating locations yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT TABLE MODAL */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h3 className="font-heading text-base font-bold text-slate-900 dark:text-white">
                  {editingTable ? `Edit ${editingTable.table_number}` : 'Add New Dining Table'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Assign to a location and specify seat capacity
                </p>
              </div>
              <button
                onClick={() => setIsTableModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="p-6 space-y-4 text-xs">
              {/* Table Number / Identifier */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Table Number / Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Table 7, Bar 4, Patio 3, Booth 2"
                  value={tableForm.table_number}
                  onChange={(e) => setTableForm({ ...tableForm, table_number: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900 font-bold"
                />
              </div>

              {/* Seating Location Dropdown */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Seating Location *
                </label>
                <select
                  required
                  value={tableForm.location_id}
                  onChange={(e) => setTableForm({ ...tableForm, location_id: e.target.value })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">-- Select Location --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                {locations.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No locations found. Please create a location (e.g. Main Dining Room) first.
                  </p>
                )}
              </div>

              {/* Number of Seats */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Number of Seats (Capacity) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={tableForm.seats}
                    onChange={(e) => setTableForm({ ...tableForm, seats: Math.max(1, Number(e.target.value)) })}
                    className="w-24 px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono font-bold text-center text-sm"
                  />
                  <div className="flex gap-1">
                    {[2, 4, 6, 8].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setTableForm({ ...tableForm, seats: s })}
                        className={`px-2.5 py-1.5 rounded-lg font-mono font-bold text-xs border transition cursor-pointer ${
                          tableForm.seats === s
                            ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950 border-transparent'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {s} seats
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shape / Type */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                  Table Shape / Style
                </label>
                <select
                  value={tableForm.shape}
                  onChange={(e) => setTableForm({ ...tableForm, shape: e.target.value as TableShape })}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-slate-900"
                >
                  <option value="standard">Standard Dining Table</option>
                  <option value="booth">Cozy Booth</option>
                  <option value="bar">Bar Counter / High Top</option>
                  <option value="outdoor">Outdoor Terrace Table</option>
                  <option value="round">Round Banquet Table</option>
                </select>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chk-table-active"
                  checked={tableForm.is_active}
                  onChange={(e) => setTableForm({ ...tableForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="chk-table-active" className="text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  Active for guest dining service
                </label>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTableModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 dark:bg-amber-500 dark:text-slate-950 text-white hover:bg-slate-800 dark:hover:bg-amber-400 cursor-pointer shadow-2xs"
                >
                  {editingTable ? 'Save Changes' : 'Create Table'}
                </button>
              </div>
            </form>
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
        title="Admin PIN Required for Seating Plan Configuration"
        description="Configuring seating locations, adding tables, or altering floor capacity requires authorized management credentials."
        onSuccess={(admin) => {
          if (onRequireAdminAuth) onRequireAdminAuth(admin);
          if (adminPendingAction) {
            adminPendingAction();
            setAdminPendingAction(null);
          }
        }}
      />
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  Clock,
  Users,
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  Utensils,
  ChevronRight,
  Edit2,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';
import { Reservation, ReservationStatus } from '../types.ts';
import { api } from '../lib/api.ts';

interface ReservationsModuleProps {
  onSeatAndOpenOrder: (tableNumber: string) => void;
  onStatsRefresh: () => void;
}

export const ReservationsModule: React.FC<ReservationsModuleProps> = ({
  onSeatAndOpenOrder,
  onStatsRefresh,
}) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'timeline' | 'table_view'>('timeline');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);

  // Form
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_phone: '',
    party_size: '2',
    reservation_date: new Date().toISOString().split('T')[0],
    reservation_time: '19:00',
    table_number: 'Table 2',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await api.getReservations(selectedDate);
      setReservations(data);
    } catch (err) {
      console.error('Error fetching reservations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenNew = (defaultTable?: string) => {
    setEditingRes(null);
    setFormData({
      customer_name: '',
      customer_phone: '',
      party_size: '2',
      reservation_date: selectedDate,
      reservation_time: '19:00',
      table_number: defaultTable || 'Table 1',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (res: Reservation) => {
    setEditingRes(res);
    setFormData({
      customer_name: res.customer_name,
      customer_phone: res.customer_phone || '',
      party_size: res.party_size.toString(),
      reservation_date: res.reservation_date,
      reservation_time: res.reservation_time,
      table_number: res.table_number || 'Table 1',
      notes: res.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.reservation_date || !formData.reservation_time) {
      alert('Please provide customer name, date and time');
      return;
    }

    try {
      const payload = {
        customer_name: formData.customer_name,
        customer_phone: formData.customer_phone,
        party_size: Number(formData.party_size),
        reservation_date: formData.reservation_date,
        reservation_time: formData.reservation_time,
        table_number: formData.table_number,
        notes: formData.notes,
      };

      if (editingRes) {
        await api.updateReservation(editingRes.id, payload);
      } else {
        await api.createReservation(payload);
      }

      setIsModalOpen(false);
      loadData();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to save reservation');
    }
  };

  const handleUpdateStatus = async (id: string, status: ReservationStatus) => {
    try {
      await api.updateReservationStatus(id, status);
      loadData();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to update reservation');
    }
  };

  const handleSeatGuests = async (res: Reservation) => {
    try {
      await api.updateReservationStatus(res.id, 'seated');
      loadData();
      onStatsRefresh();
      // Prompt option to launch new POS order for that table
      if (res.table_number) {
        onSeatAndOpenOrder(res.table_number);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to cancel and delete this reservation?')) return;
    try {
      await api.deleteReservation(id);
      loadData();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete reservation');
    }
  };

  const tablesList = [
    'Table 1',
    'Table 2',
    'Table 3',
    'Table 4',
    'Table 5',
    'Table 6',
    'Patio 1',
    'Patio 2',
    'Bar 1',
    'Bar 2',
  ];

  const filtered = reservations.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        r.customer_name.toLowerCase().includes(q) ||
        (r.customer_phone && r.customer_phone.includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q)) ||
        (r.table_number && r.table_number.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const confirmedCount = reservations.filter((r) => r.status === 'confirmed').length;
  const seatedCount = reservations.filter((r) => r.status === 'seated').length;
  const totalGuests = reservations.reduce((acc, r) => acc + (r.status !== 'cancelled' ? r.party_size : 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">Reservations & Table Bookings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage guest party bookings, assign tables, seat arrivals, and launch live dining tickets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-add-reservation"
            onClick={() => handleOpenNew()}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>New Reservation</span>
          </button>
        </div>
      </div>

      {/* Date & Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-xs text-slate-500 font-medium">Selected Service Date</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="mt-2 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:ring-1 focus:ring-slate-900"
          />
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Confirmed Bookings</span>
          <span className="font-mono text-2xl font-black text-slate-900">{confirmedCount}</span>
          <span className="text-[11px] text-slate-400 block mt-1">Awaiting arrival</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Seated Dining Now</span>
          <span className="font-mono text-2xl font-black text-emerald-700">{seatedCount}</span>
          <span className="text-[11px] text-slate-400 block mt-1">Currently in dining room</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs text-slate-500 font-medium block">Total Expected Covers</span>
          <span className="font-mono text-2xl font-black text-amber-600">{totalGuests}</span>
          <span className="text-[11px] text-slate-400 block mt-1">Guests for {selectedDate}</span>
        </div>
      </div>

      {/* Filter and View Toggles */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-slate-400 ml-1" />
          <input
            type="text"
            placeholder="Search guest name, phone, or special requests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent border-0 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium focus:ring-1 focus:ring-slate-900"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="seated">Seated</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-Show</option>
          </select>

          <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'timeline' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('table_view')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'table_view' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Table Floor
            </button>
          </div>
        </div>
      </div>

      {/* VIEW: TABLE FLOOR SCHEMATIC */}
      {viewMode === 'table_view' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-bold text-slate-900 text-sm">
              Dining Floor Table Availability ({selectedDate})
            </h3>
            <span className="text-xs text-slate-500">
              Click any table to view bookings or book an arrival
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {tablesList.map((tbl) => {
              const tableRes = reservations.filter((r) => r.table_number === tbl);
              const activeBooking = tableRes.find((r) => ['confirmed', 'seated'].includes(r.status));
              const isSeated = activeBooking?.status === 'seated';

              return (
                <div
                  key={tbl}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                    isSeated
                      ? 'bg-emerald-50 border-emerald-300'
                      : activeBooking
                      ? 'bg-amber-50/80 border-amber-300'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-heading font-bold text-slate-900 text-sm">{tbl}</span>
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full ${
                          isSeated
                            ? 'bg-emerald-200 text-emerald-900'
                            : activeBooking
                            ? 'bg-amber-200 text-amber-900'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {isSeated ? 'Seated' : activeBooking ? 'Reserved' : 'Open'}
                      </span>
                    </div>

                    {activeBooking ? (
                      <div className="mt-2 text-xs space-y-1">
                        <div className="font-bold text-slate-800 truncate">
                          {activeBooking.customer_name}
                        </div>
                        <div className="text-[11px] text-slate-600 font-mono">
                          {activeBooking.reservation_time} &bull; {activeBooking.party_size} guests
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-400">Available all service hours</p>
                    )}
                  </div>

                  <div className="mt-4 pt-2 border-t border-slate-200/60 flex justify-end">
                    {activeBooking ? (
                      activeBooking.status === 'confirmed' ? (
                        <button
                          onClick={() => handleSeatGuests(activeBooking)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-slate-900 text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                        >
                          Seat Table
                        </button>
                      ) : (
                        <button
                          onClick={() => onSeatAndOpenOrder(tbl)}
                          className="px-2.5 py-1 text-[11px] font-bold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 cursor-pointer"
                        >
                          Open Order
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleOpenNew(tbl)}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg cursor-pointer"
                      >
                        + Book
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: TIMELINE LIST */}
      {viewMode === 'timeline' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Time</th>
                  <th className="p-3.5">Guest / Party</th>
                  <th className="p-3.5">Table</th>
                  <th className="p-3.5">Party Size</th>
                  <th className="p-3.5">Contact Phone</th>
                  <th className="p-3.5">Special Notes & Requests</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No reservations found for {selectedDate}. Click "New Reservation" to add one.
                    </td>
                  </tr>
                ) : (
                  filtered.map((res) => {
                    const statusConfig: Record<
                      ReservationStatus,
                      { bg: string; text: string; label: string }
                    > = {
                      confirmed: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', label: 'Confirmed' },
                      seated: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', label: 'Seated' },
                      completed: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', label: 'Completed' },
                      cancelled: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', label: 'Cancelled' },
                      no_show: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', label: 'No-Show' },
                    };
                    const cfg = statusConfig[res.status];

                    return (
                      <tr key={res.id} className="hover:bg-slate-50/80 transition">
                        <td className="p-3.5 font-mono font-bold text-slate-900 text-sm">
                          {res.reservation_time}
                        </td>

                        <td className="p-3.5">
                          <span className="font-bold text-slate-900 block">{res.customer_name}</span>
                        </td>

                        <td className="p-3.5 font-semibold text-slate-800">
                          {res.table_number || 'Unassigned'}
                        </td>

                        <td className="p-3.5 font-mono text-slate-700">
                          <span className="inline-flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {res.party_size} guests
                          </span>
                        </td>

                        <td className="p-3.5 text-slate-600 font-mono">
                          {res.customer_phone ? (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {res.customer_phone}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="p-3.5 text-slate-600 max-w-xs truncate">
                          {res.notes ? (
                            <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                              {res.notes}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${cfg.bg} ${cfg.text}`}
                          >
                            {cfg.label}
                          </span>
                        </td>

                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {res.status === 'confirmed' && (
                              <button
                                onClick={() => handleSeatGuests(res)}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition cursor-pointer flex items-center gap-1"
                              >
                                <Utensils className="w-3 h-3" />
                                <span>Seat</span>
                              </button>
                            )}

                            {res.status === 'seated' && (
                              <button
                                onClick={() => handleUpdateStatus(res.id, 'completed')}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer"
                              >
                                Complete
                              </button>
                            )}

                            <button
                              onClick={() => handleOpenEdit(res)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                              title="Edit Reservation"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDelete(res.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete Reservation"
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
      )}

      {/* CREATE / EDIT RESERVATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-heading text-sm font-bold text-slate-900">
                {editingRes ? 'Edit Reservation' : 'New Table Reservation'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Guest Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eleanor Vance"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    placeholder="(555) 000-0000"
                    value={formData.customer_phone}
                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Party Size (Guests)</label>
                  <input
                    type="number"
                    min="1"
                    max="40"
                    required
                    value={formData.party_size}
                    onChange={(e) => setFormData({ ...formData, party_size: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Reservation Date</label>
                  <input
                    type="date"
                    required
                    value={formData.reservation_date}
                    onChange={(e) => setFormData({ ...formData, reservation_date: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Reservation Time</label>
                  <input
                    type="time"
                    required
                    value={formData.reservation_time}
                    onChange={(e) => setFormData({ ...formData, reservation_time: e.target.value })}
                    className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assigned Table</label>
                <select
                  value={formData.table_number}
                  onChange={(e) => setFormData({ ...formData, table_number: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  {tablesList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Special Notes, Dietary or Occasion
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Birthday celebration, gluten allergy, quiet booth preferred"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                >
                  Save Reservation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

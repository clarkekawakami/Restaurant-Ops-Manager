import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  DollarSign,
  Download,
  Plus,
  Play,
  Square,
  CheckCircle2,
  Calendar,
  Layers,
  Edit2,
  Trash2,
  Sparkles,
  PieChart,
  FileSpreadsheet,
  X,
  KeyRound,
  Calculator,
} from 'lucide-react';
import { StaffMember, TimeShift, TipRecord, PayrollSummaryRow } from '../types.ts';
import { api } from '../lib/api.ts';

interface StaffModuleProps {
  staffList: StaffMember[];
  onStaffRefresh: () => void;
  onStatsRefresh: () => void;
  quickClockInOpen?: boolean;
  onCloseQuickClockIn?: () => void;
}

export const StaffModule: React.FC<StaffModuleProps> = ({
  staffList,
  onStaffRefresh,
  onStatsRefresh,
  quickClockInOpen,
  onCloseQuickClockIn,
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'tips' | 'payroll' | 'roster'>('terminal');
  const [shifts, setShifts] = useState<TimeShift[]>([]);
  const [tips, setTips] = useState<TipRecord[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Date filters for payroll
  const today = new Date();
  const priorWeek = new Date(Date.now() - 7 * 86400000);
  const [payrollFromDate, setPayrollFromDate] = useState<string>(priorWeek.toISOString().split('T')[0]);
  const [payrollToDate, setPayrollToDate] = useState<string>(today.toISOString().split('T')[0]);

  // Clock In/Out Modal
  const [isClockInModalOpen, setIsClockInModalOpen] = useState<boolean>(Boolean(quickClockInOpen));
  const [clockInStaffId, setClockInStaffId] = useState<string>('');
  const [clockInPin, setClockInPin] = useState<string>('');
  const [clockInNotes, setClockInNotes] = useState<string>('');

  const [clockOutShift, setClockOutShift] = useState<TimeShift | null>(null);
  const [clockOutBreakMins, setClockOutBreakMins] = useState<string>('0');
  const [clockOutNotes, setClockOutNotes] = useState<string>('');

  // Manual tip modal
  const [isTipModalOpen, setIsTipModalOpen] = useState<boolean>(false);
  const [tipAmount, setTipAmount] = useState<string>('');
  const [tipStaffId, setTipStaffId] = useState<string>('');
  const [tipType, setTipType] = useState<string>('cash_drop');
  const [tipNotes, setTipNotes] = useState<string>('');

  // Tip pool distribution modal
  const [isPoolModalOpen, setIsPoolModalOpen] = useState<boolean>(false);
  const [poolDate, setPoolDate] = useState<string>(today.toISOString().split('T')[0]);
  const [poolAmount, setPoolAmount] = useState<string>('');
  const [poolNotes, setPoolNotes] = useState<string>('');

  // Add staff modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);
  const [staffForm, setStaffForm] = useState({
    name: '',
    role: 'server',
    hourly_rate: '16.50',
    pin: '1234',
  });

  // Manual shift edit modal
  const [editingShift, setEditingShift] = useState<TimeShift | null>(null);

  useEffect(() => {
    if (quickClockInOpen) {
      setIsClockInModalOpen(true);
    }
  }, [quickClockInOpen]);

  useEffect(() => {
    loadData();
  }, [payrollFromDate, payrollToDate]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fetchedShifts, fetchedTips, fetchedPayroll] = await Promise.all([
        api.getShifts(),
        api.getTips(),
        api.getPayrollSummary(payrollFromDate, payrollToDate),
      ]);
      setShifts(fetchedShifts);
      setTips(fetchedTips);
      setPayrollSummary(fetchedPayroll);
    } catch (err) {
      console.error('Error fetching staff data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Clock In
  const handleClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockInStaffId) return;

    try {
      await api.clockIn(clockInStaffId, clockInPin, clockInNotes);
      setIsClockInModalOpen(false);
      if (onCloseQuickClockIn) onCloseQuickClockIn();
      setClockInPin('');
      setClockInNotes('');
      loadData();
      onStaffRefresh();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to clock in');
    }
  };

  // Clock Out
  const handleClockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clockOutShift) return;

    try {
      await api.clockOut({
        shift_id: clockOutShift.id,
        break_minutes: Number(clockOutBreakMins || 0),
        notes: clockOutNotes,
      });
      setClockOutShift(null);
      setClockOutBreakMins('0');
      setClockOutNotes('');
      loadData();
      onStaffRefresh();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to clock out');
    }
  };

  // Save manual tip
  const handleSaveTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipAmount) return;

    try {
      await api.createTip({
        amount: Number(tipAmount),
        staff_id: tipStaffId || null,
        tip_type: tipType as any,
        distribution_method: 'direct',
        notes: tipNotes,
      });
      setIsTipModalOpen(false);
      setTipAmount('');
      setTipNotes('');
      loadData();
      onStatsRefresh();
    } catch (err: any) {
      alert(err.message || 'Failed to record tip');
    }
  };

  // Distribute tip pool
  const handleDistributePool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poolAmount || Number(poolAmount) <= 0) return;

    try {
      await api.distributeTipPool({
        date: poolDate,
        pool_amount: Number(poolAmount),
        notes: poolNotes,
      });
      setIsPoolModalOpen(false);
      setPoolAmount('');
      setPoolNotes('');
      loadData();
      onStatsRefresh();
      alert('Tip pool successfully calculated and distributed proportionally based on worked shift hours!');
    } catch (err: any) {
      alert(err.message || 'Failed to distribute tip pool');
    }
  };

  // Add staff member
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name || !staffForm.hourly_rate) return;

    try {
      await api.createStaff({
        name: staffForm.name,
        role: staffForm.role,
        hourly_rate: Number(staffForm.hourly_rate),
        pin: staffForm.pin,
      });
      setIsStaffModalOpen(false);
      setStaffForm({ name: '', role: 'server', hourly_rate: '16.50', pin: '1234' });
      onStaffRefresh();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to add staff');
    }
  };

  // Active shifts right now
  const openShifts = shifts.filter((s) => s.status === 'open');

  // Total payroll metrics
  const totalWages = payrollSummary.reduce((acc, r) => acc + r.base_wages, 0);
  const totalTipsAll = payrollSummary.reduce((acc, r) => acc + r.total_tips, 0);
  const totalGrossPayroll = totalWages + totalTipsAll;
  const totalShiftHours = payrollSummary.reduce((acc, r) => acc + r.total_hours, 0);

  return (
    <div className="space-y-6">
      {/* Header & Sub-nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="font-heading text-xl font-bold text-slate-900">
            Staff Time & Tip Tracking
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Clock-in/out terminal, shift duration, tip pool distributions, and external payroll exports (ADP, Gusto, QuickBooks).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-clock-in-modal"
            onClick={() => {
              setClockInStaffId(staffList[0]?.id || '');
              setIsClockInModalOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
          >
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Clock In / Terminal</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'terminal'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Active Shift Floor ({openShifts.length} on clock)</span>
        </button>

        <button
          onClick={() => setActiveTab('tips')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'tips'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Tip Tracking & Pooling ({tips.length})</span>
        </button>

        <button
          id="tab-payroll-export"
          onClick={() => setActiveTab('payroll')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'payroll'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>External Payroll Export (CSV)</span>
        </button>

        <button
          onClick={() => setActiveTab('roster')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'roster'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Staff Roster & Wage Rates ({staffList.length})</span>
        </button>
      </div>

      {/* TAB 1: ACTIVE SHIFT FLOOR */}
      {activeTab === 'terminal' && (
        <div className="space-y-6">
          {/* Active staff tiles */}
          <div>
            <h3 className="font-heading text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Currently On Shift ({openShifts.length} Active)</span>
            </h3>

            {openShifts.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                <Clock className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-xs text-slate-500">No staff members currently clocked in.</p>
                <button
                  onClick={() => setIsClockInModalOpen(true)}
                  className="mt-3 px-3 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg"
                >
                  Clock In Staff Member
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {openShifts.map((shift) => {
                  const inTime = new Date(shift.clock_in);
                  const durationHours = ((Date.now() - inTime.getTime()) / 3600000).toFixed(1);

                  return (
                    <div
                      key={shift.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-heading font-bold text-slate-900 block text-base">
                              {shift.staff_name}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 inline-block mt-0.5">
                              {shift.staff_role}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {durationHours} hrs
                          </span>
                        </div>

                        <div className="mt-3 space-y-1 text-xs text-slate-500">
                          <div>
                            Clocked in at:{' '}
                            <span className="font-mono font-medium text-slate-700">
                              {inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {shift.notes && (
                            <p className="text-[11px] text-slate-400 italic">Notes: {shift.notes}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Rate: ${shift.hourly_rate?.toFixed(2)}/hr</span>
                        <button
                          onClick={() => {
                            setClockOutShift(shift);
                            setClockOutBreakMins(shift.break_minutes.toString());
                          }}
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>Clock Out</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Roster Status Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="font-heading text-sm font-bold text-slate-900 mb-3">All Staff Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              {staffList.map((st) => {
                const isClocked = Boolean(st.current_shift_id);
                return (
                  <div
                    key={st.id}
                    className={`p-3 rounded-xl border text-center transition ${
                      isClocked
                        ? 'bg-emerald-50/60 border-emerald-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="font-bold text-slate-900 truncate">{st.name}</div>
                    <div className="text-[11px] text-slate-500 uppercase">{st.role}</div>
                    <div className="mt-2">
                      {isClocked ? (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          ON CLOCK
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            setClockInStaffId(st.id);
                            setIsClockInModalOpen(true);
                          }}
                          className="text-[10px] font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 px-2 py-0.5 rounded-full cursor-pointer"
                        >
                          Clock In
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TIP TRACKING & POOLING */}
      {activeTab === 'tips' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="font-heading text-base font-bold text-slate-900">
                Staff Tip Management & Pooling
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Track direct table order tips, cash jar drops, and run automated shift tip pooling across hours worked.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPoolModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-purple-900 text-white hover:bg-purple-800 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <PieChart className="w-3.5 h-3.5 text-amber-300" />
                <span>Distribute Tip Pool</span>
              </button>

              <button
                onClick={() => setIsTipModalOpen(true)}
                className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Record Tip Entry</span>
              </button>
            </div>
          </div>

          {/* Tip records table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Recipient Staff</th>
                  <th className="p-3.5">Amount</th>
                  <th className="p-3.5">Tip Category</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5">Notes / Order Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No tips recorded yet. Tips from completed orders and cash drops will appear here.
                    </td>
                  </tr>
                ) : (
                  tips.map((tip) => (
                    <tr key={tip.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-mono text-slate-600">{tip.date}</td>
                      <td className="p-3.5 font-bold text-slate-900">
                        {tip.staff_name || (
                          <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-semibold">
                            General Tip Pool
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono font-black text-amber-700 text-sm">
                        ${tip.amount.toFixed(2)}
                      </td>
                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {tip.tip_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-600 capitalize">
                        {tip.distribution_method.replace(/_/g, ' ')}
                      </td>
                      <td className="p-3.5 text-slate-500 max-w-sm truncate">{tip.notes || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: EXTERNAL PAYROLL EXPORT (ADP, GUSTO, QUICKBOOKS) */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Payroll summary metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block">Total Gross Payroll</span>
              <span className="font-mono text-2xl font-black text-slate-900">
                ${totalGrossPayroll.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Base Wages + Total Taxable Tips</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block">Total Regular Base Wages</span>
              <span className="font-mono text-2xl font-black text-slate-700">
                ${totalWages.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">{totalShiftHours.toFixed(1)} total hours</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block">Total Reported Tips</span>
              <span className="font-mono text-2xl font-black text-amber-600">
                ${totalTipsAll.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">Direct & pooled distributions</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 font-medium block">Export Pay Period</span>
              <span className="font-bold text-sm text-slate-800 block mt-1">
                {payrollFromDate} to {payrollToDate}
              </span>
              <span className="text-[11px] text-emerald-700 font-medium block mt-1">
                Standard format for ADP / Gusto
              </span>
            </div>
          </div>

          {/* Date Picker & Download CSV Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-700">Pay Period Date Range:</span>
              <input
                type="date"
                value={payrollFromDate}
                onChange={(e) => setPayrollFromDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium focus:ring-1 focus:ring-slate-900"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={payrollToDate}
                onChange={(e) => setPayrollToDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-mono font-medium focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <a
              id="btn-download-payroll-csv"
              href={api.getPayrollCsvUrl(payrollFromDate, payrollToDate)}
              download
              className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 transition cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
            >
              <Download className="w-4 h-4" />
              <span>Export Payroll CSV for External Systems</span>
            </a>
          </div>

          {/* Payroll calculation table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <span className="font-heading font-bold text-sm text-slate-900">
                Staff Payroll Breakdown by Employee
              </span>
              <span className="text-xs text-slate-500">
                Compatible with external payroll import templates
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3.5">Employee</th>
                    <th className="p-3.5">Job Role</th>
                    <th className="p-3.5">Hourly Rate</th>
                    <th className="p-3.5">Shifts</th>
                    <th className="p-3.5">Total Hours</th>
                    <th className="p-3.5">Base Wages ($)</th>
                    <th className="p-3.5">Direct Tips ($)</th>
                    <th className="p-3.5">Pooled Tips ($)</th>
                    <th className="p-3.5">Total Tips ($)</th>
                    <th className="p-3.5 font-bold text-slate-900">Gross Pay ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrollSummary.map((row) => (
                    <tr key={row.staff_id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3.5 font-bold text-slate-900">{row.staff_name}</td>
                      <td className="p-3.5 uppercase text-slate-600 text-[11px]">{row.role}</td>
                      <td className="p-3.5 font-mono text-slate-700">${row.hourly_rate.toFixed(2)}/hr</td>
                      <td className="p-3.5 font-mono text-slate-600">{row.shift_count}</td>
                      <td className="p-3.5 font-mono font-bold text-slate-800">{row.total_hours.toFixed(2)} hrs</td>
                      <td className="p-3.5 font-mono text-slate-700">${row.base_wages.toFixed(2)}</td>
                      <td className="p-3.5 font-mono text-slate-600">${row.direct_tips.toFixed(2)}</td>
                      <td className="p-3.5 font-mono text-purple-700 font-medium">${row.pooled_tips.toFixed(2)}</td>
                      <td className="p-3.5 font-mono font-bold text-amber-700">${row.total_tips.toFixed(2)}</td>
                      <td className="p-3.5 font-mono font-black text-slate-900 text-sm">
                        ${row.total_gross_pay.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: STAFF ROSTER */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900">Restaurant Staff Members</h3>
              <p className="text-xs text-slate-500">Manage roles, base compensation rates, and staff clock PINs.</p>
            </div>
            <button
              onClick={() => setIsStaffModalOpen(true)}
              className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Staff Member</span>
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Hourly Rate</th>
                  <th className="p-3.5">Clock PIN</th>
                  <th className="p-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-bold text-slate-900">{st.name}</td>
                    <td className="p-3.5 uppercase font-medium text-slate-600">{st.role}</td>
                    <td className="p-3.5 font-mono text-slate-800">${st.hourly_rate.toFixed(2)}/hr</td>
                    <td className="p-3.5 font-mono text-slate-500">••••</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLOCK IN MODAL */}
      {isClockInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="font-heading text-sm font-bold text-slate-900">Staff Clock-In Terminal</h3>
              </div>
              <button
                onClick={() => {
                  setIsClockInModalOpen(false);
                  if (onCloseQuickClockIn) onCloseQuickClockIn();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClockIn} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Select Staff Member</label>
                <select
                  value={clockInStaffId}
                  onChange={(e) => setClockInStaffId(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Enter 4-Digit PIN Code</label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="PIN code"
                  value={clockInPin}
                  onChange={(e) => setClockInPin(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono tracking-widest text-center text-base focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-400 block mt-1 text-center">
                  Default sample PIN: 1234, 2345, 9999
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Shift Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Lunch floor, Section A"
                  value={clockInNotes}
                  onChange={(e) => setClockInNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsClockInModalOpen(false);
                    if (onCloseQuickClockIn) onCloseQuickClockIn();
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 shadow-2xs"
                >
                  Clock In Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOCK OUT MODAL */}
      {clockOutShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-heading text-sm font-bold text-slate-900">
                Clock Out: {clockOutShift.staff_name}
              </h3>
              <button
                onClick={() => setClockOutShift(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleClockOut} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Clock In:</span>
                  <span className="font-mono">
                    {new Date(clockOutShift.clock_in).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Current Time:</span>
                  <span className="font-mono">{new Date().toLocaleTimeString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Unpaid Break Minutes (e.g. 30 min meal break)
                </label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={clockOutBreakMins}
                  onChange={(e) => setClockOutBreakMins(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">End of Shift Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Sidework completed, table 3 handed over"
                  value={clockOutNotes}
                  onChange={(e) => setClockOutNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setClockOutShift(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700"
                >
                  Confirm Clock Out
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD TIP ENTRY MODAL */}
      {isTipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-heading text-sm font-bold text-slate-900">Record Tip Entry</h3>
              <button
                onClick={() => setIsTipModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTip} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Staff Member</label>
                <select
                  value={tipStaffId}
                  onChange={(e) => setTipStaffId(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="">-- General / Pooled Tip --</option>
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tip Amount ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono font-bold text-base focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tip Category</label>
                <select
                  value={tipType}
                  onChange={(e) => setTipType(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="cash_drop">Cash Tip Jar Drop</option>
                  <option value="card_terminal_tip">Standalone Card Terminal Tip Slip</option>
                  <option value="direct_server">Direct Table Cash Tip</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Notes / Context</label>
                <input
                  type="text"
                  placeholder="e.g. End of night bar jar or patio split"
                  value={tipNotes}
                  onChange={(e) => setTipNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTipModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                >
                  Save Tip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TIP POOL DISTRIBUTION MODAL */}
      {isPoolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-4 bg-purple-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-amber-300" />
                <h3 className="font-heading text-sm font-bold">Automatic Tip Pool Distribution</h3>
              </div>
              <button
                onClick={() => setIsPoolModalOpen(false)}
                className="p-1.5 text-purple-200 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDistributePool} className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                This tool aggregates all staff shifts active on the selected date and splits the pool proportionally based on hours worked.
              </p>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Service Date</label>
                <input
                  type="date"
                  required
                  value={poolDate}
                  onChange={(e) => setPoolDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-purple-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Total Tip Pool Collected ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="e.g. 350.00"
                  value={poolAmount}
                  onChange={(e) => setPoolAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono font-bold text-lg focus:ring-2 focus:ring-purple-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pool Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Friday evening dinner rush tip pool"
                  value={poolNotes}
                  onChange={(e) => setPoolNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-purple-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPoolModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-900 text-white hover:bg-purple-800"
                >
                  Calculate & Distribute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-heading text-sm font-bold text-slate-900">Add Staff Member</h3>
              <button
                onClick={() => setIsStaffModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Lee"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Role</label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="server">Server</option>
                  <option value="bartender">Bartender</option>
                  <option value="line_cook">Line Cook</option>
                  <option value="head_chef">Head Chef</option>
                  <option value="host">Host / Hostess</option>
                  <option value="manager">Manager</option>
                  <option value="dishwasher">Dishwasher / Busser</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Base Hourly Rate ($/hr) *</label>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  required
                  placeholder="16.50"
                  value={staffForm.hourly_rate}
                  onChange={(e) => setStaffForm({ ...staffForm, hourly_rate: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">4-Digit Terminal PIN *</label>
                <input
                  type="text"
                  maxLength={4}
                  required
                  placeholder="1234"
                  value={staffForm.pin}
                  onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value })}
                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono text-center tracking-widest focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800"
                >
                  Add Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

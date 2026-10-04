import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  DollarSign,
  Clock,
  Users,
  Boxes,
  ArrowRight,
  ArrowLeft,
  Printer,
  Download,
  ShieldCheck,
  Calendar,
  CreditCard,
  Banknote,
  TrendingUp,
  FileText,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import {
  StaffMember,
  BusinessProfile,
  DailyCloseoutRecord,
  CloseoutPreviewData,
} from '../types.ts';
import { api } from '../lib/api.ts';

interface EndOfDayWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: StaffMember | null;
  profile: BusinessProfile | null;
  onCloseoutComplete?: () => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

export const EndOfDayWizardModal: React.FC<EndOfDayWizardModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  profile,
  onCloseoutComplete,
}) => {
  const [activeTab, setActiveTab] = useState<'wizard' | 'history'>('wizard');
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [previewData, setPreviewData] = useState<CloseoutPreviewData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [startingFloat, setStartingFloat] = useState<number>(200.0);
  const [actualCash, setActualCash] = useState<string>('');
  const [cashDrops, setCashDrops] = useState<number>(0);
  const [closeoutNotes, setCloseoutNotes] = useState<string>('');
  const [managerName, setManagerName] = useState<string>(currentUser?.name || 'Manager on Duty');

  // Settlement & Clock out in-progress state
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [completedRecord, setCompletedRecord] = useState<DailyCloseoutRecord | null>(null);

  // History state
  const [historyList, setHistoryList] = useState<DailyCloseoutRecord[]>([]);
  const [viewingHistoryRecord, setViewingHistoryRecord] = useState<DailyCloseoutRecord | null>(null);

  // Fetch preview data
  const loadPreview = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getCloseoutPreview();
      setPreviewData(data);
      if (data.salesSummary.cashSales !== undefined) {
        // Pre-fill expected cash count if actual cash is not yet entered
        const expected = startingFloat + data.salesSummary.cashSales - cashDrops;
        if (!actualCash) {
          setActualCash(expected.toFixed(2));
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load daily closeout preview data');
    } finally {
      setIsLoading(false);
    }
  }, [startingFloat, cashDrops, actualCash]);

  // Fetch history list
  const loadHistory = useCallback(async () => {
    try {
      const list = await api.getCloseoutHistory();
      setHistoryList(list);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadPreview();
      loadHistory();
      if (currentUser?.name) {
        setManagerName(currentUser.name);
      }
    }
  }, [isOpen, loadPreview, loadHistory, currentUser]);

  if (!isOpen) return null;

  // Step 1: Settle all open tickets
  const handleSettleAllOpen = async (method: 'cash' | 'card_terminal') => {
    setIsProcessingAction(true);
    setErrorMsg(null);
    try {
      const res = await api.settleOpenOrders(method, currentUser?.id);
      setSuccessMsg(res.message);
      await loadPreview();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to settle open tickets');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Step 2: Clock out all active staff
  const handleClockOutAllStaff = async () => {
    setIsProcessingAction(true);
    setErrorMsg(null);
    try {
      const res = await api.clockOutAllStaff();
      setSuccessMsg(res.message);
      await loadPreview();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to clock out staff');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Step 5: Finalize Closeout
  const handleFinalizeCloseout = async () => {
    if (!managerName.trim()) {
      setErrorMsg('Please enter the closing manager name for official sign-off');
      return;
    }

    setIsProcessingAction(true);
    setErrorMsg(null);
    try {
      const numActual = parseFloat(actualCash) || 0;
      const res = await api.finalizeCloseout({
        closeout_date: previewData?.date,
        closed_by_staff_id: currentUser?.id,
        closed_by_staff_name: managerName.trim(),
        starting_float: startingFloat,
        actual_cash: numActual,
        notes: closeoutNotes.trim(),
      });

      setCompletedRecord(res.closeout);
      setSuccessMsg(`Z-Report #${res.zReportNumber} generated successfully. Business day closed!`);
      if (onCloseoutComplete) {
        onCloseoutComplete();
      }
      await loadHistory();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to finalize End-of-Day closeout');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Printable Z-Report Slip Generator
  const handlePrintZReport = () => {
    window.print();
  };

  // Download Z-Report text summary
  const handleDownloadZReport = (record: DailyCloseoutRecord) => {
    const textContent = `
========================================
       ${profile?.business_name || 'THE RUSTIC BISTRO'}
       OFFICIAL DAILY CLOSEOUT Z-REPORT
========================================
Z-Report #: ${record.z_report_number}
Date: ${record.closeout_date}
Generated: ${new Date(record.created_at).toLocaleString()}
Closing Manager: ${record.closed_by_staff_name}
Address: ${profile?.address || '124 Main Street • Downtown'}
Phone: ${profile?.phone || '(555) 234-8900'}

----------------------------------------
1. SALES & REVENUE RECONCILIATION
----------------------------------------
Gross Sales:        $${record.gross_sales.toFixed(2)}
Net Sales:          $${record.net_sales.toFixed(2)}
Sales Tax (8.25%):  $${record.tax_collected.toFixed(2)}
Total Tips:         $${record.tips_collected.toFixed(2)}
Total Paid Orders:  ${record.orders_count}

Payment Method Breakdown:
  Cash Sales:       $${record.cash_sales.toFixed(2)}
  Card Terminal:    $${record.card_sales.toFixed(2)}

----------------------------------------
2. CASH DRAWER AUDIT
----------------------------------------
Starting Float:     $${record.starting_float.toFixed(2)}
Cash Sales Added:   $${record.cash_sales.toFixed(2)}
Expected in Drawer: $${record.expected_cash.toFixed(2)}
Actual Cash Count:  $${record.actual_cash.toFixed(2)}
CASH OVER / SHORT:  ${record.cash_variance >= 0 ? '+' : ''}$${record.cash_variance.toFixed(2)} (${record.cash_variance === 0 ? 'BALANCED' : record.cash_variance > 0 ? 'OVER' : 'SHORT'})

----------------------------------------
3. OPERATIONAL & PRIME COSTS
----------------------------------------
Food COGS Depleted: $${record.cogs_total.toFixed(2)}
Total Labor Hours:  ${record.labor_hours.toFixed(1)} hrs

Closing Notes:
${record.notes || 'None recorded'}

========================================
SIGNATURE & VERIFICATION
Manager Signature: _____________________
Date Signed: ${record.closeout_date}
========================================
`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Z-Report-${record.z_report_number}-${record.closeout_date}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Calculations for step 3 cash drawer
  const expectedCash = startingFloat + (previewData?.salesSummary.cashSales || 0) - cashDrops;
  const numActualCash = parseFloat(actualCash) || 0;
  const cashVariance = Math.round((numActualCash - expectedCash) * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold text-slate-900 dark:text-white">
                  End-of-Day Closeout Wizard
                </h2>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  Daily Z-Report
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile?.business_name || 'The Rustic Bistro'} &bull; Daily Sales & Floor Reconciliation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Close Wizard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection: Wizard vs History */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveTab('wizard')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'wizard'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Closeout Routine ({previewData?.date || 'Today'})</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Z-Report History & Past Audits ({historyList.length})</span>
          </button>
        </div>

        {/* Alerts / Error & Success banners */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 text-xs font-bold">
              Dismiss
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 text-xs font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 mx-auto text-amber-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                Auditing daily tickets, staff shifts, and perpetual inventory...
              </p>
            </div>
          ) : activeTab === 'history' ? (
            /* HISTORY TAB */
            <div className="space-y-6">
              {viewingHistoryRecord ? (
                /* Detail / Print View of historical Z-Report */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setViewingHistoryRecord(null)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to History List
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDownloadZReport(viewingHistoryRecord)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-500" />
                        Download Text
                      </button>
                      <button
                        onClick={handlePrintZReport}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs border border-transparent dark:border-slate-600"
                      >
                        <Printer className="w-3.5 h-3.5 text-amber-400" />
                        Print Z-Report
                      </button>
                    </div>
                  </div>

                  {/* Styled Thermal Slip */}
                  <div className="max-w-md mx-auto p-6 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl font-mono text-xs shadow-md space-y-4 text-slate-800 dark:text-slate-200 print:shadow-none print:border-none">
                    <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-4">
                      <h3 className="font-bold text-sm uppercase text-slate-900 dark:text-white">
                        {profile?.business_name || 'THE RUSTIC BISTRO'}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {profile?.address || '124 Main Street • Downtown'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {profile?.phone || '(555) 234-8900'}
                      </p>
                      <div className="mt-3 inline-block px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-sm font-bold text-[11px] text-slate-800 dark:text-slate-200">
                        OFFICIAL Z-REPORT #{viewingHistoryRecord.z_report_number}
                      </div>
                    </div>

                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span>Date:</span>
                        <span className="font-bold">{viewingHistoryRecord.closeout_date}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Closing Manager:</span>
                        <span className="font-bold">{viewingHistoryRecord.closed_by_staff_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Closed At:</span>
                        <span>{new Date(viewingHistoryRecord.created_at).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Orders Settled:</span>
                        <span>{viewingHistoryRecord.orders_count} tickets</span>
                      </div>
                    </div>

                    <div className="border-t border-b border-dashed border-slate-300 dark:border-slate-700 py-3 space-y-1.5">
                      <div className="flex justify-between font-bold text-slate-900 dark:text-white text-xs">
                        <span>GROSS SALES</span>
                        <span>${viewingHistoryRecord.gross_sales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Net Sales (Subtotal)</span>
                        <span>${viewingHistoryRecord.net_sales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Sales Tax Collected</span>
                        <span>${viewingHistoryRecord.tax_collected.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                        <span>Total Tips</span>
                        <span>${viewingHistoryRecord.tips_collected.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-800">
                        <span>Cash Payments:</span>
                        <span>${viewingHistoryRecord.cash_sales.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Card Payments:</span>
                        <span>${viewingHistoryRecord.card_sales.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span>Starting Float:</span>
                        <span>${viewingHistoryRecord.starting_float.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Expected Cash in Drawer:</span>
                        <span>${viewingHistoryRecord.expected_cash.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                        <span>Actual Cash Counted:</span>
                        <span>${viewingHistoryRecord.actual_cash.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span>Cash Over / Short:</span>
                        <span
                          className={
                            viewingHistoryRecord.cash_variance === 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : viewingHistoryRecord.cash_variance > 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-red-600 dark:text-red-400'
                          }
                        >
                          {viewingHistoryRecord.cash_variance >= 0 ? '+' : ''}$
                          {viewingHistoryRecord.cash_variance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Prime Cost (Food COGS):</span>
                        <span>${viewingHistoryRecord.cogs_total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Staff Labor Logged:</span>
                        <span>{viewingHistoryRecord.labor_hours.toFixed(1)} hrs</span>
                      </div>
                      {viewingHistoryRecord.notes && (
                        <div className="pt-2 text-[10px] italic">
                          Notes: {viewingHistoryRecord.notes}
                        </div>
                      )}
                    </div>

                    <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500">
                      AUDIT LOG &bull; SIGNED BY {viewingHistoryRecord.closed_by_staff_name.toUpperCase()}
                    </div>
                  </div>
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                    No Daily Closeouts Recorded Yet
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Complete today's 5-step closeout routine in the Wizard tab to record your first official Z-Report.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Showing past {historyList.length} End-of-Day Z-Reports
                    </span>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-3">Z-Report #</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Manager</th>
                          <th className="p-3 text-right">Gross Sales</th>
                          <th className="p-3 text-right">Tips</th>
                          <th className="p-3 text-right">Cash Over/Short</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {historyList.map((rec) => (
                          <tr
                            key={rec.id}
                            className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                          >
                            <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                              #{rec.z_report_number}
                            </td>
                            <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                              {rec.closeout_date}
                            </td>
                            <td className="p-3 text-slate-600 dark:text-slate-400">
                              {rec.closed_by_staff_name}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                              ${rec.gross_sales.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono text-emerald-700 dark:text-emerald-400">
                              ${rec.tips_collected.toFixed(2)}
                            </td>
                            <td className="p-3 text-right font-mono font-semibold">
                              <span
                                className={
                                  rec.cash_variance === 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : rec.cash_variance > 0
                                    ? 'text-blue-600 dark:text-blue-400'
                                    : 'text-red-600 dark:text-red-400'
                                }
                              >
                                {rec.cash_variance >= 0 ? '+' : ''}${rec.cash_variance.toFixed(2)}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => setViewingHistoryRecord(rec)}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold transition cursor-pointer"
                              >
                                View Slip
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* WIZARD TAB */
            <div className="space-y-6">
              {/* Step Progress Tracker */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                {[
                  { num: 1, label: 'Tickets Audit' },
                  { num: 2, label: 'Staff Clock-Out' },
                  { num: 3, label: 'Cash Drawer' },
                  { num: 4, label: 'Prime Costs & Sales' },
                  { num: 5, label: 'Z-Report Sign-off' },
                ].map((st) => (
                  <button
                    key={st.num}
                    onClick={() => setCurrentStep(st.num as WizardStep)}
                    className={`flex items-center gap-2 group transition cursor-pointer ${
                      currentStep === st.num
                        ? 'text-amber-600 dark:text-amber-400 font-bold'
                        : currentStep > st.num
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-slate-400 dark:text-slate-500 font-normal'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                        currentStep === st.num
                          ? 'bg-amber-500 text-slate-950 shadow-xs'
                          : currentStep > st.num
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {currentStep > st.num ? '✓' : st.num}
                    </div>
                    <span className="hidden md:inline text-xs">{st.label}</span>
                  </button>
                ))}
              </div>

              {/* STEP 1: OPEN TICKETS AUDIT */}
              {currentStep === 1 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        Step 1: Open Tickets & Active Floor Audit
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        All dining room tables, bar tabs, and takeout tickets must be settled or voided before closing the day.
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          previewData?.openOrdersCount === 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                        }`}
                      >
                        {previewData?.openOrdersCount === 0 ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Floor Cleared (0 Open)</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>{previewData?.openOrdersCount} Open Tickets</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {previewData?.openOrdersCount === 0 ? (
                    <div className="p-8 text-center bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">
                        All Guest Tickets Are Settled & Closed
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        No unpaid orders remain open on the floor or bar tabs. Perpetual inventory consumption has been logged for all orders.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
                        <div>
                          <p className="font-bold">
                            Action Required: {previewData?.openOrdersCount} active tickets need closure.
                          </p>
                          <p className="text-amber-700 dark:text-amber-300 text-[11px] mt-0.5">
                            You can bulk-settle remaining orders right here, or close them manually.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            disabled={isProcessingAction}
                            onClick={() => handleSettleAllOpen('cash')}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            Auto-Settle All (Cash)
                          </button>
                          <button
                            disabled={isProcessingAction}
                            onClick={() => handleSettleAllOpen('card_terminal')}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-2xs border border-transparent dark:border-slate-600"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                            Auto-Settle All (Card)
                          </button>
                        </div>
                      </div>

                      {/* Open orders list */}
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                            <tr>
                              <th className="p-3">Ticket</th>
                              <th className="p-3">Table</th>
                              <th className="p-3">Server</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Subtotal</th>
                              <th className="p-3 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {previewData?.openOrders.map((ord) => (
                              <tr key={ord.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                                  #{ord.order_number}
                                </td>
                                <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                                  {ord.table_number}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-400">
                                  {ord.server_name || 'Unassigned'}
                                </td>
                                <td className="p-3">
                                  <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                    {ord.status}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                                  ${ord.subtotal.toFixed(2)}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                  ${ord.total.toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Navigation footer */}
                  <div className="pt-4 flex justify-end">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-600 transition cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      <span>Proceed to Step 2: Staff Clock-Out</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: STAFF CLOCK-OUT & SHIFTS */}
              {currentStep === 2 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-amber-500" />
                        Step 2: Staff Clock-Out & Shift Reconciliation
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Ensure all hourly employees (servers, bartenders, kitchen team) are clocked out for accurate payroll.
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          previewData?.activeStaffCount === 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            : 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                        }`}
                      >
                        {previewData?.activeStaffCount === 0 ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>All Staff Clocked Out</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>{previewData?.activeStaffCount} Staff on Duty</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {previewData?.activeStaffCount === 0 ? (
                    <div className="p-8 text-center bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-2xl space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h4 className="font-heading font-bold text-sm text-slate-800 dark:text-slate-100">
                        All Staff Members Are Clocked Out
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        Total {previewData?.staffSummary.totalHoursWorked.toFixed(1)} hours logged today across all positions. Estimated daily labor cost: ${previewData?.staffSummary.estimatedLaborCost.toFixed(2)}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200">
                        <div>
                          <p className="font-bold">
                            {previewData?.activeStaffCount} team members are still on the active terminal clock.
                          </p>
                          <p className="text-blue-700 dark:text-blue-300 text-[11px] mt-0.5">
                            Clock out all staff members with a single click to conclude the shift.
                          </p>
                        </div>
                        <button
                          disabled={isProcessingAction}
                          onClick={handleClockOutAllStaff}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-2xs shrink-0"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Clock Out All Active Staff
                        </button>
                      </div>

                      {/* Active shifts list */}
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                            <tr>
                              <th className="p-3">Staff Member</th>
                              <th className="p-3">Role / Title</th>
                              <th className="p-3">Clock-In Time</th>
                              <th className="p-3 text-right">Hours on Duty</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {previewData?.activeShifts.map((sh) => (
                              <tr key={sh.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                <td className="p-3 font-bold text-slate-900 dark:text-white">
                                  {sh.staff_name}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-400 uppercase text-[11px]">
                                  {sh.staff_title}
                                </td>
                                <td className="p-3 text-slate-600 dark:text-slate-400">
                                  {new Date(sh.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                                  {sh.current_hours} hrs
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Navigation footer */}
                  <div className="pt-4 flex justify-between">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-600 transition cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      <span>Proceed to Step 3: Cash Drawer Count</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: CASH DRAWER & FLOAT AUDIT */}
              {currentStep === 3 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <Banknote className="w-5 h-5 text-amber-500" />
                        Step 3: Cash Drawer & Float Balancing
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Count physical cash in the drawer and compare against system-expected sales.
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          cashVariance === 0
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                            : cashVariance > 0
                            ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                            : 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700'
                        }`}
                      >
                        {cashVariance === 0 ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Drawer Balanced ($0.00)</span>
                          </>
                        ) : cashVariance > 0 ? (
                          <>
                            <span>Over: +${cashVariance.toFixed(2)}</span>
                          </>
                        ) : (
                          <>
                            <span>Short: -${Math.abs(cashVariance).toFixed(2)}</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Expected Calculation Breakdown */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3.5 text-xs">
                      <h4 className="font-heading font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                        System Expected Cash Formula
                      </h4>

                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span>Starting Float (Bank in Drawer):</span>
                        <div className="flex items-center gap-1">
                          <span>$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={startingFloat}
                            onChange={(e) => setStartingFloat(parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-right font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-slate-600 dark:text-slate-400">
                        <span>Today's Cash Orders Recorded:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          +${(previewData?.salesSummary.cashSales || 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                        <span>Mid-day Safe Drops / Payouts:</span>
                        <div className="flex items-center gap-1">
                          <span>-$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={cashDrops}
                            onChange={(e) => setCashDrops(parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 text-right font-mono font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center font-bold text-sm">
                        <span className="text-slate-900 dark:text-white">Total Expected in Drawer:</span>
                        <span className="font-mono text-base text-amber-600 dark:text-amber-400">
                          ${expectedCash.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Actual Physical Cash Count Form */}
                    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
                      <h4 className="font-heading font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                        Physical Count Entry
                      </h4>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Actual Total Cash Counted ($)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={actualCash}
                            onChange={(e) => setActualCash(e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-8 pr-4 py-2.5 text-base font-mono font-bold bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          Enter the full dollar amount of all bills and coins currently in the till.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Drawer / Safe Drop Bag Notes
                        </label>
                        <textarea
                          rows={2}
                          value={closeoutNotes}
                          onChange={(e) => setCloseoutNotes(e.target.value)}
                          placeholder="e.g. Deposit bag #449 sealed for night safe deposit; $200 float returned to register till."
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Navigation footer */}
                  <div className="pt-4 flex justify-between">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={() => setCurrentStep(4)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-600 transition cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      <span>Proceed to Step 4: Sales & Prime Costs</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: SALES, PRIME COSTS & INVENTORY */}
              {currentStep === 4 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                        Step 4: Prime Costs, Food Cost % & Inventory Review
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Audit perpetual inventory consumption, prime cost driver margins, and low stock warnings for tomorrow.
                      </p>
                    </div>
                  </div>

                  {/* 4 Stat Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                        Gross Sales
                      </span>
                      <div className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-1">
                        ${(previewData?.salesSummary.grossSales || 0).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        {previewData?.salesSummary.orderCount} paid orders
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                        Food Cost (COGS)
                      </span>
                      <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                        ${(previewData?.primeCostSummary.totalCogs || 0).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Recipe drivers depleted
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                        Food Cost Ratio
                      </span>
                      <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {(previewData?.primeCostSummary.foodCostPercent || 0).toFixed(1)}%
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Target benchmark: 28-32%
                      </span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold">
                        Tips Collected
                      </span>
                      <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                        ${(previewData?.tipsSummary.totalTips || 0).toFixed(2)}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Card: ${(previewData?.tipsSummary.cardTips || 0).toFixed(2)} &bull; Cash: ${(previewData?.tipsSummary.cashTips || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Low Stock Warnings for Tomorrow */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-amber-500" />
                        <h4 className="font-heading font-bold text-xs uppercase text-slate-900 dark:text-white">
                          Inventory Warnings For Tomorrow's Prep
                        </h4>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                        {previewData?.lowStockItems.length || 0} low stock items
                      </span>
                    </div>

                    {previewData?.lowStockItems.length === 0 ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                        All perpetual inventory items are currently above their safety reorder thresholds.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                        {previewData?.lowStockItems.slice(0, 6).map((item) => (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 flex justify-between items-center"
                          >
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{item.name}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                Supplier: {item.supplier || 'Local Distributor'}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                                {item.current_stock} {item.unit}
                              </span>
                              <p className="text-[10px] text-slate-400">Min: {item.min_threshold}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Navigation footer */}
                  <div className="pt-4 flex justify-between">
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      onClick={() => setCurrentStep(5)}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 border border-transparent dark:border-slate-600 transition cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      <span>Proceed to Step 5: Final Z-Report Sign-off</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: FINAL Z-REPORT SIGN-OFF */}
              {currentStep === 5 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-amber-500" />
                        Step 5: Z-Report Verification & Final Manager Sign-Off
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Sign off on the daily closeout to generate the official immutable Z-Report record.
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
                        Z-Report #{previewData?.nextZReportNumber}
                      </span>
                    </div>
                  </div>

                  {completedRecord ? (
                    /* Success screen after finalizing */
                    <div className="p-8 text-center bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-2xl space-y-4">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                          Business Day Successfully Closed & Audited!
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto mt-1">
                          Official Z-Report #{completedRecord.z_report_number} for {completedRecord.closeout_date} has been saved to the permanent database.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                        <button
                          onClick={() => handleDownloadZReport(completedRecord)}
                          className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-2xs text-slate-800 dark:text-slate-200"
                        >
                          <Download className="w-4 h-4 text-amber-500" />
                          Download Z-Report (.txt)
                        </button>
                        <button
                          onClick={handlePrintZReport}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white border border-transparent dark:border-slate-600 text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-2xs"
                        >
                          <Printer className="w-4 h-4 text-amber-400" />
                          Print Z-Report Slip
                        </button>
                        <button
                          onClick={onClose}
                          className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-xs border border-amber-600/30"
                        >
                          Done & Exit Wizard
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Final Sign-Off Form */
                    <div className="space-y-5">
                      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-4">
                        <h4 className="font-heading font-bold text-xs uppercase text-slate-900 dark:text-white">
                          Manager Sign-Off Verification
                        </h4>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Closing Manager / Admin Name
                            </label>
                            <input
                              type="text"
                              value={managerName}
                              onChange={(e) => setManagerName(e.target.value)}
                              placeholder="Your full name"
                              className="w-full px-3 py-2 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Closeout Date
                            </label>
                            <div className="px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-500" />
                              <span>{previewData?.date || 'Today'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Financial summary verification pill */}
                        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Gross Sales</span>
                            <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                              ${(previewData?.salesSummary.grossSales || 0).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Total Tips</span>
                            <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              ${(previewData?.tipsSummary.totalTips || 0).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Cash Counted</span>
                            <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                              ${numActualCash.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-slate-400 text-[11px]">Drawer Discrepancy</span>
                            <p
                              className={`font-mono font-bold mt-0.5 ${
                                cashVariance === 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : cashVariance > 0
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {cashVariance >= 0 ? '+' : ''}${cashVariance.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Navigation footer */}
                      <div className="pt-4 flex justify-between items-center">
                        <button
                          onClick={() => setCurrentStep(4)}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 transition cursor-pointer flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>

                        <button
                          disabled={isProcessingAction}
                          onClick={handleFinalizeCloseout}
                          className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 transition cursor-pointer disabled:opacity-50 flex items-center gap-2 shadow-md border border-amber-600/30"
                        >
                          {isProcessingAction ? (
                            <span>Generating Z-Report & Closing...</span>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4 text-slate-950" />
                              <span>Finalize & Sign Off Daily Closeout</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

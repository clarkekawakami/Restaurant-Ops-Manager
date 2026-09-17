import React, { useState, useEffect } from 'react';
import { ShieldAlert, Lock, X, Check, AlertCircle } from 'lucide-react';
import { StaffMember } from '../types.ts';
import { api } from '../lib/api.ts';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (authenticatedAdmin: StaffMember) => void;
  title?: string;
  description?: string;
  adminStaffList: StaffMember[];
}

export function AdminAuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Administrator Access Required',
  description = 'Please select an administrator and enter their 4-digit PIN to proceed.',
  adminStaffList,
}: AdminAuthModalProps) {
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setErrorMessage(null);
      // Auto-select first admin if available
      if (adminStaffList.length > 0) {
        setSelectedStaffId(adminStaffList[0].id);
      } else {
        setSelectedStaffId('');
      }
    }
  }, [isOpen, adminStaffList]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedStaffId) {
      setErrorMessage('Please select an administrator from the list.');
      return;
    }

    if (!pin || pin.trim().length === 0) {
      setErrorMessage('Please enter the 4-digit PIN for the selected administrator.');
      return;
    }

    const selectedStaff = adminStaffList.find((s) => s.id === selectedStaffId);
    if (!selectedStaff) {
      setErrorMessage('Selected administrator is invalid or inactive.');
      return;
    }

    setIsVerifying(true);
    try {
      // Direct local verification with API verification fallback
      if (selectedStaff.pin && selectedStaff.pin === pin.trim()) {
        setIsVerifying(false);
        onSuccess(selectedStaff);
        onClose();
        return;
      }

      // Try server verify-admin endpoint
      const result = await api.verifyAdmin(selectedStaffId, pin.trim());
      setIsVerifying(false);
      if (result.success && result.staff) {
        onSuccess(result.staff);
        onClose();
      } else {
        setErrorMessage(`Invalid PIN for ${selectedStaff.name}. Access denied.`);
        setPin('');
      }
    } catch (err: any) {
      setIsVerifying(false);
      setErrorMessage(
        err.message || `Invalid PIN for ${selectedStaff.name}. Administrator authorization failed.`
      );
      setPin('');
    }
  };

  const selectedStaff = adminStaffList.find((s) => s.id === selectedStaffId);

  return (
    <div
      id="modal-admin-auth-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="modal-admin-auth"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>{title}</span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">{description}</p>
            </div>
          </div>
          <button
            id="btn-admin-modal-close"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMessage && (
            <div
              id="admin-auth-error-message"
              className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2.5 animate-shake"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium text-xs leading-relaxed">
                {errorMessage}
              </div>
            </div>
          )}

          {adminStaffList.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800">
              <p className="font-semibold">No administrator staff members found.</p>
              <p className="text-[11px] text-amber-700 mt-1">
                At least one staff member must have admin_access set to true.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="admin-staff-select"
                  className="block text-slate-700 font-semibold mb-1.5"
                >
                  Authorized Administrator *
                </label>
                <div className="relative">
                  <select
                    id="admin-staff-select"
                    value={selectedStaffId}
                    onChange={(e) => {
                      setSelectedStaffId(e.target.value);
                      setErrorMessage(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-medium text-xs focus:ring-2 focus:ring-slate-900 focus:bg-white focus:outline-hidden transition"
                  >
                    {adminStaffList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} — {st.title.toUpperCase()} (Admin)
                      </option>
                    ))}
                  </select>
                </div>
                {selectedStaff && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Verifying credentials for <strong className="text-slate-700">{selectedStaff.name}</strong> ({selectedStaff.title}).
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="admin-pin-input"
                    className="block text-slate-700 font-semibold"
                  >
                    Admin PIN Code *
                  </label>
                  <span className="text-[11px] text-slate-400">4-digit security PIN</span>
                </div>
                <div className="relative">
                  <input
                    id="admin-pin-input"
                    type="password"
                    maxLength={6}
                    autoFocus
                    autoComplete="off"
                    required
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-mono text-center tracking-widest text-base font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:bg-white focus:outline-hidden transition"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              id="btn-admin-cancel"
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-admin-verify"
              type="submit"
              disabled={isVerifying || adminStaffList.length === 0}
              className="px-5 py-2.5 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{isVerifying ? 'Verifying...' : 'Verify PIN & Unlock'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

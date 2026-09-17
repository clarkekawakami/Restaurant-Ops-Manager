import React, { useState } from 'react';
import { Users, Lock, X, Check, ShieldCheck, UserCheck, AlertCircle } from 'lucide-react';
import { StaffMember } from '../types.ts';

interface SwitchUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  currentUserId?: string;
  onSelectUser: (staff: StaffMember) => void;
}

export function SwitchUserModal({
  isOpen,
  onClose,
  staffList,
  currentUserId,
  onSelectUser,
}: SwitchUserModalProps) {
  const [selectedId, setSelectedId] = useState<string>(currentUserId || staffList[0]?.id || '');
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const staff = staffList.find((s) => s.id === selectedId);
    if (!staff) {
      setError('Please select a staff member.');
      return;
    }

    if (!pin) {
      setError('Please enter your 4-digit PIN.');
      return;
    }

    if (staff.pin !== pin.trim()) {
      setError(`Invalid PIN for ${staff.name}.`);
      setPin('');
      return;
    }

    onSelectUser(staff);
    onClose();
  };

  const selectedStaff = staffList.find((s) => s.id === selectedId);

  return (
    <div
      id="modal-switch-user-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="modal-switch-user"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200"
      >
        <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <h3 className="font-heading text-sm font-bold">Switch Active Terminal User</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Select Staff Member
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50">
              {staffList.map((st) => {
                const isCurrent = st.id === selectedId;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(st.id);
                      setError(null);
                    }}
                    className={`w-full p-2 rounded-lg flex items-center justify-between text-left transition cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isCurrent ? 'bg-slate-800 text-amber-400' : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {st.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-xs">{st.name}</div>
                        <div
                          className={`text-[10px] uppercase font-medium ${
                            isCurrent ? 'text-slate-300' : 'text-slate-500'
                          }`}
                        >
                          {st.title}
                        </div>
                      </div>
                    </div>
                    {st.admin_access ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          isCurrent
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Admin
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          isCurrent ? 'text-slate-400' : 'text-slate-400'
                        }`}
                      >
                        Staff
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Enter 4-Digit PIN for {selectedStaff?.name || 'Staff'}
            </label>
            <div className="relative">
              <input
                type="password"
                maxLength={6}
                required
                placeholder="••••"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  if (error) setError(null);
                }}
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-300 font-mono text-center tracking-widest text-sm font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
              <Lock className="w-3.5 h-3.5 absolute right-3 top-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Set as Current User</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  CheckCircle2,
  Receipt,
  DollarSign,
  Calculator,
} from 'lucide-react';
import { Order, StaffMember } from '../types.ts';

interface PaymentModalProps {
  order: Order;
  staffList: StaffMember[];
  onClose: () => void;
  onPaymentSuccess: (paidOrder: Order) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  order,
  staffList,
  onClose,
  onPaymentSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card_terminal'>('card_terminal');
  const [tipPercentage, setTipPercentage] = useState<number | null>(18);
  const [customTip, setCustomTip] = useState<string>('');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [terminalStation, setTerminalStation] = useState<string>('Terminal 1 - Main Station');
  const [authCode, setAuthCode] = useState<string>('');
  const [cardBrand, setCardBrand] = useState<string>('Visa');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const subtotal = order.subtotal;
  const tax = order.tax;

  // Calculate tip
  let calculatedTip = 0;
  if (tipPercentage !== null) {
    calculatedTip = Math.round(subtotal * (tipPercentage / 100) * 100) / 100;
  } else if (customTip) {
    calculatedTip = Math.max(0, Number(customTip) || 0);
  }

  const grandTotal = Math.round((subtotal + tax + calculatedTip) * 100) / 100;

  // Cash change due calculation
  const tenderedNum = Number(cashTendered) || 0;
  const changeDue = tenderedNum >= grandTotal ? Math.round((tenderedNum - grandTotal) * 100) / 100 : 0;

  const handleSelectTipPercent = (pct: number | null) => {
    setTipPercentage(pct);
    setCustomTip('');
  };

  const handleCustomTipChange = (val: string) => {
    setCustomTip(val);
    setTipPercentage(null);
  };

  const handleQuickCash = (amount: number) => {
    setCashTendered(amount.toFixed(2));
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (paymentMethod === 'cash') {
      if (tenderedNum < grandTotal) {
        setErrorMessage(`Cash tendered ($${tenderedNum.toFixed(2)}) is less than grand total ($${grandTotal.toFixed(2)})`);
        return;
      }
    }

    if (paymentMethod === 'card_terminal') {
      if (!authCode.trim()) {
        setErrorMessage('Please enter the Authorization/Reference # from the standalone terminal slip.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let notes = '';
      if (paymentMethod === 'card_terminal') {
        notes = `${terminalStation} | ${cardBrand} | Auth Ref: ${authCode.trim()} ${paymentNotes ? '| ' + paymentNotes : ''}`;
      } else {
        notes = paymentNotes || 'Cash transaction complete';
      }

      const res = await fetch(`/api/orders/${order.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_method: paymentMethod,
          payment_notes: notes,
          tip_amount: calculatedTip,
          cash_tendered: paymentMethod === 'cash' ? tenderedNum : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Payment failed');
      }

      const updatedOrder = await res.json();
      onPaymentSuccess(updatedOrder);
    } catch (err: any) {
      setErrorMessage(err.message || 'Payment processing failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-slate-700" />
              <h2 className="font-heading text-lg font-bold text-slate-900">
                Checkout: Order #{order.order_number}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {order.table_number} &bull; {order.guest_count} {order.guest_count === 1 ? 'Guest' : 'Guests'} &bull; Server: {order.server_name || 'Unassigned'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitPayment} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="p-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl">
              {errorMessage}
            </div>
          )}

          {/* Amount Breakdown */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal ({order.items.length} items)</span>
              <span className="font-mono font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax (8.25%)</span>
              <span className="font-mono font-medium">${tax.toFixed(2)}</span>
            </div>

            {/* Tip Selection */}
            <div className="pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Add Staff Tip</span>
                <span className="font-mono font-bold text-slate-900">${calculatedTip.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { label: 'None', val: null },
                  { label: '15%', val: 15 },
                  { label: '18%', val: 18 },
                  { label: '20%', val: 20 },
                  { label: '25%', val: 25 },
                ].map((t) => {
                  const isSelected = tipPercentage === t.val && !customTip;
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => handleSelectTipPercent(t.val)}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition cursor-pointer text-center ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500 whitespace-nowrap">Or custom tip:</span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2 text-xs text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={customTip}
                    onChange={(e) => handleCustomTipChange(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 text-xs bg-white rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Grand Total */}
            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="font-heading text-base font-bold text-slate-900">Total Due</span>
              <span className="font-mono text-2xl font-black text-slate-900">${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Payment Method (Stand-alone or Cash)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="select-method-card"
                onClick={() => setPaymentMethod('card_terminal')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition cursor-pointer text-center ${
                  paymentMethod === 'card_terminal'
                    ? 'border-slate-900 bg-slate-900/5 text-slate-900 ring-2 ring-slate-900/10'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <CreditCard className="w-6 h-6 mb-1.5 text-slate-800" />
                <span className="text-xs font-bold">Standalone Card Terminal</span>
                <span className="text-[11px] text-slate-500">Physical terminal station</span>
              </button>

              <button
                type="button"
                id="select-method-cash"
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition cursor-pointer text-center ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-600/10'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <Banknote className="w-6 h-6 mb-1.5 text-emerald-700" />
                <span className="text-xs font-bold">Cash Tender</span>
                <span className="text-[11px] text-slate-500">Drawer & change calculator</span>
              </button>
            </div>
          </div>

          {/* Standalone Card Station Details */}
          {paymentMethod === 'card_terminal' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <CreditCard className="w-4 h-4 text-slate-500" />
                <span>Physical Terminal Details (Independent Credit Card Reader)</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Terminal Station</label>
                  <select
                    value={terminalStation}
                    onChange={(e) => setTerminalStation(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  >
                    <option value="Terminal 1 - Main Station">Terminal 1 - Main Station</option>
                    <option value="Terminal 2 - Bar Station">Terminal 2 - Bar Station</option>
                    <option value="Terminal 3 - Patio Handheld">Terminal 3 - Patio Handheld</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Card Brand</label>
                  <select
                    value={cardBrand}
                    onChange={(e) => setCardBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  >
                    <option value="Visa">Visa</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="American Express">American Express</option>
                    <option value="Discover">Discover</option>
                    <option value="Debit">Debit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Authorization / Reference # (from terminal receipt) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AUTH-84920 or REF-1092"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                />
              </div>

              <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded-lg border border-slate-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Swipe, insert chip, or tap card on your countertop terminal, verify approval on the terminal screen, then record the approval reference code here.</span>
              </div>
            </div>
          )}

          {/* Cash Payment Details */}
          {paymentMethod === 'cash' && (
            <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900">
                <Calculator className="w-4 h-4 text-emerald-700" />
                <span>Cash Tender & Change Calculator</span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Cash Tendered by Guest</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min={grandTotal}
                    required
                    placeholder={grandTotal.toFixed(2)}
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden font-mono font-bold"
                  />
                </div>
              </div>

              {/* Quick Cash Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickCash(grandTotal)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                >
                  Exact (${grandTotal.toFixed(2)})
                </button>
                {[20, 40, 50, 60, 80, 100].map((amt) => {
                  if (amt < grandTotal && amt !== 100) return null;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleQuickCash(amt)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      ${amt}.00
                    </button>
                  );
                })}
              </div>

              {/* Live Change Due Alert */}
              <div className="bg-white p-3 rounded-xl border border-emerald-300 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">Change Due to Customer</span>
                  <span className="text-[11px] text-slate-400">Tendered: ${tenderedNum.toFixed(2)}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono text-2xl font-black text-emerald-700">
                    ${changeDue.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Optional notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Additional Transaction Notes</label>
            <input
              type="text"
              placeholder="e.g. Split cash/card, customer loyalty discount applied, etc."
              value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
            />
          </div>

          {/* Footer Submit */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              id="btn-complete-payment"
              disabled={isSubmitting}
              className="flex-2 py-2.5 px-4 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-xl transition cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Complete & Record Payment (${grandTotal.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

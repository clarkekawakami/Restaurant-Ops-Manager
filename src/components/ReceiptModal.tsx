import React from 'react';
import { X, Printer, Check, Receipt } from 'lucide-react';
import { Order, BusinessProfile } from '../types.ts';
import { RestaurantLogo } from './RestaurantLogo.tsx';

interface ReceiptModalProps {
  order: Order;
  onClose: () => void;
  profile?: BusinessProfile | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, onClose, profile }) => {
  const handlePrint = () => {
    window.print();
  };

  const formattedDate = order.paid_at
    ? new Date(order.paid_at).toLocaleString()
    : new Date(order.created_at).toLocaleString();

  const businessName = profile?.business_name || 'The Rustic Bistro';
  const address = profile?.address || '124 Main Street • Downtown';
  const phone = profile?.phone || '(555) 234-8900';
  const footerMessage = profile?.receipt_footer || 'Thank you for dining with us!';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span className="font-heading text-sm font-bold">Transaction Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition cursor-pointer text-xs flex items-center gap-1 font-medium"
              title="Print Receipt"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Thermal style printed receipt layout */}
        <div className="p-6 bg-white font-mono text-xs space-y-4 max-h-[75vh] overflow-y-auto print:p-0">
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-4">
            <div className="flex justify-center pb-1">
              <RestaurantLogo
                logoUrl={profile?.logo_url}
                logoIcon={profile?.logo_icon || 'utensils'}
                className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center mx-auto overflow-hidden shadow-2xs"
                iconClassName="w-5 h-5 text-amber-400"
              />
            </div>
            <h1 className="font-bold text-base tracking-wider uppercase text-slate-900 font-sans">
              {businessName}
            </h1>
            <p className="text-[11px] text-slate-500">{address}</p>
            <p className="text-[11px] text-slate-500">Tel: {phone}</p>
            <div className="pt-2 text-[10px] text-slate-400">
              <span>{formattedDate}</span>
            </div>
            <div className="text-xs font-bold text-slate-800">
              Order #{order.order_number} &bull; {order.table_number} ({order.order_type})
            </div>
            {order.server_name && (
              <div className="text-[11px] text-slate-600">Server: {order.server_name}</div>
            )}
          </div>

          {/* Items */}
          <div className="space-y-2 border-b border-dashed border-slate-300 pb-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                  <span className="font-semibold text-slate-900">
                    {item.quantity}x {item.name}
                  </span>
                  {item.notes && <p className="text-[10px] text-slate-500 italic">*{item.notes}</p>}
                </div>
                <span className="text-slate-800 font-medium">${item.total_price.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Subtotals & Taxes */}
          <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3 text-slate-600">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax (8.25%):</span>
              <span>${order.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-800">
              <span>Tip Amount:</span>
              <span>${order.tip.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
              <span>Total Paid:</span>
              <span>${order.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-[11px]">
            <div className="flex justify-between font-semibold text-slate-800">
              <span>Method:</span>
              <span className="uppercase">
                {order.payment_method === 'card_terminal' ? 'Standalone Card Terminal' : 'Cash Tender'}
              </span>
            </div>
            {order.payment_notes && (
              <div className="text-[10px] text-slate-600 break-words pt-1 border-t border-slate-200">
                {order.payment_notes}
              </div>
            )}
          </div>

          <div className="text-center pt-2 space-y-1 text-slate-500 text-[10px]">
            <p>{footerMessage}</p>
            <p className="font-semibold text-emerald-700">PAID &bull; RECEIPT CLOSED</p>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

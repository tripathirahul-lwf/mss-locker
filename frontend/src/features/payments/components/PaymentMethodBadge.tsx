import React from 'react';
import { PaymentMethod, PaymentStatus } from '../types';
import {
  Banknote,
  QrCode,
  CreditCard,
  Building2,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

export function PaymentMethodBadge({ method }: { method: PaymentMethod }) {
  switch (method) {
    case 'CASH':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
          <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Cash</span>
        </span>
      );
    case 'UPI':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-violet-50 text-violet-800 border border-violet-200 shadow-2xs">
          <QrCode className="w-3.5 h-3.5 text-violet-600 shrink-0" />
          <span>UPI / QR</span>
        </span>
      );
    case 'BANK_TRANSFER':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Bank Transfer</span>
        </span>
      );
    case 'CARD':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 shadow-2xs">
          <CreditCard className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>Card</span>
        </span>
      );
    case 'CHEQUE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
          <Receipt className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Cheque</span>
        </span>
      );
    case 'OTHER':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <span>{method}</span>
        </span>
      );
  }
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Completed</span>
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Pending</span>
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 line-through opacity-80">
          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Cancelled</span>
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Failed</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
          <span>{status}</span>
        </span>
      );
  }
}

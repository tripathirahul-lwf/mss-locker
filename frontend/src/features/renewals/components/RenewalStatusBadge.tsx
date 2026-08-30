import React from 'react';
import { PaymentStatus, DueStatus, InvoiceStatus } from '../types';
import { CheckCircle2, Clock, AlertTriangle, AlertCircle, XCircle } from 'lucide-react';

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case 'PAID':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Paid in Full</span>
        </span>
      );
    case 'PARTIALLY_PAID':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 text-sky-800 border border-sky-200 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span>Partially Paid</span>
        </span>
      );
    case 'UNPAID':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
          <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Unpaid</span>
        </span>
      );
  }
}

export function DueStatusBadge({
  status,
  dueDate,
}: {
  status: DueStatus;
  dueDate?: string;
}) {
  switch (status) {
    case 'OVERDUE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Overdue</span>
        </span>
      );
    case 'DUE_TODAY':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-2xs">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Due Today</span>
        </span>
      );
    case 'UPCOMING':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200">
          <span>Upcoming</span>
        </span>
      );
  }
}

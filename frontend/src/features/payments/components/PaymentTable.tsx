import React from 'react';
import {
  Eye,
  Printer,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  FileText,
  Ban,
  Receipt,
  Plus,
} from 'lucide-react';
import { Payment, PaymentQueryParams } from '../types';
import { PaymentMethodBadge, PaymentStatusBadge } from './PaymentMethodBadge';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';

interface PaymentTableProps {
  payments: Payment[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  filters: PaymentQueryParams;
  onPageChange: (page: number) => void;
  onView: (payment: Payment) => void;
  onPrintReceipt: (payment: Payment) => void;
  onCancel: (payment: Payment) => void;
  onRecordPayment?: () => void;
}

export function PaymentTable({
  payments,
  pagination,
  isLoading,
  filters,
  onPageChange,
  onView,
  onPrintReceipt,
  onCancel,
  onRecordPayment,
}: PaymentTableProps) {
  const canCancel = usePermission('payments.cancel');
  const canCreate = usePermission('payments.create');

  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-semibold animate-pulse shadow-2xs">
        Loading Payment Records...
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="w-full bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-2xs">
        <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
          <Receipt className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900">No Payment Records Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            No payments match your active search or filter selection. Click "Record Payment" below to record a cashier transaction.
          </p>
        </div>
        {canCreate && onRecordPayment && (
          <Button
            size="sm"
            onClick={onRecordPayment}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md shadow-emerald-600/20 px-5 h-11 rounded-2xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Payment</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden select-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50/80 text-slate-600 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
            <tr>
              <th className="py-3.5 px-4">Payment & Receipt No</th>
              <th className="py-3.5 px-4">Date</th>
              <th className="py-3.5 px-4">Customer</th>
              <th className="py-3.5 px-4">Locker & Invoice</th>
              <th className="py-3.5 px-4">Payment Method</th>
              <th className="py-3.5 px-4 text-right">Amount Received</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4">Recorded By</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {payments.map((p) => {
              const customer = p.customerId;
              const locker = p.lockerId;
              const invoice = p.invoiceId;

              return (
                <tr
                  key={p._id}
                  onClick={() => onView(p)}
                  className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                >
                  {/* Payment & Receipt Numbers */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 group-hover:bg-emerald-100 group-hover:text-emerald-950 px-2 py-0.5 rounded-lg border border-slate-200 transition-colors block w-fit">
                        {p.paymentNumber}
                      </span>
                      <span className="text-[11px] text-emerald-700 font-mono font-bold block">
                        {p.receiptNumber}
                      </span>
                    </div>
                  </td>

                  {/* Payment Date */}
                  <td className="py-3.5 px-4">
                    <span className="font-mono font-bold text-slate-800">
                      {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      {customer?.photoUrl ? (
                        <img
                          src={customer.photoUrl}
                          alt={customer.fullName}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate max-w-[160px]">
                        <p className="font-bold text-slate-900 truncate">
                          {customer?.fullName || 'Customer'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {customer?.phone || ''}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Locker & Invoice */}
                  <td className="py-3.5 px-4">
                    <div>
                      <div className="flex items-center gap-1.5 font-black text-slate-900">
                        <KeyRound className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Locker #{locker?.lockerNumber}</span>
                        <span className="text-[10px] px-1 py-0.2 rounded bg-blue-100 text-blue-900 font-mono font-bold">
                          {locker?.size}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {invoice?.invoiceNumber}
                      </p>
                    </div>
                  </td>

                  {/* Payment Method & Reference */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-1">
                      <PaymentMethodBadge method={p.paymentMethod} />
                      {(p.upiReference || p.transactionReference || p.chequeNumber) && (
                        <span className="text-[10px] text-slate-400 font-mono block truncate max-w-[130px]">
                          Ref: {p.upiReference || p.transactionReference || p.chequeNumber}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Amount Received */}
                  <td className="py-3.5 px-4 text-right">
                    <span className="font-black text-sm font-mono text-emerald-700 block">
                      ₹{p.amount.toLocaleString('en-IN')}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 text-center">
                    <PaymentStatusBadge status={p.paymentStatus} />
                  </td>

                  {/* Recorded By */}
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    <span className="truncate max-w-[120px] block">
                      {p.recordedBy?.name || 'Counter Staff'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3.5 px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(p)}
                        className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                        title="View Payment Dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPrintReceipt(p)}
                        className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        title="Print Official Receipt"
                      >
                        <Printer className="w-4 h-4 text-slate-700" />
                      </Button>

                      {p.paymentStatus === 'COMPLETED' && canCancel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancel(p)}
                          className="h-8 w-8 p-0 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          title="Cancel Payment (Reopen Balance)"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && pagination.totalPages > 1 && (
        <div className="p-4 bg-slate-50/80 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
          <span>
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} payments
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="h-8 px-2.5 rounded-xl cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-bold text-slate-800">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="h-8 px-2.5 rounded-xl cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

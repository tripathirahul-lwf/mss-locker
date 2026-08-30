import React from 'react';
import {
  Eye,
  Calendar,
  KeyRound,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Ban,
  Clock,
} from 'lucide-react';
import { LockerInvoice, InvoiceQueryParams } from '../types';
import { PaymentStatusBadge, DueStatusBadge } from './RenewalStatusBadge';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';

interface RenewalTableProps {
  invoices: LockerInvoice[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  isLoading: boolean;
  filters: InvoiceQueryParams;
  onPageChange: (page: number) => void;
  onView: (invoice: LockerInvoice) => void;
  onCancel: (invoice: LockerInvoice) => void;
  onGenerateRenewal?: () => void;
}

export function RenewalTable({
  invoices,
  pagination,
  isLoading,
  filters,
  onPageChange,
  onView,
  onCancel,
  onGenerateRenewal,
}: RenewalTableProps) {
  const canCreate = usePermission('renewals.create');

  if (isLoading) {
    return (
      <div className="w-full bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 font-semibold animate-pulse shadow-2xs">
        Loading Billing & Renewal Records...
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="w-full bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-2xs">
        <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100 shadow-sm">
          <Calendar className="w-8 h-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900">No Invoices / Renewal Records Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            No billing records match your active search or filter selection. Click "Generate Renewal" below to create a recurring renewal invoice.
          </p>
        </div>
        {canCreate && onGenerateRenewal && (
          <Button
            size="sm"
            onClick={onGenerateRenewal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 px-5 h-11 rounded-2xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate First Renewal</span>
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
              <th className="py-3.5 px-4">Invoice No</th>
              <th className="py-3.5 px-4">Customer</th>
              <th className="py-3.5 px-4">Locker Unit</th>
              <th className="py-3.5 px-4">Due Date & Urgency</th>
              <th className="py-3.5 px-4">Billing Period</th>
              <th className="py-3.5 px-4 text-right">Total Amount</th>
              <th className="py-3.5 px-4 text-right">Balance Due</th>
              <th className="py-3.5 px-4 text-center">Payment Status</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {invoices.map((inv) => {
              const customer = inv.customerId;
              const locker = inv.lockerId;

              return (
                <tr
                  key={inv._id}
                  onClick={() => onView(inv)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                >
                  {/* Invoice Number */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-950 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors block w-fit">
                        {inv.invoiceNumber}
                      </span>
                      {inv.legacyReference && (
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {inv.legacyReference}
                        </span>
                      )}
                    </div>
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
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate max-w-[170px]">
                        <p className="font-bold text-slate-900 truncate">
                          {customer?.fullName || 'Legacy Customer'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {customer?.phone || ''}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Locker */}
                  <td className="py-3.5 px-4">
                    <div>
                      <div className="flex items-center gap-1.5 font-black text-slate-900">
                        <KeyRound className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Locker #{locker?.lockerNumber || 'N/A'}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-mono font-bold">
                          {locker?.size}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {locker?.rackNumber}
                      </p>
                    </div>
                  </td>

                  {/* Due Date & Urgency */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900 font-mono">
                        {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <DueStatusBadge status={inv.dueStatus} />
                    </div>
                  </td>

                  {/* Billing Period */}
                  <td className="py-3.5 px-4">
                    <div className="space-y-0.5 text-[11px] text-slate-700 font-mono">
                      <span>
                        {new Date(inv.billingPeriodStart).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        -{' '}
                        {new Date(inv.billingPeriodEnd).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block font-sans">
                        {inv.billingCycle}
                      </span>
                    </div>
                  </td>

                  {/* Total Amount */}
                  <td className="py-3.5 px-4 text-right font-black text-slate-900 font-mono">
                    ₹{inv.totalAmount.toLocaleString('en-IN')}
                  </td>

                  {/* Balance Due */}
                  <td className="py-3.5 px-4 text-right font-black font-mono">
                    <span className={inv.balanceAmount > 0 ? 'text-rose-600' : 'text-slate-500'}>
                      ₹{inv.balanceAmount.toLocaleString('en-IN')}
                    </span>
                  </td>

                  {/* Payment Status */}
                  <td className="py-3.5 px-4 text-center">
                    <PaymentStatusBadge status={inv.paymentStatus} />
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
                        onClick={() => onView(inv)}
                        className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                        title="View Invoice Dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {inv.paymentStatus === 'UNPAID' && inv.status !== 'CANCELLED' && canCreate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancel(inv)}
                          className="h-8 w-8 p-0 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                          title="Cancel Unpaid Invoice"
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
            {pagination.total} invoices
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

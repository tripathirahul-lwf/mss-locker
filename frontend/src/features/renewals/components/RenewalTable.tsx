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
  Phone,
} from 'lucide-react';
import { LockerInvoice, InvoiceQueryParams } from '../types';
import { PaymentStatusBadge, DueStatusBadge } from './RenewalStatusBadge';
import { Button } from '../../../components/ui/button';
import { usePermission } from '../../../hooks/usePermission';
import { formatPhone } from '../../customers/utils/phoneFormatter';

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
      <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400 font-normal animate-pulse shadow-2xs font-sans text-xs">
        Loading Billing & Renewal Records...
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="w-full bg-white rounded-2xl border border-slate-200/90 p-12 text-center space-y-4 shadow-2xs select-none">
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200/80 shadow-2xs">
          <Calendar className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900 font-sans">No Invoices / Renewal Records Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-normal">
            No billing records match your active search or filter selection. Click "Generate Renewal" below to create a recurring renewal invoice.
          </p>
        </div>
        {canCreate && onGenerateRenewal && (
          <Button
            size="sm"
            onClick={onGenerateRenewal}
            className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs px-4 h-9 rounded-xl text-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Generate First Renewal</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden select-none">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200/80">
            <tr>
              <th className="py-3 px-4">Invoice No</th>
              <th className="py-3 px-4">Customer</th>
              <th className="py-3 px-4">Locker Unit</th>
              <th className="py-3 px-4">Due Date & Urgency</th>
              <th className="py-3 px-4">Billing Period</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
              <th className="py-3 px-4 text-right">Balance Due</th>
              <th className="py-3 px-4 text-center">Payment Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-normal">
            {invoices.map((inv) => {
              const customer = inv.customerId;
              const locker = inv.lockerId;

              return (
                <tr
                  key={inv._id}
                  onClick={() => onView(inv)}
                  className="hover:bg-emerald-50/20 cursor-pointer transition-colors group"
                >
                  {/* Invoice Number */}
                  <td className="py-3 px-4">
                    <div className="space-y-0.5">
                      <span className="font-sans font-medium text-xs text-slate-700 bg-slate-100/80 group-hover:bg-emerald-50 group-hover:text-emerald-900 px-2 py-0.5 rounded-md border border-slate-200 transition-colors inline-block tabular-nums">
                        {inv.invoiceNumber}
                      </span>
                      {inv.legacyReference && (
                        <span className="text-[11px] text-slate-400 font-sans tabular-nums block">
                          {inv.legacyReference}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      {customer?.photoUrl ? (
                        <img
                          src={customer.photoUrl}
                          alt={customer.fullName}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold font-sans text-xs flex items-center justify-center shrink-0 shadow-2xs">
                          {(customer?.fullName || 'CU').slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="truncate max-w-[190px]">
                        <p className="font-semibold text-slate-900 truncate font-sans text-xs">
                          {customer?.fullName || 'Legacy Customer'}
                        </p>
                        <p className="font-sans font-medium text-slate-900 text-[13px] tabular-nums tracking-tight truncate">
                          {formatPhone(customer?.phone || '')}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Locker */}
                  <td className="py-3 px-4">
                    <div>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900 font-sans text-xs">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                        <span>Locker #{locker?.lockerNumber || 'N/A'}</span>
                        {locker?.size && (
                          <span className="text-[10.5px] px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-sans font-medium">
                            {locker.size}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-normal font-sans">
                        {locker?.rackNumber || 'Standard Rack'}
                      </p>
                    </div>
                  </td>

                  {/* Due Date & Urgency */}
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900 font-sans text-xs tabular-nums">
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
                  <td className="py-3 px-4">
                    <div className="space-y-0.5 text-xs text-slate-700 font-sans tabular-nums">
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
                      <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider block font-sans">
                        {inv.billingCycle}
                      </span>
                    </div>
                  </td>

                  {/* Total Amount */}
                  <td className="py-3 px-4 text-right font-semibold text-slate-900 font-sans text-xs tabular-nums">
                    ₹{inv.totalAmount.toLocaleString('en-IN')}
                  </td>

                  {/* Balance Due */}
                  <td className="py-3 px-4 text-right font-semibold font-sans text-xs tabular-nums">
                    <span className={inv.balanceAmount > 0 ? 'text-rose-700' : 'text-slate-500 font-medium'}>
                      ₹{inv.balanceAmount.toLocaleString('en-IN')}
                    </span>
                  </td>

                  {/* Payment Status */}
                  <td className="py-3 px-4 text-center">
                    <PaymentStatusBadge status={inv.paymentStatus} />
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3 px-4 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(inv)}
                        className="h-8 w-8 p-0 rounded-xl text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                        title="View Invoice Dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {inv.paymentStatus === 'UNPAID' && inv.status !== 'CANCELLED' && canCreate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancel(inv)}
                          className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
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
        <div className="p-3.5 sm:p-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 font-normal">
          <span className="font-sans tabular-nums">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} invoices
          </span>

          <div className="flex items-center gap-2 font-sans">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="h-8 px-2.5 rounded-xl border-slate-300 cursor-pointer bg-white"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="font-medium text-slate-800 tabular-nums">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="h-8 px-2.5 rounded-xl border-slate-300 cursor-pointer bg-white"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

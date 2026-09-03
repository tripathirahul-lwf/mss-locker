import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Plus, Download, RefreshCw, CheckCircle2, X } from 'lucide-react';
import { renewalApi } from '../features/renewals/api/renewalApi';
import {
  LockerInvoice,
  InvoiceQueryParams,
  PaymentStatus,
  DueStatus,
  GenerateRenewalInput,
} from '../features/renewals/types';
import { RenewalSummaryCards } from '../features/renewals/components/RenewalSummaryCards';
import { RenewalActionRibbon } from '../features/renewals/components/RenewalActionRibbon';
import { RenewalTable } from '../features/renewals/components/RenewalTable';
import { InvoiceDetailModal } from '../features/renewals/components/InvoiceDetailModal';
import { GenerateRenewalModal } from '../features/renewals/components/GenerateRenewalModal';
import { RecordPaymentModal } from '../features/payments/components/RecordPaymentModal';
import { paymentApi } from '../features/payments/api/paymentApi';
import { usePermission } from '../hooks/usePermission';

export function RenewalsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreate = usePermission('renewals.create');

  // Read URL query parameters
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 25;
  const search = searchParams.get('search') || undefined;
  const paymentStatus = (searchParams.get('paymentStatus') as PaymentStatus | 'ALL') || undefined;
  const dueStatus = (searchParams.get('dueStatus') as DueStatus | 'ALL') || undefined;
  const sortBy = searchParams.get('sortBy') || 'dueDate';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc';

  const queryFilters: InvoiceQueryParams = {
    page,
    limit,
    search,
    paymentStatus: paymentStatus === 'ALL' ? undefined : paymentStatus,
    dueStatus: dueStatus === 'ALL' ? undefined : dueStatus,
    sortBy,
    sortOrder,
  };

  const updateFilters = (newFilters: {
    page?: number;
    limit?: number;
    search?: string;
    paymentStatus?: PaymentStatus | 'ALL';
    dueStatus?: DueStatus | 'ALL';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const updated = new URLSearchParams(searchParams);

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === 'ALL') {
        updated.delete(key);
      } else {
        updated.set(key, String(value));
      }
    });

    setSearchParams(updated);
  };

  // Queries
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['renewal-stats'],
    queryFn: () => renewalApi.getRenewalStats(),
  });

  const {
    data: listData,
    isLoading: isListLoading,
    isFetching,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['renewals', queryFilters],
    queryFn: () => renewalApi.getInvoices(queryFilters),
  });

  const invoices = listData?.invoices || [];
  const pagination = listData?.pagination;

  // Modal States
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<LockerInvoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<LockerInvoice | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Mutations
  const generateMutation = useMutation({
    mutationFn: (data: GenerateRenewalInput) => renewalApi.generateRenewal(data),
    onSuccess: () => {
      setGenerateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['renewals'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      setNotice('Renewal invoice generated successfully.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      renewalApi.cancelInvoice(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewals'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      setNotice('Invoice cancelled successfully.');
    },
  });

  const handleExportCSV = () => {
    if (invoices.length === 0) return;

    const headers = [
      'Invoice Number',
      'Invoice Type',
      'Customer Name',
      'Customer Code',
      'Phone',
      'Locker Number',
      'Size',
      'Due Date',
      'Billing Start',
      'Billing End',
      'Total Amount',
      'Paid Amount',
      'Balance Due',
      'Payment Status',
      'Due Status',
      'Legacy Bill Ref',
    ];

    const rows = invoices.map((inv) => [
      `"${inv.invoiceNumber}"`,
      `"${inv.invoiceType}"`,
      `"${inv.customerId?.fullName || ''}"`,
      `"${inv.customerId?.customerCode || ''}"`,
      `"${inv.customerId?.phone || ''}"`,
      `"${inv.lockerId?.lockerNumber || ''}"`,
      `"${inv.lockerId?.size || ''}"`,
      `"${inv.dueDate?.slice(0, 10) || ''}"`,
      `"${inv.billingPeriodStart?.slice(0, 10) || ''}"`,
      `"${inv.billingPeriodEnd?.slice(0, 10) || ''}"`,
      `"${inv.totalAmount}"`,
      `"${inv.paidAmount}"`,
      `"${inv.balanceAmount}"`,
      `"${inv.paymentStatus}"`,
      `"${inv.dueStatus}"`,
      `"${inv.legacyReference || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Renewals_Invoices_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 select-none">
      {notice && (
        <div
          role="status"
          className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3 text-xs font-semibold text-emerald-900 shadow-xl animate-in fade-in-0 duration-150"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" />
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="grid h-7 w-7 place-items-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-50 text-emerald-800 shadow-2xs sm:flex">
              <Calendar className="h-5 w-5 text-emerald-800" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 font-sans">
                Locker Renewals & Billing
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 font-normal">
                Track upcoming, due and overdue locker renewal statements.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 1. Summary Metric Cards with 1-Click Filtering */}
      <RenewalSummaryCards
        stats={stats}
        selectedDueStatus={dueStatus}
        selectedPaymentStatus={paymentStatus}
        onSelectFilter={(f) => updateFilters({ ...f, page: 1 })}
      />

      {/* 2. Action Ribbon & Search Toolbar */}
      <RenewalActionRibbon
        searchQuery={search}
        onSearchChange={(q) => updateFilters({ search: q, page: 1 })}
        selectedPaymentStatus={paymentStatus}
        onPaymentStatusChange={(ps) => updateFilters({ paymentStatus: ps, page: 1 })}
        selectedDueStatus={dueStatus}
        onDueStatusChange={(ds) => updateFilters({ dueStatus: ds, page: 1 })}
        onGenerateRenewal={() => setGenerateModalOpen(true)}
        onExportCSV={handleExportCSV}
        onRefresh={() => {
          refetchList();
          refetchStats();
        }}
        isRefreshing={isFetching}
        canCreate={canCreate}
      />

      {/* 3. Invoices / Renewal Table */}
      <RenewalTable
        invoices={invoices}
        pagination={pagination}
        isLoading={isListLoading}
        filters={queryFilters}
        onPageChange={(p) => updateFilters({ page: p })}
        onView={(inv) => setViewingInvoice(inv)}
        onCancel={(inv) =>
          cancelMutation.mutate({ id: inv._id, reason: 'Staff cancellation' })
        }
        onGenerateRenewal={() => setGenerateModalOpen(true)}
      />

      {/* 4. Generate Renewal Modal */}
      {generateModalOpen && (
        <GenerateRenewalModal
          onClose={() => setGenerateModalOpen(false)}
          onSubmit={async (data) => {
            await generateMutation.mutateAsync(data);
          }}
          isSubmitting={generateMutation.isPending}
        />
      )}

      {/* 5. Invoice Detail Dossier Modal */}
      {viewingInvoice && (
        <InvoiceDetailModal
          invoice={viewingInvoice}
          onClose={() => setViewingInvoice(null)}
          onCancelInvoice={async (inv, reason) => {
            await cancelMutation.mutateAsync({ id: inv._id, reason });
          }}
          onRecordPayment={(inv) => {
            setViewingInvoice(null);
            setPayingInvoice(inv);
          }}
        />
      )}

      {/* 6. Record Payment Modal */}
      {payingInvoice && (
        <RecordPaymentModal
          initialInvoiceId={payingInvoice._id}
          onClose={() => setPayingInvoice(null)}
          onSubmit={async (data, idempotencyKey) => {
            const p = await paymentApi.recordPayment(data, idempotencyKey);
            refetchList();
            refetchStats();
            return p;
          }}
        />
      )}
    </div>
  );
}

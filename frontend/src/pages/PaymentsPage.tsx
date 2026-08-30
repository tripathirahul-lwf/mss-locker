import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, CheckCircle2, X } from 'lucide-react';
import { paymentApi } from '../features/payments/api/paymentApi';
import {
  Payment,
  PaymentQueryParams,
  PaymentMethod,
  PaymentStatus,
  RecordPaymentInput,
} from '../features/payments/types';
import { PaymentSummaryCards } from '../features/payments/components/PaymentSummaryCards';
import { PaymentActionRibbon } from '../features/payments/components/PaymentActionRibbon';
import { PaymentTable } from '../features/payments/components/PaymentTable';
import { RecordPaymentModal } from '../features/payments/components/RecordPaymentModal';
import { PaymentReceiptModal } from '../features/payments/components/PaymentReceiptModal';
import { PaymentDetailModal } from '../features/payments/components/PaymentDetailModal';
import { usePermission } from '../hooks/usePermission';

export function PaymentsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canCreate = usePermission('payments.create');

  // Read URL query parameters
  const page = Number(searchParams.get('page')) || 1;
  const limit = Number(searchParams.get('limit')) || 25;
  const search = searchParams.get('search') || undefined;
  const paymentMethod = (searchParams.get('paymentMethod') as PaymentMethod | 'ALL') || undefined;
  const paymentStatus = (searchParams.get('paymentStatus') as PaymentStatus | 'ALL') || undefined;
  const sortBy = searchParams.get('sortBy') || 'paymentDate';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  const queryFilters: PaymentQueryParams = {
    page,
    limit,
    search,
    paymentMethod: paymentMethod === 'ALL' ? undefined : paymentMethod,
    paymentStatus: paymentStatus === 'ALL' ? undefined : paymentStatus,
    sortBy,
    sortOrder,
  };

  const updateFilters = (newFilters: {
    page?: number;
    limit?: number;
    search?: string;
    paymentMethod?: PaymentMethod | 'ALL';
    paymentStatus?: PaymentStatus | 'ALL';
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
    queryKey: ['payment-stats'],
    queryFn: () => paymentApi.getPaymentStats(),
  });

  const {
    data: listData,
    isLoading: isListLoading,
    isFetching,
    refetch: refetchList,
  } = useQuery({
    queryKey: ['payments', queryFilters],
    queryFn: () => paymentApi.getPayments(queryFilters),
  });

  const payments = listData?.payments || [];
  const pagination = listData?.pagination;

  // Modals
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
  const [printingPayment, setPrintingPayment] = useState<Payment | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Mutations
  const recordMutation = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: RecordPaymentInput; idempotencyKey: string }) =>
      paymentApi.recordPayment(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['renewals'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      setNotice('Payment recorded and receipt issued successfully.');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      paymentApi.cancelPayment(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['renewals'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
      setNotice('Payment cancelled and invoice balance reopened.');
    },
  });

  const handleExportCSV = () => {
    if (payments.length === 0) return;

    const headers = [
      'Payment Number',
      'Receipt Number',
      'Date',
      'Customer Name',
      'Customer Code',
      'Phone',
      'Locker Number',
      'Size',
      'Invoice Number',
      'Payment Method',
      'Amount',
      'Status',
      'Recorded By',
      'Reference',
    ];

    const rows = payments.map((p) => [
      `"${p.paymentNumber}"`,
      `"${p.receiptNumber}"`,
      `"${p.paymentDate?.slice(0, 10) || ''}"`,
      `"${p.customerId?.fullName || ''}"`,
      `"${p.customerId?.customerCode || ''}"`,
      `"${p.customerId?.phone || ''}"`,
      `"${p.lockerId?.lockerNumber || ''}"`,
      `"${p.lockerId?.size || ''}"`,
      `"${p.invoiceId?.invoiceNumber || ''}"`,
      `"${p.paymentMethod}"`,
      `"${p.amount}"`,
      `"${p.paymentStatus}"`,
      `"${p.recordedBy?.name || ''}"`,
      `"${p.upiReference || p.transactionReference || p.chequeNumber || p.bankReference || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payments_Receipts_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 select-none">
      {notice && (
        <div
          role="status"
          className="fixed right-4 top-20 z-[110] flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3 text-xs font-semibold text-emerald-800 shadow-xl"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 cursor-pointer"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Page Header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 sm:flex">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Payments & Receipts
              </h1>
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm font-medium">
                Track locker payments, cashier receipts and invoice settlements.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 1. Summary Collection Cards */}
      <PaymentSummaryCards
        stats={stats}
        selectedMethod={paymentMethod}
        onSelectMethod={(method) => updateFilters({ paymentMethod: method, page: 1 })}
      />

      {/* 2. Action Ribbon */}
      <PaymentActionRibbon
        searchQuery={search}
        onSearchChange={(q) => updateFilters({ search: q, page: 1 })}
        selectedMethod={paymentMethod}
        onMethodChange={(m) => updateFilters({ paymentMethod: m, page: 1 })}
        selectedStatus={paymentStatus}
        onStatusChange={(s) => updateFilters({ paymentStatus: s, page: 1 })}
        onRecordPayment={() => setRecordModalOpen(true)}
        onExportCSV={handleExportCSV}
        onRefresh={() => {
          refetchList();
          refetchStats();
        }}
        isRefreshing={isFetching}
        canCreate={canCreate}
      />

      {/* 3. Payments Table */}
      <PaymentTable
        payments={payments}
        pagination={pagination}
        isLoading={isListLoading}
        filters={queryFilters}
        onPageChange={(p) => updateFilters({ page: p })}
        onView={(p) => setViewingPayment(p)}
        onPrintReceipt={(p) => setPrintingPayment(p)}
        onCancel={(p) =>
          cancelMutation.mutate({ id: p._id, reason: 'Staff cancellation' })
        }
        onRecordPayment={() => setRecordModalOpen(true)}
      />

      {/* 4. Record Payment Wizard Modal */}
      {recordModalOpen && (
        <RecordPaymentModal
          onClose={() => setRecordModalOpen(false)}
          onSubmit={async (data, idempotencyKey) => {
            return recordMutation.mutateAsync({ data, idempotencyKey });
          }}
          onSuccessViewReceipt={(p) => setPrintingPayment(p)}
        />
      )}

      {/* 5. Payment Detail Dossier Modal */}
      {viewingPayment && (
        <PaymentDetailModal
          payment={viewingPayment}
          onClose={() => setViewingPayment(null)}
          onPrintReceipt={(p) => {
            setViewingPayment(null);
            setPrintingPayment(p);
          }}
          onCancelPayment={async (p, reason) => {
            await cancelMutation.mutateAsync({ id: p._id, reason });
          }}
        />
      )}

      {/* 6. Print Official Receipt Modal */}
      {printingPayment && (
        <PaymentReceiptModal
          payment={printingPayment}
          onClose={() => setPrintingPayment(null)}
        />
      )}
    </div>
  );
}

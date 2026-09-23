import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  User,
  ShieldCheck,
  KeyRound,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Edit3,
  Trash2,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  Building,
  Receipt,
  CreditCard,
  Printer,
  Copy,
  Check,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { customerApi } from '../features/customers/api/customerApi';
import { CustomerPhotoPreviewModal } from '../features/customers/components/CustomerPhotoPreviewModal';
import {
  CustomerKycDocument,
  AddKycDocumentInput,
  UpdateKycDocumentInput,
  VerifyKycDocumentInput,
} from '../features/customers/types';
import { CustomerStatusBadge } from '../features/customers/components/CustomerStatusBadge';
import { KycStatusBadge } from '../features/customers/components/KycStatusBadge';
import { KycDocumentList } from '../features/customers/components/KycDocumentList';
import { KycDocumentModal } from '../features/customers/components/KycDocumentModal';
import { CustomerFormModal } from '../features/customers/components/CustomerFormModal';
import { formatPhone } from '../features/customers/utils/phoneFormatter';
import { formatINR } from '../features/lockers/utils/formatters';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { usePermission } from '../hooks/usePermission';
import { ConfirmationModal } from '../components/common/ConfirmationModal';

import { allocationApi } from '../features/allocations/api/allocationApi';
import { AllocationStatusBadge } from '../features/allocations/components/AllocationStatusBadge';
import { renewalApi } from '../features/renewals/api/renewalApi';
import { PaymentStatusBadge, DueStatusBadge } from '../features/renewals/components/RenewalStatusBadge';

import { paymentApi } from '../features/payments/api/paymentApi';
import { PaymentMethodBadge } from '../features/payments/components/PaymentMethodBadge';
import { PaymentReceiptModal } from '../features/payments/components/PaymentReceiptModal';
import { RecordPaymentModal } from '../features/payments/components/RecordPaymentModal';
import { RecordPaymentInput } from '../features/payments/types';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const backUrl = useMemo(() => {
    if (location.state?.from && typeof location.state.from === 'string' && location.state.from.startsWith('/customers')) {
      return location.state.from;
    }
    const saved = sessionStorage.getItem('customer_list_params');
    if (saved) {
      return `/customers?${saved}`;
    }
    return '/customers';
  }, [location.state]);

  const handleBackToCustomers = () => {
    navigate(backUrl);
  };

  const canUpdate = usePermission('customers.update');
  const canDelete = usePermission('customers.delete');
  const canAllocate = usePermission('allocations.create');

  const activeTab = searchParams.get('tab') || 'kyc';
  const tabIds = ['kyc', 'profile', 'lockers', 'billing', 'payments'];

  const setTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = tabIds.indexOf(activeTab);
    const nextIndex = event.key === 'Home' ? 0
      : event.key === 'End' ? tabIds.length - 1
      : event.key === 'ArrowRight' ? (currentIndex + 1) % tabIds.length
      : (currentIndex - 1 + tabIds.length) % tabIds.length;
    const nextTab = tabIds[nextIndex];
    setTab(nextTab);
    requestAnimationFrame(() => document.getElementById(`customer-tab-${nextTab}`)?.focus());
  };

  // Modals
  const [isPhotoPreviewOpen, setIsPhotoPreviewOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [editingKycDoc, setEditingKycDoc] = useState<CustomerKycDocument | null>(
    null
  );
  const [recordPaymentInvoiceId, setRecordPaymentInvoiceId] = useState<string | null>(null);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [deletingKycDoc, setDeletingKycDoc] = useState<CustomerKycDocument | null>(null);
  const [isDeletingKyc, setIsDeletingKyc] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string | null | undefined, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Fetch Customer
  const {
    data: customer,
    isLoading: isCustomerLoading,
    error: customerError,
  } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customerApi.getCustomerById(id!),
    enabled: Boolean(id),
  });

  // Fetch KYC Documents
  const { data: kycDocs, isLoading: isKycLoading } = useQuery({
    queryKey: ['customer-kyc', id],
    queryFn: () => customerApi.getKycDocuments(id!),
    enabled: Boolean(id),
  });

  // Fetch Customer Allocations (Active + History)
  const { data: customerAllocations, isLoading: isAllocationsLoading } = useQuery({
    queryKey: ['customer-allocations', id],
    queryFn: () => allocationApi.getCustomerAllocations(id!),
    enabled: Boolean(id),
  });

  // Fetch Customer Invoices & Renewal Bills
  const { data: customerInvoices, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['customer-invoices', id],
    queryFn: () => renewalApi.getCustomerInvoices(id!),
    enabled: Boolean(id),
  });

  // Fetch Customer Payments & Receipts
  const { data: customerPayments, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['customer-payments', id],
    queryFn: () => paymentApi.getCustomerPayments(id!),
    enabled: Boolean(id),
  });

  const [viewingReceipt, setViewingReceipt] = useState<any | null>(null);

  // Computed Invoice & Dues Summary
  const invoiceMetrics = useMemo(() => {
    if (!customerInvoices || customerInvoices.length === 0) {
      return { totalInvoiced: 0, totalSettled: 0, totalBalance: 0, unpaidCount: 0 };
    }
    return customerInvoices.reduce(
      (acc: any, inv: any) => {
        const total = Number(inv.totalAmount) || 0;
        const balance = Number(inv.balanceAmount) || 0;
        const paid = Number(inv.paidAmount) || (total - balance);
        acc.totalInvoiced += total;
        acc.totalBalance += balance;
        acc.totalSettled += paid;
        if (inv.paymentStatus !== 'PAID') {
          acc.unpaidCount += 1;
        }
        return acc;
      },
      { totalInvoiced: 0, totalSettled: 0, totalBalance: 0, unpaidCount: 0 }
    );
  }, [customerInvoices]);

  const firstUnpaidInvoice = useMemo(() => {
    return customerInvoices?.find(
      (inv: any) => inv.paymentStatus !== 'PAID' && (Number(inv.balanceAmount) > 0 || inv.balanceAmount > 0)
    );
  }, [customerInvoices]);

  // Mutations
  const recordPaymentMutation = useMutation({
    mutationFn: ({ data, idempotencyKey }: { data: RecordPaymentInput; idempotencyKey?: string }) =>
      paymentApi.recordPayment(data, idempotencyKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-invoices', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-allocations', id] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['payment-stats'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-stats'] });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: (data: any) => customerApi.updateCustomer(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsEditProfileOpen(false);
    },
  });

  const addKycDocMutation = useMutation({
    mutationFn: (data: AddKycDocumentInput) =>
      customerApi.addKycDocument(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-kyc', id] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
      setIsKycModalOpen(false);
    },
  });

  const updateKycDocMutation = useMutation({
    mutationFn: ({
      kycId,
      data,
    }: {
      kycId: string;
      data: UpdateKycDocumentInput;
    }) => customerApi.updateKycDocument(id!, kycId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-kyc', id] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setIsKycModalOpen(false);
      setEditingKycDoc(null);
    },
  });

  const verifyKycDocMutation = useMutation({
    mutationFn: ({
      kycId,
      input,
    }: {
      kycId: string;
      input: VerifyKycDocumentInput;
    }) => customerApi.verifyKycDocument(id!, kycId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-kyc', id] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
    },
  });

  const deleteKycDocMutation = useMutation({
    mutationFn: (kycId: string) => customerApi.deleteKycDocument(id!, kycId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-kyc', id] });
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customer-stats'] });
    },
  });

  const handleKycSubmit = async (
    data: AddKycDocumentInput | UpdateKycDocumentInput
  ) => {
    if (editingKycDoc) {
      await updateKycDocMutation.mutateAsync({
        kycId: editingKycDoc._id,
        data: data as UpdateKycDocumentInput,
      });
    } else {
      await addKycDocMutation.mutateAsync(data as AddKycDocumentInput);
    }
  };

  const handleConfirmArchive = async () => {
    if (!customer) return;
    setIsArchiving(true);
    try {
      await customerApi.deactivateCustomer(customer._id);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setConfirmArchiveOpen(false);
      navigate('/customers');
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to archive customer.');
    } finally {
      setIsArchiving(false);
    }
  };

  const handleConfirmDeleteKyc = async () => {
    if (!deletingKycDoc || !id) return;
    setIsDeletingKyc(true);
    try {
      await deleteKycDocMutation.mutateAsync(deletingKycDoc._id);
      setDeletingKycDoc(null);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Failed to delete KYC document.');
    } finally {
      setIsDeletingKyc(false);
    }
  };

  if (isCustomerLoading) {
    return (
      <div className="p-8 text-center text-slate-500 animate-pulse space-y-4">
        <div className="w-12 h-12 bg-slate-200 rounded-full mx-auto" />
        <div className="h-4 w-48 bg-slate-200 rounded mx-auto" />
        <p className="text-xs">Loading customer record...</p>
      </div>
    );
  }

  if (customerError || !customer) {
    return (
      <div className="p-8 text-center space-y-4 bg-white border border-slate-200 rounded-xl">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-800">
          Customer Record Not Found
        </h2>
        <p className="text-xs text-slate-500">
          The requested customer does not exist or has been removed from the registry.
        </p>
        <Link to={backUrl}>
          <Button variant="outline" size="sm" className="cursor-pointer">
            Back to Customers Directory
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          to={backUrl}
          className="h-9 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-800 transition-colors rounded-xl px-2 -ml-2 hover:bg-slate-100/80 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers Directory</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {invoiceMetrics.totalBalance > 0 && (
            <Button
              size="sm"
              onClick={() => {
                if (firstUnpaidInvoice) {
                  setRecordPaymentInvoiceId(firstUnpaidInvoice._id);
                } else {
                  setTab('billing');
                }
              }}
              className="h-9 px-3.5 flex items-center justify-center gap-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl cursor-pointer shadow-xs"
              title="Record payment against outstanding dues"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Collect Dues: {formatINR(invoiceMetrics.totalBalance)}</span>
            </Button>
          )}

          {canAllocate && !customerAllocations?.activeAllocation && (
            <Button
              size="sm"
              onClick={() => navigate('/allocations')}
              className="h-9 px-3.5 flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl cursor-pointer shadow-xs"
              title="Allocate Locker to Customer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Allocate Locker</span>
            </Button>
          )}

          {canUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditProfileOpen(true)}
              className="h-9 px-3.5 flex items-center justify-center gap-1.5 text-xs font-medium border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl cursor-pointer shadow-2xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Profile</span>
            </Button>
          )}

          {canDelete && customer.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmArchiveOpen(true)}
              className="h-9 px-3.5 text-xs font-medium text-rose-700 hover:bg-rose-50 border-rose-200 rounded-xl cursor-pointer shadow-2xs"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" />
              <span>Archive</span>
            </Button>
          )}
        </div>
      </div>

      {/* Customer Header Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-3.5 sm:gap-4 min-w-0">
            <div className="relative shrink-0">
              {customer.photoUrl ? (
                <div className="relative group/avatar shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPhotoPreviewOpen(true)}
                    className="relative block w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white shadow-xs cursor-pointer group-hover/avatar:ring-2 group-hover/avatar:ring-emerald-500 transition-all focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    title="Click to view full photo"
                    aria-label="View customer profile photo"
                  >
                    <img
                      src={customer.photoUrl}
                      alt={customer.fullName}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover/avatar:scale-105"
                    />
                    {/* Hover Overlay with Eye Icon */}
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white drop-shadow-xs" />
                    </div>
                  </button>
                  {/* Corner Eye Badge */}
                  <button
                    type="button"
                    onClick={() => setIsPhotoPreviewOpen(true)}
                    className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                    title="View Profile Photo"
                    aria-label="View Profile Photo"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-center font-semibold text-xl sm:text-2xl shadow-xs ring-1 ring-slate-900/10 font-sans tracking-wide">
                  {customer.fullName.slice(0, 2).toUpperCase()}
                </div>
              )}
              {customer.kycStatus === 'VERIFIED' && !customer.photoUrl && (
                <div
                  className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center ring-2 ring-white shadow-2xs"
                  title="KYC Certified"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight font-sans">
                  {customer.fullName}
                </h1>
                <button
                  type="button"
                  onClick={() => handleCopy(customer.customerCode, 'Customer Code')}
                  className="group inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-sans text-xs font-medium bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer tabular-nums"
                  title="Click to copy customer code"
                >
                  <span>{customer.customerCode}</span>
                  {copiedField === 'Customer Code' ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <CustomerStatusBadge status={customer.status} />
                <KycStatusBadge status={customer.kycStatus} />

                {customer.photoUrl && (
                  <button
                    type="button"
                    onClick={() => setIsPhotoPreviewOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-emerald-50 hover:bg-emerald-100/90 text-emerald-800 border border-emerald-200/80 transition-colors cursor-pointer shadow-2xs"
                    title="View high-resolution profile photo"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-700" />
                    <span>View Photo</span>
                  </button>
                )}

                {/* Vault Locker Credential Asset Badge */}
                {customerAllocations?.activeAllocation ? (
                  <button
                    type="button"
                    onClick={() => setTab('lockers')}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer shadow-2xs group"
                    title="Click to view locker agreement details"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-emerald-400 group-hover:rotate-12 transition-transform shrink-0" />
                    <span>Locker #{customerAllocations.activeAllocation.lockerId?.lockerNumber}</span>
                    <span className="text-slate-500 font-normal">&bull;</span>
                    <span className="text-slate-300 font-mono text-[11px]">Size {customerAllocations.activeAllocation.lockerId?.size}</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-100 border border-slate-200 text-slate-500">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    <span>No Active Locker</span>
                  </span>
                )}

                {/* Residential City */}
                {customer.city && !/vault|rack|floor|operational|facility/i.test(customer.city) && (
                  <span className="text-xs text-slate-500 font-normal flex items-center gap-1 ml-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {customer.city}{customer.state && !/operational|active/i.test(customer.state) ? `, ${customer.state}` : ''}
                    </span>
                  </span>
                )}
              </div>

              {/* Verified Contact Details with Click-to-Copy */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1 font-normal">
                <button
                  type="button"
                  onClick={() => handleCopy(customer.phone, 'Phone number')}
                  className="group flex items-center gap-1.5 font-sans text-slate-900 hover:text-emerald-800 font-medium text-sm tabular-nums tracking-tight transition-colors cursor-pointer"
                  title="Click to copy phone number"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700" />
                  <span>{formatPhone(customer.phone)}</span>
                  {copiedField === 'Phone number' ? (
                    <span className="text-[10.5px] text-emerald-600 font-semibold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Copied
                    </span>
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>

                {customer.email && (
                  <div className="flex items-center gap-1">
                    <a
                      href={`mailto:${customer.email}`}
                      className="flex items-center gap-1.5 text-slate-600 hover:text-emerald-800 min-w-0 transition-colors"
                      title="Send email"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{customer.email}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopy(customer.email, 'Email address')}
                      className="p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer rounded"
                      title="Click to copy email address"
                    >
                      {copiedField === 'Email address' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Audit Timestamp Stamps */}
          <div className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl text-xs space-y-1 md:text-right shrink-0 font-normal">
            <div className="text-[11px] text-slate-500">
              Registered on:{' '}
              <strong className="font-semibold text-slate-800 tabular-nums">
                {new Date(customer.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </strong>
            </div>
            <div className="text-[11px] text-slate-500">
              Registered by:{' '}
              <strong className="font-semibold text-slate-800">
                {customer.createdBy?.name || 'Counter Operator'}
              </strong>
            </div>
            {customer.kycVerifiedAt && (
              <div className="text-[11px] text-emerald-800 font-medium pt-0.5">
                KYC Verified by {customer.kycVerifiedBy?.name || 'Officer'}
              </div>
            )}
          </div>
        </div>

        {/* Sleek Underline Tab Navigation */}
        <div
          role="tablist"
          aria-label="Customer record sections"
          className="flex items-center gap-6 sm:gap-8 border-t border-slate-100 mt-5 pt-1 text-xs font-medium overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            id="customer-tab-kyc"
            role="tab"
            aria-selected={activeTab === 'kyc'}
            aria-controls="customer-panel-kyc"
            tabIndex={activeTab === 'kyc' ? 0 : -1}
            type="button"
            onClick={() => setTab('kyc')}
            onKeyDown={handleTabKeyDown}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all whitespace-nowrap cursor-pointer -mb-px text-xs ${
              activeTab === 'kyc'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
            }`}
          >
            <ShieldCheck className={`w-4 h-4 ${activeTab === 'kyc' ? 'text-emerald-700' : 'text-slate-400'}`} />
            <span>KYC Documents</span>
            <span
              className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-mono tabular-nums ${
                activeTab === 'kyc'
                  ? 'bg-emerald-100 text-emerald-800 font-semibold'
                  : 'bg-slate-100 text-slate-500 font-normal'
              }`}
            >
              {kycDocs?.length || 0}
            </span>
          </button>

          <button
            id="customer-tab-profile"
            role="tab"
            aria-selected={activeTab === 'profile'}
            aria-controls="customer-panel-profile"
            tabIndex={activeTab === 'profile' ? 0 : -1}
            type="button"
            onClick={() => setTab('profile')}
            onKeyDown={handleTabKeyDown}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all whitespace-nowrap cursor-pointer -mb-px text-xs ${
              activeTab === 'profile'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
            }`}
          >
            <User className={`w-4 h-4 ${activeTab === 'profile' ? 'text-emerald-700' : 'text-slate-400'}`} />
            <span>Personal Profile &amp; Address</span>
          </button>

          <button
            id="customer-tab-lockers"
            role="tab"
            aria-selected={activeTab === 'lockers'}
            aria-controls="customer-panel-lockers"
            tabIndex={activeTab === 'lockers' ? 0 : -1}
            type="button"
            onClick={() => setTab('lockers')}
            onKeyDown={handleTabKeyDown}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all whitespace-nowrap cursor-pointer -mb-px text-xs ${
              activeTab === 'lockers'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
            }`}
          >
            <KeyRound className={`w-4 h-4 ${activeTab === 'lockers' ? 'text-emerald-700' : 'text-slate-400'}`} />
            <span>Locker Tenancy</span>
            <span
              className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-mono tabular-nums ${
                activeTab === 'lockers'
                  ? 'bg-emerald-100 text-emerald-800 font-semibold'
                  : 'bg-slate-100 text-slate-500 font-normal'
              }`}
            >
              {customerAllocations?.activeAllocation ? '1 Active' : '0'}
            </span>
          </button>

          <button
            id="customer-tab-billing"
            role="tab"
            aria-selected={activeTab === 'billing'}
            aria-controls="customer-panel-billing"
            tabIndex={activeTab === 'billing' ? 0 : -1}
            type="button"
            onClick={() => setTab('billing')}
            onKeyDown={handleTabKeyDown}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all whitespace-nowrap cursor-pointer -mb-px text-xs ${
              activeTab === 'billing'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === 'billing' ? 'text-emerald-700' : 'text-slate-400'}`} />
            <span>Billing Statements</span>
            <span
              className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-mono tabular-nums ${
                activeTab === 'billing'
                  ? 'bg-emerald-100 text-emerald-800 font-semibold'
                  : 'bg-slate-100 text-slate-500 font-normal'
              }`}
            >
              {customerInvoices?.length || 0}
            </span>
          </button>

          <button
            id="customer-tab-payments"
            role="tab"
            aria-selected={activeTab === 'payments'}
            aria-controls="customer-panel-payments"
            tabIndex={activeTab === 'payments' ? 0 : -1}
            type="button"
            onClick={() => setTab('payments')}
            onKeyDown={handleTabKeyDown}
            className={`flex items-center gap-2 py-3 border-b-2 transition-all whitespace-nowrap cursor-pointer -mb-px text-xs ${
              activeTab === 'payments'
                ? 'border-emerald-700 text-emerald-800 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-medium'
            }`}
          >
            <Receipt className={`w-4 h-4 ${activeTab === 'payments' ? 'text-emerald-700' : 'text-slate-400'}`} />
            <span>Payments &amp; Receipts</span>
            <span
              className={`text-[10.5px] px-1.5 py-0.5 rounded-full font-mono tabular-nums ${
                activeTab === 'payments'
                  ? 'bg-emerald-100 text-emerald-800 font-semibold'
                  : 'bg-slate-100 text-slate-500 font-normal'
              }`}
            >
              {customerPayments?.length || 0}
            </span>
          </button>
        </div>
      </div>

      {/* Executive Customer KPI Summary Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Active Locker Tenancy */}
        <div 
          onClick={() => setTab('lockers')}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Tenancy
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center group-hover:scale-105 transition-transform border border-emerald-100">
              <KeyRound className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-2.5">
            {customerAllocations?.activeAllocation ? (
              <>
                <div className="text-base sm:text-lg font-bold text-slate-900 font-sans tracking-tight">
                  Locker #{customerAllocations.activeAllocation.lockerId?.lockerNumber}
                </div>
                <div className="text-xs text-slate-500 font-normal mt-0.5 flex items-center gap-1.5">
                  <span>Size {customerAllocations.activeAllocation.lockerId?.size}</span>
                  <span>&bull;</span>
                  <span>
                    {(() => {
                      const rawRack = customerAllocations.activeAllocation.lockerId?.rackNumber || '01';
                      return rawRack.toLowerCase().startsWith('rack') ? rawRack : `Rack ${rawRack}`;
                    })()}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-slate-600">
                  No Active Locker
                </div>
                <div className="text-xs text-slate-400 font-normal mt-0.5">
                  Customer unallocated
                </div>
              </>
            )}
          </div>
        </div>

        {/* KPI 2: Outstanding Balance */}
        <div 
          onClick={() => {
            if (invoiceMetrics.totalBalance > 0 && firstUnpaidInvoice) {
              setRecordPaymentInvoiceId(firstUnpaidInvoice._id);
            } else {
              setTab('billing');
            }
          }}
          className={`bg-white p-4 rounded-2xl border shadow-2xs transition-all cursor-pointer group ${
            invoiceMetrics.totalBalance > 0 
              ? 'border-amber-200/90 hover:border-amber-400 hover:shadow-xs bg-gradient-to-br from-white via-white to-amber-50/20' 
              : 'border-slate-200/90 hover:border-emerald-300 hover:shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Outstanding Dues
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform border ${
              invoiceMetrics.totalBalance > 0 
                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                : 'bg-emerald-50 text-emerald-800 border-emerald-100'
            }`}>
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className={`text-base sm:text-lg font-bold font-sans tracking-tight ${
              invoiceMetrics.totalBalance > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}>
              {formatINR(invoiceMetrics.totalBalance)}
            </div>
            <div className="text-xs mt-0.5 flex items-center justify-between">
              {invoiceMetrics.totalBalance > 0 ? (
                <span className="text-amber-600 font-medium">
                  {invoiceMetrics.unpaidCount} unpaid bill{invoiceMetrics.unpaidCount > 1 ? 's' : ''} &bull; Click to pay
                </span>
              ) : (
                <span className="text-emerald-700 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> All dues cleared
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPI 3: Security Caution Deposit */}
        <div 
          onClick={() => setTab('lockers')}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Security Deposit
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform border border-slate-200">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-slate-900 font-sans tracking-tight">
              {formatINR(customerAllocations?.activeAllocation?.securityDeposit || 0)}
            </div>
            <div className="text-xs text-slate-500 font-normal mt-0.5">
              Held in Custody Reserve
            </div>
          </div>
        </div>

        {/* KPI 4: Total Billed */}
        <div 
          onClick={() => setTab('billing')}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Invoiced
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-50 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform border border-slate-200">
              <FileText className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="mt-2.5">
            <div className="text-base sm:text-lg font-bold text-slate-900 font-sans tracking-tight">
              {formatINR(invoiceMetrics.totalInvoiced)}
            </div>
            <div className="text-xs text-slate-500 font-normal mt-0.5">
              {customerInvoices?.length || 0} statement{customerInvoices?.length === 1 ? '' : 's'} issued
            </div>
          </div>
        </div>
      </div>

      {/* Tab 1: KYC Documents */}
      {activeTab === 'kyc' && (
        <Card id="customer-panel-kyc" role="tabpanel" aria-labelledby="customer-tab-kyc" tabIndex={0} className="border-slate-200/90 shadow-2xs focus:outline-none rounded-2xl">
          <CardContent className="p-4 sm:p-6">
            <KycDocumentList
              documents={kycDocs || []}
              isLoading={isKycLoading}
              customerKycStatus={customer.kycStatus}
              customerName={customer.fullName}
              customerCode={customer.customerCode}
              onAddDocument={() => {
                setEditingKycDoc(null);
                setIsKycModalOpen(true);
              }}
              onEditDocument={(doc) => {
                setEditingKycDoc(doc);
                setIsKycModalOpen(true);
              }}
              onVerifyDocument={async (kycId, input) => {
                await verifyKycDocMutation.mutateAsync({ kycId, input });
              }}
              onDeleteDocument={async (kycId) => {
                const doc = kycDocs?.find((d) => d._id === kycId);
                if (doc) setDeletingKycDoc(doc);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Profile & Demographics */}
      {activeTab === 'profile' && (
        <div id="customer-panel-profile" role="tabpanel" aria-labelledby="customer-tab-profile" tabIndex={0} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs focus:outline-none">
          {/* Identity & Personal Info */}
          <Card className="border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Personal Demographics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 font-normal text-slate-700">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="text-slate-500">Date of Birth</span>
                <span className="font-medium text-slate-900 font-sans tabular-nums">
                  {customer.dateOfBirth || 'Not recorded'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="text-slate-500">Gender</span>
                <span className="font-medium text-slate-900">
                  {customer.gender || 'OTHER'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="text-slate-500">Alternate Phone</span>
                <span className="font-sans font-medium text-slate-900 tabular-nums">
                  {formatPhone(customer.alternatePhone)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Country of Residence</span>
                <span className="font-medium text-slate-900">
                  {customer.country || 'India'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Postal Address */}
          <Card className="border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Residential Postal Address
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3 font-normal text-slate-700">
              <div>
                <span className="text-[10.5px] uppercase font-medium text-slate-400 block mb-1">
                  Street / Premise Address
                </span>
                <p className="text-slate-800 font-normal">
                  {customer.address || 'No street address provided.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-100">
                <div>
                  <span className="text-[10.5px] text-slate-400 block font-normal">City</span>
                  <span className="font-medium text-slate-800">{customer.city || '-'}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-slate-400 block font-normal">State</span>
                  <span className="font-medium text-slate-800">{customer.state || '-'}</span>
                </div>
                <div>
                  <span className="text-[10.5px] text-slate-400 block font-normal">Postal PIN</span>
                  <span className="font-sans font-medium text-slate-800 tabular-nums">
                    {customer.postalCode || '-'}
                  </span>
                </div>
              </div>

              {customer.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10.5px] uppercase font-medium text-slate-400 block mb-1">
                    Staff Notes
                  </span>
                  <p className="text-slate-600 bg-slate-50/80 p-3 rounded-xl border border-slate-100 font-normal">
                    {customer.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Locker Tenancy History */}
      {activeTab === 'lockers' && (
        <div id="customer-panel-lockers" role="tabpanel" aria-labelledby="customer-tab-lockers" tabIndex={0} className="space-y-4 focus:outline-none">
          {/* Active Locker Card */}
          {customerAllocations?.activeAllocation ? (
            <Card className="border-emerald-200/90 bg-emerald-50/40 rounded-2xl shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b border-emerald-100/80 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    <KeyRound className="w-4.5 h-4.5 text-emerald-800" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold text-slate-900">
                      Currently Assigned Physical Locker
                    </CardTitle>
                    <p className="text-[11px] text-slate-500 font-normal">
                      Active agreement #{customerAllocations.activeAllocation.allocationCode}
                    </p>
                  </div>
                </div>
                <AllocationStatusBadge status={customerAllocations.activeAllocation.status} />
              </CardHeader>
              <CardContent className="p-5 font-normal">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10.5px] text-slate-400 font-medium uppercase tracking-wider block">
                      Locker Number
                    </span>
                    <strong className="text-base text-slate-900 font-sans font-semibold">
                      #{customerAllocations.activeAllocation.lockerId?.lockerNumber}
                    </strong>
                    <span className="ml-1.5 text-[10.5px] px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium">
                      Size {customerAllocations.activeAllocation.lockerId?.size}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10.5px] text-slate-400 font-medium uppercase tracking-wider block">
                      Physical Rack & Section
                    </span>
                    <strong className="text-xs text-slate-800 font-medium font-sans">
                      {customerAllocations.activeAllocation.lockerId?.rackNumber}
                    </strong>
                    <p className="text-[11px] text-slate-500 font-normal">
                      {customerAllocations.activeAllocation.lockerId?.section || 'Main Vault'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10.5px] text-slate-400 font-medium uppercase tracking-wider block">
                      Start Date / Cycle
                    </span>
                    <strong className="text-xs text-slate-800 font-sans font-medium tabular-nums">
                      {new Date(customerAllocations.activeAllocation.startDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </strong>
                    <p className="text-[10px] text-slate-500 uppercase font-medium">
                      {customerAllocations.activeAllocation.billingCycle}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10.5px] text-slate-400 font-medium uppercase tracking-wider block">
                      Agreed Annual Rent
                    </span>
                    <strong className="text-sm text-emerald-800 font-sans font-semibold tabular-nums">
                      {formatINR(customerAllocations.activeAllocation.rentSnapshot ?? customerAllocations.activeAllocation.annualRent)}
                    </strong>
                    <p className="text-[10px] text-slate-500 tabular-nums">
                      Deposit: {formatINR(customerAllocations.activeAllocation.depositSnapshot ?? customerAllocations.activeAllocation.securityDeposit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200/90 rounded-2xl shadow-xs text-center py-10 px-6">
              <CardContent className="space-y-3 max-w-md mx-auto">
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    No Active Locker Tenancy
                  </h3>
                  <p className="text-xs text-slate-500 font-normal mt-1">
                    This customer currently has no assigned safe-deposit locker.
                  </p>
                </div>
                <Link to={`/allocations?allocateCustomer=${customer._id}`}>
                  <Button size="sm" className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold rounded-xl mt-2 cursor-pointer shadow-xs flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Allocate a Locker</span>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Historical Allocations Table */}
          {customerAllocations?.history && customerAllocations.history.length > 0 && (
            <Card className="border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Past Tenancy History ({customerAllocations.history.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 font-medium text-[11px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Agreement</th>
                      <th className="p-3.5">Locker</th>
                      <th className="p-3.5">Start Date</th>
                      <th className="p-3.5">Rent</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                    {customerAllocations.history.map((hist: any) => (
                      <tr key={hist._id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="p-3.5 font-sans font-medium text-slate-900">{hist.allocationCode}</td>
                        <td className="p-3.5 font-sans font-medium text-slate-800">
                          #{hist.lockerId?.lockerNumber} (Size {hist.lockerId?.size})
                        </td>
                        <td className="p-3.5 font-sans tabular-nums text-slate-600">
                          {new Date(hist.startDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="p-3.5 font-sans font-medium text-slate-900 tabular-nums">
                          {formatINR(hist.rentSnapshot ?? hist.annualRent)}
                        </td>
                        <td className="p-3.5">
                          <AllocationStatusBadge status={hist.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab 4: Billing & Renewals History */}
      {activeTab === 'billing' && (
        <div id="customer-panel-billing" role="tabpanel" aria-labelledby="customer-tab-billing" tabIndex={0} className="space-y-4 focus:outline-none">
          {/* Executive Financial Summary Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Card className="border-slate-200/90 rounded-2xl shadow-2xs bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                  Total Invoiced
                </span>
                <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-sans text-slate-900 tabular-nums">
                  {formatINR(invoiceMetrics.totalInvoiced)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal mt-0.5">
                {customerInvoices?.length || 0} invoice{customerInvoices?.length === 1 ? '' : 's'} generated
              </p>
            </Card>

            <Card className="border-emerald-200/80 rounded-2xl shadow-2xs bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">
                  Total Settled
                </span>
                <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold font-sans text-emerald-800 tabular-nums">
                  {formatINR(invoiceMetrics.totalSettled)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 font-normal mt-0.5">
                Collections credited
              </p>
            </Card>

            <Card className={`rounded-2xl shadow-2xs p-4 ${
              invoiceMetrics.totalBalance > 0
                ? 'border-amber-200 bg-amber-50/40'
                : 'border-slate-200/90 bg-white'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${
                  invoiceMetrics.totalBalance > 0 ? 'text-amber-800' : 'text-slate-500'
                }`}>
                  Outstanding Balance
                </span>
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                  invoiceMetrics.totalBalance > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-xl font-bold font-sans tabular-nums ${
                  invoiceMetrics.totalBalance > 0 ? 'text-rose-600' : 'text-slate-900'
                }`}>
                  {formatINR(invoiceMetrics.totalBalance)}
                </span>
              </div>
              <p className={`text-[11px] font-normal mt-0.5 ${
                invoiceMetrics.totalBalance > 0 ? 'text-amber-800' : 'text-slate-400'
              }`}>
                {invoiceMetrics.unpaidCount > 0
                  ? `${invoiceMetrics.unpaidCount} invoice${invoiceMetrics.unpaidCount === 1 ? '' : 's'} pending payment`
                  : 'All dues settled'}
              </p>
            </Card>
          </div>

          {isInvoicesLoading ? (
            <div className="p-8 text-center text-slate-400 font-normal animate-pulse bg-white rounded-2xl border border-slate-200">
              Loading Billing Invoices...
            </div>
          ) : !customerInvoices || customerInvoices.length === 0 ? (
            <Card className="border-slate-200/90 rounded-2xl shadow-xs text-center py-10 px-6">
              <CardContent className="space-y-3 max-w-md mx-auto">
                <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    No Billing Records Found
                  </h3>
                  <p className="text-xs text-slate-500 font-normal mt-1">
                    No billing statements or renewal invoices have been issued for this customer yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Invoices & Renewal Statements ({customerInvoices.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 font-medium text-[11px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Invoice Number</th>
                      <th className="p-3.5">Locker</th>
                      <th className="p-3.5">Due Date</th>
                      <th className="p-3.5">Billing Period</th>
                      <th className="p-3.5 text-right">Amount</th>
                      <th className="p-3.5 text-right">Balance</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                    {customerInvoices.map((inv: any) => (
                      <tr key={inv._id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="p-3.5 font-sans font-medium text-slate-900">
                          <span className="font-semibold block">{inv.invoiceNumber}</span>
                          {inv.legacyReference && (
                            <span className="text-[10.5px] text-slate-400 block font-normal">
                              Ref: {inv.legacyReference}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-sans">
                          <strong className="font-medium text-slate-800">
                            #{inv.lockerId?.lockerNumber}
                          </strong>
                          <span className="ml-1 text-[11px] text-slate-500">
                            (Size {inv.lockerId?.size})
                          </span>
                        </td>
                        <td className="p-3.5 font-sans tabular-nums text-slate-600">
                          {new Date(inv.dueDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="p-3.5 text-[11px] font-sans tabular-nums text-slate-500">
                          {new Date(inv.billingPeriodStart).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })} –{' '}
                          {new Date(inv.billingPeriodEnd).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="p-3.5 text-right font-semibold font-sans tabular-nums text-slate-900">
                          {formatINR(inv.totalAmount)}
                        </td>
                        <td className="p-3.5 text-right font-semibold font-sans tabular-nums">
                          <span className={inv.balanceAmount > 0 ? 'text-rose-600' : 'text-slate-500'}>
                            {formatINR(inv.balanceAmount)}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <PaymentStatusBadge status={inv.paymentStatus} />
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {inv.balanceAmount > 0 && inv.status !== 'CANCELLED' && (
                              <Button
                                size="sm"
                                onClick={() => setRecordPaymentInvoiceId(inv._id)}
                                className="h-7 px-2.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-medium cursor-pointer shadow-2xs inline-flex items-center gap-1"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Collect</span>
                              </Button>
                            )}
                            {inv.balanceAmount <= 0 && (
                              <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                <span>Settled</span>
                              </span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => renewalApi.printInvoicePdf(inv._id, inv.invoiceNumber)}
                              className="h-7 px-2 rounded-lg text-xs text-slate-600 border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs inline-flex items-center gap-1"
                              title="Print Invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Tab 5: Payments & Receipts History */}
      {activeTab === 'payments' && (
        <div id="customer-panel-payments" role="tabpanel" aria-labelledby="customer-tab-payments" tabIndex={0} className="space-y-4 focus:outline-none">
          {isPaymentsLoading ? (
            <div className="p-8 text-center text-slate-400 font-normal animate-pulse bg-white rounded-2xl border border-slate-200">
              Loading Payment History...
            </div>
          ) : !customerPayments || customerPayments.length === 0 ? (
            <Card className="border-slate-200/90 rounded-2xl shadow-xs text-center py-10 px-6">
              <CardContent className="space-y-3 max-w-md mx-auto">
                <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto border border-emerald-200/80">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    No Payment Transactions
                  </h3>
                  <p className="text-xs text-slate-500 font-normal mt-1">
                    No payment collections have been recorded for this customer yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  Payment History & Receipts ({customerPayments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-slate-500 font-medium text-[11px] uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-3.5">Receipt / Payment No</th>
                      <th className="p-3.5">Date</th>
                      <th className="p-3.5">Locker & Invoice</th>
                      <th className="p-3.5">Mode</th>
                      <th className="p-3.5 text-right">Amount Received</th>
                      <th className="p-3.5 text-center">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                    {customerPayments.map((p: any) => (
                      <tr key={p._id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="p-3.5 font-sans font-medium text-slate-900">
                          <span className="text-emerald-800 font-semibold block">{p.receiptNumber}</span>
                          <span className="text-[10.5px] text-slate-400 font-normal">{p.paymentNumber}</span>
                        </td>
                        <td className="p-3.5 font-sans tabular-nums text-slate-700">
                          {new Date(p.paymentDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="p-3.5 font-sans">
                          <strong className="text-slate-800 font-medium">
                            Locker #{p.lockerId?.lockerNumber}
                          </strong>
                          <span className="text-[10.5px] text-slate-400 block font-normal">
                            {p.invoiceId?.invoiceNumber}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <PaymentMethodBadge method={p.paymentMethod} />
                        </td>
                        <td className="p-3.5 text-right font-sans font-semibold text-emerald-800 text-sm tabular-nums">
                          {formatINR(p.amount)}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="font-medium text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {p.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingReceipt(p)}
                            className="h-8 px-2.5 rounded-xl text-xs font-medium border-slate-300 hover:bg-slate-50 cursor-pointer shadow-2xs"
                          >
                            Receipt
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Direct Record Payment Modal */}
      {recordPaymentInvoiceId && (
        <RecordPaymentModal
          initialInvoiceId={recordPaymentInvoiceId}
          onClose={() => setRecordPaymentInvoiceId(null)}
          onSubmit={async (data, idempotencyKey) => {
            return await recordPaymentMutation.mutateAsync({ data, idempotencyKey });
          }}
          onSuccessViewReceipt={(payment) => {
            setRecordPaymentInvoiceId(null);
            setViewingReceipt(payment);
          }}
        />
      )}

      {/* Printable Receipt Modal */}
      {viewingReceipt && (
        <PaymentReceiptModal
          payment={viewingReceipt}
          onClose={() => setViewingReceipt(null)}
        />
      )}

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <CustomerFormModal
          customer={customer}
          onClose={() => setIsEditProfileOpen(false)}
          onSubmit={async (data) => {
            await updateCustomerMutation.mutateAsync(data);
          }}
          isSubmitting={updateCustomerMutation.isPending}
        />
      )}

      {/* KYC Upload / Edit Modal */}
      {isKycModalOpen && (
        <KycDocumentModal
          customerId={customer._id}
          customerName={customer.fullName}
          customerCode={customer.customerCode}
          document={editingKycDoc}
          onClose={() => {
            setIsKycModalOpen(false);
            setEditingKycDoc(null);
          }}
          onSubmit={handleKycSubmit}
          isSubmitting={addKycDocMutation.isPending || updateKycDocMutation.isPending}
        />
      )}

      {/* Archive Customer Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmArchiveOpen}
        onClose={() => setConfirmArchiveOpen(false)}
        onConfirm={handleConfirmArchive}
        title={`Archive Customer ${customer.fullName}?`}
        description={
          <div>
            <p>
              Are you sure you want to archive customer{' '}
              <strong className="font-semibold text-slate-800">{customer.fullName}</strong> (
              <span className="font-mono text-slate-700">{customer.customerCode}</span>)?
            </p>
            <p className="text-slate-500 text-[11px] mt-1">
              The customer will be removed from active safe-deposit workflows. Historical invoices, payments, and KYC records will remain intact in compliance audits.
            </p>
          </div>
        }
        confirmText="Confirm Archive"
        cancelText="Cancel"
        variant="danger"
        isLoading={isArchiving}
      />

      {/* Delete KYC Document Confirmation Modal */}
      <ConfirmationModal
        isOpen={Boolean(deletingKycDoc)}
        onClose={() => setDeletingKycDoc(null)}
        onConfirm={handleConfirmDeleteKyc}
        title={`Delete ${deletingKycDoc?.documentType || 'KYC'} Document?`}
        description={
          <div>
            <p>
              Are you sure you want to permanently delete this verification proof (
              <span className="font-mono text-slate-800">
                {deletingKycDoc?.maskedDocumentNumber || deletingKycDoc?.documentNumber || 'Document'}
              </span>
              )?
            </p>
            <p className="text-rose-600 text-[11px] mt-1 font-medium">
              This action cannot be undone. The uploaded proof will be deleted from the bank registry.
            </p>
          </div>
        }
        confirmText="Delete Document"
        cancelText="Keep Document"
        variant="danger"
        isLoading={isDeletingKyc}
      />

      {/* Customer Profile Photo Lightbox Modal */}
      {customer?.photoUrl && (
        <CustomerPhotoPreviewModal
          isOpen={isPhotoPreviewOpen}
          onClose={() => setIsPhotoPreviewOpen(false)}
          photoUrl={customer.photoUrl}
          customerName={customer.fullName}
          customerCode={customer.customerCode}
          phone={customer.phone}
          email={customer.email}
        />
      )}
    </div>
  );
}

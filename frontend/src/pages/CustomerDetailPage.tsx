import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
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
  Building,
  Receipt,
} from 'lucide-react';
import { customerApi } from '../features/customers/api/customerApi';
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
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { usePermission } from '../hooks/usePermission';

import { allocationApi } from '../features/allocations/api/allocationApi';
import { AllocationStatusBadge } from '../features/allocations/components/AllocationStatusBadge';
import { renewalApi } from '../features/renewals/api/renewalApi';
import { PaymentStatusBadge, DueStatusBadge } from '../features/renewals/components/RenewalStatusBadge';

import { paymentApi } from '../features/payments/api/paymentApi';
import { PaymentMethodBadge } from '../features/payments/components/PaymentMethodBadge';
import { PaymentReceiptModal } from '../features/payments/components/PaymentReceiptModal';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const canUpdate = usePermission('customers.update');
  const canDelete = usePermission('customers.delete');

  const activeTab = searchParams.get('tab') || 'kyc';
  const tabIds = ['kyc', 'profile', 'lockers', 'billing', 'payments'];

  const setTab = (tab: string) => {
    setSearchParams({ tab });
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
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [editingKycDoc, setEditingKycDoc] = useState<CustomerKycDocument | null>(
    null
  );

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

  // Mutations
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

  const handleDeactivateCustomer = async () => {
    if (!customer) return;
    if (
      window.confirm(
        `Are you sure you want to archive customer ${customer.fullName} (${customer.customerCode})?`
      )
    ) {
      await customerApi.deactivateCustomer(customer._id);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/customers');
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
        <Link to="/customers">
          <Button variant="outline" size="sm">
            Back to Customers Directory
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 select-none">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/customers')}
          className="h-11 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Customers Directory</span>
        </button>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
          {canUpdate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditProfileOpen(true)}
              className="h-11 flex items-center justify-center gap-1.5 text-xs font-semibold"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </Button>
          )}

          {canDelete && customer.isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeactivateCustomer}
              className="h-11 text-xs text-rose-600 hover:bg-rose-50 border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Archive</span>
            </Button>
          )}
        </div>
      </div>

      {/* Customer Header Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            {customer.photoUrl ? (
              <img
                src={customer.photoUrl}
                alt={customer.fullName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-slate-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xl sm:text-2xl shrink-0 border border-slate-200">
                {customer.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {customer.fullName}
                </h1>
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-bold bg-slate-50 border-slate-300 text-slate-700"
                >
                  {customer.customerCode}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <CustomerStatusBadge status={customer.status} />
                <KycStatusBadge status={customer.kycStatus} />
                {customer.city && (
                  <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {customer.city}, {customer.state || 'India'}
                    </span>
                  </span>
                )}
              </div>

              {/* Verified Contact Details */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1 font-medium">
                <span className="flex items-center gap-1.5 font-mono text-slate-900 font-bold">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formatPhone(customer.phone)}</span>
                </span>
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="flex items-center gap-1.5 text-slate-600 hover:text-blue-700 min-w-0">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{customer.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Audit Timestamp Stamps */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs space-y-1 md:text-right shrink-0">
            <div className="text-[11px] text-slate-500">
              Registered on:{' '}
              <strong className="text-slate-800">
                {new Date(customer.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </strong>
            </div>
            <div className="text-[11px] text-slate-500">
              Registered by:{' '}
              <strong className="text-slate-800">
                {customer.createdBy?.name || 'Counter Operator'}
              </strong>
            </div>
            {customer.kycVerifiedAt && (
              <div className="text-[11px] text-emerald-700 font-semibold pt-0.5">
                KYC Verified by {customer.kycVerifiedBy?.name || 'Officer'}
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div role="tablist" aria-label="Customer record sections" className="flex items-center gap-2 border-t border-slate-100 mt-6 pt-4 text-xs font-semibold overflow-x-auto pb-1">
          <button
            id="customer-tab-kyc"
            role="tab"
            aria-selected={activeTab === 'kyc'}
            aria-controls="customer-panel-kyc"
            tabIndex={activeTab === 'kyc' ? 0 : -1}
            type="button"
            onClick={() => setTab('kyc')}
            onKeyDown={handleTabKeyDown}
            className={`h-11 px-4 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeTab === 'kyc'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>KYC Documents ({kycDocs?.length || 0})</span>
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
            className={`h-11 px-4 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeTab === 'profile'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Personal Profile & Address</span>
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
            className={`h-11 px-4 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeTab === 'lockers'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Locker History</span>
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
            className={`h-11 px-4 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeTab === 'billing'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Billing Statements ({customerInvoices?.length || 0})</span>
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
            className={`h-11 px-4 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              activeTab === 'payments'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Payments & Receipts ({customerPayments?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: KYC Documents */}
      {activeTab === 'kyc' && (
        <Card id="customer-panel-kyc" role="tabpanel" aria-labelledby="customer-tab-kyc" tabIndex={0} className="border-slate-200 shadow-2xs focus:outline-none">
          <CardContent className="p-4 sm:p-6">
            <KycDocumentList
              documents={kycDocs || []}
              isLoading={isKycLoading}
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
                if (window.confirm('Delete this KYC document proof?')) {
                  await deleteKycDocMutation.mutateAsync(kycId);
                }
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Tab 2: Profile & Demographics */}
      {activeTab === 'profile' && (
        <div id="customer-panel-profile" role="tabpanel" aria-labelledby="customer-tab-profile" tabIndex={0} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 text-xs focus:outline-none">
          {/* Identity & Personal Info */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900">
                Personal Demographics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Date of Birth</span>
                <span className="font-semibold text-slate-900">
                  {customer.dateOfBirth || 'Not recorded'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Gender</span>
                <span className="font-semibold text-slate-900">
                  {customer.gender || 'OTHER'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Alternate / Nominee Phone</span>
                <span className="font-mono text-slate-900">
                  {formatPhone(customer.alternatePhone)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Country of Residence</span>
                <span className="font-semibold text-slate-900">
                  {customer.country || 'India'}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Postal Address */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900">
                Residential Postal Address
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Street / Premise Address
                </span>
                <p className="text-slate-800 font-medium">
                  {customer.address || 'No street address provided.'}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 block">City</span>
                  <span className="font-bold text-slate-800">{customer.city || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">State</span>
                  <span className="font-bold text-slate-800">{customer.state || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Postal PIN</span>
                  <span className="font-mono font-bold text-slate-800">
                    {customer.postalCode || '-'}
                  </span>
                </div>
              </div>

              {customer.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Staff Notes
                  </span>
                  <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg">
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
            <Card className="border-emerald-200 bg-emerald-50/40 shadow-2xs">
              <CardHeader className="pb-3 border-b border-emerald-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-black text-slate-900">
                      Currently Assigned Physical Locker
                    </CardTitle>
                    <p className="text-[11px] text-slate-500">
                      Active agreement #{customerAllocations.activeAllocation.allocationCode}
                    </p>
                  </div>
                </div>
                <AllocationStatusBadge status={customerAllocations.activeAllocation.status} />
              </CardHeader>
              <CardContent className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Locker Number
                    </span>
                    <strong className="text-base text-slate-900 font-mono">
                      #{customerAllocations.activeAllocation.lockerId?.lockerNumber}
                    </strong>
                    <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-900 font-mono font-bold">
                      Size {customerAllocations.activeAllocation.lockerId?.size}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Physical Rack & Section
                    </span>
                    <strong className="text-xs text-slate-800">
                      {customerAllocations.activeAllocation.lockerId?.rackNumber}
                    </strong>
                    <p className="text-[11px] text-slate-500">
                      {customerAllocations.activeAllocation.lockerId?.section || 'Main Vault'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Start Date / Cycle
                    </span>
                    <strong className="text-xs text-slate-800 font-mono">
                      {new Date(customerAllocations.activeAllocation.startDate).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </strong>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">
                      {customerAllocations.activeAllocation.billingCycle}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Agreed Annual Rent
                    </span>
                    <strong className="text-sm text-emerald-700 font-mono font-bold">
                      ₹{(customerAllocations.activeAllocation.rentSnapshot ?? customerAllocations.activeAllocation.annualRent).toLocaleString()}
                    </strong>
                    <p className="text-[10px] text-slate-500">
                      Deposit: ₹{(customerAllocations.activeAllocation.depositSnapshot ?? customerAllocations.activeAllocation.securityDeposit).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 text-center py-10 px-6">
              <CardContent className="space-y-3 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    No Active Locker Tenancy
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    This customer currently has no assigned safe-deposit locker.
                  </p>
                </div>
                <Link to="/allocations">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl mt-2">
                    Allocate a Locker
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Historical Allocations Table */}
          {customerAllocations?.history && customerAllocations.history.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Past Tenancy History ({customerAllocations.history.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="p-3">Agreement</th>
                      <th className="p-3">Locker</th>
                      <th className="p-3">Start Date</th>
                      <th className="p-3">Rent</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customerAllocations.history.map((hist: any) => (
                      <tr key={hist._id} className="hover:bg-slate-50 font-medium">
                        <td className="p-3 font-mono font-bold text-slate-900">{hist.allocationCode}</td>
                        <td className="p-3 font-bold text-slate-800">
                          #{hist.lockerId?.lockerNumber} (Size {hist.lockerId?.size})
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {new Date(hist.startDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3 font-mono">₹{hist.rentSnapshot ?? hist.annualRent}</td>
                        <td className="p-3">
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
          {isInvoicesLoading ? (
            <div className="p-8 text-center text-slate-400 font-semibold animate-pulse bg-white rounded-2xl border border-slate-200">
              Loading Billing Invoices...
            </div>
          ) : !customerInvoices || customerInvoices.length === 0 ? (
            <Card className="border-slate-200 text-center py-10 px-6">
              <CardContent className="space-y-3 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    No Billing Records Found
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    No billing statements or renewal invoices have been issued for this customer yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Invoices & Renewal Statements ({customerInvoices.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="p-3">Invoice Number</th>
                      <th className="p-3">Locker</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Period</th>
                      <th className="p-3 text-right">Amount</th>
                      <th className="p-3 text-right">Balance</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {customerInvoices.map((inv: any) => (
                      <tr key={inv._id} className="hover:bg-slate-50 font-medium">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {inv.invoiceNumber}
                          {inv.legacyReference && (
                            <span className="text-[10px] text-slate-400 block font-normal">
                              {inv.legacyReference}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-800">
                          #{inv.lockerId?.lockerNumber} (Size {inv.lockerId?.size})
                        </td>
                        <td className="p-3 font-mono text-slate-600">
                          {new Date(inv.dueDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3 text-[11px] font-mono text-slate-500">
                          {new Date(inv.billingPeriodStart).toLocaleDateString('en-IN')} -{' '}
                          {new Date(inv.billingPeriodEnd).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-black font-mono">
                          ₹{inv.totalAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-right font-black font-mono">
                          <span className={inv.balanceAmount > 0 ? 'text-rose-600' : 'text-slate-500'}>
                            ₹{inv.balanceAmount.toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <PaymentStatusBadge status={inv.paymentStatus} />
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
            <div className="p-8 text-center text-slate-400 font-semibold animate-pulse bg-white rounded-2xl border border-slate-200">
              Loading Payment History...
            </div>
          ) : !customerPayments || customerPayments.length === 0 ? (
            <Card className="border-slate-200 text-center py-10 px-6">
              <CardContent className="space-y-3 max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">
                    No Payment Transactions
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    No payment collections have been recorded for this customer yet.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Payment History & Receipts ({customerPayments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="p-3">Receipt / Payment No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Locker & Invoice</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3 text-right">Amount Received</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {customerPayments.map((p: any) => (
                      <tr key={p._id} className="hover:bg-emerald-50/30">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          <span className="text-emerald-700 block">{p.receiptNumber}</span>
                          <span className="text-[10px] text-slate-400 font-normal">{p.paymentNumber}</span>
                        </td>
                        <td className="p-3 font-mono text-slate-700">
                          {new Date(p.paymentDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-3">
                          <strong className="text-slate-800 font-mono">
                            Locker #{p.lockerId?.lockerNumber}
                          </strong>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {p.invoiceId?.invoiceNumber}
                          </span>
                        </td>
                        <td className="p-3">
                          <PaymentMethodBadge method={p.paymentMethod} />
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-700 text-sm">
                          ₹{p.amount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {p.paymentStatus}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewingReceipt(p)}
                            className="h-8 px-2.5 rounded-xl text-xs font-bold"
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
          document={editingKycDoc}
          onClose={() => {
            setIsKycModalOpen(false);
            setEditingKycDoc(null);
          }}
          onSubmit={handleKycSubmit}
          isSubmitting={addKycDocMutation.isPending || updateKycDocMutation.isPending}
        />
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Calendar,
  Edit3,
  Copy,
  Check,
  CheckCircle2,
  KeyRound,
  FileText,
  AlertTriangle,
  Receipt,
  Layers,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Clock,
  ShieldAlert,
  CreditCard,
} from 'lucide-react';
import { Customer } from '../types';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import { KycStatusBadge } from './KycStatusBadge';
import { formatPhone } from '../utils/phoneFormatter';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { allocationApi } from '../../allocations/api/allocationApi';
import { customerApi } from '../api/customerApi';
import { renewalApi } from '../../renewals/api/renewalApi';
import { formatINR } from '../../lockers/utils/formatters';

interface CustomerQuickPreviewProps {
  customer: Customer | null;
  onClose: () => void;
  onEdit?: (customer: Customer) => void;
  onManageKyc?: (customer: Customer) => void;
}

export function CustomerQuickPreview({
  customer,
  onClose,
  onEdit,
  onManageKyc,
}: CustomerQuickPreviewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const customerId = customer?._id;

  // Live query for Customer Allocations (Active Locker)
  const { data: allocationsData, isLoading: isAllocationsLoading } = useQuery({
    queryKey: ['customer-allocations', customerId],
    queryFn: () => allocationApi.getCustomerAllocations(customerId!),
    enabled: Boolean(customerId),
    staleTime: 30_000,
  });

  // Live query for Customer KYC Documents
  const { data: kycDocs, isLoading: isKycLoading } = useQuery({
    queryKey: ['customer-kyc', customerId],
    queryFn: () => customerApi.getKycDocuments(customerId!),
    enabled: Boolean(customerId),
    staleTime: 30_000,
  });

  // Live query for Customer Invoices / Outstanding Dues
  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['customer-invoices', customerId],
    queryFn: () => renewalApi.getCustomerInvoices(customerId!),
    enabled: Boolean(customerId),
    staleTime: 30_000,
  });

  if (!customer) return null;

  const activeAllocation = allocationsData?.activeAllocation;
  const unpaidInvoices = invoicesData?.filter((inv: any) => inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'PARTIAL') || [];
  const totalUnpaidDue = unpaidInvoices.reduce((sum: number, inv: any) => sum + (inv.balanceAmount || inv.totalAmount || 0), 0);

  const drawerContent = (
    <div
      className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-end bg-slate-950/60 backdrop-blur-[2px] select-none animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg sm:max-w-xl h-full bg-slate-50 flex flex-col justify-between border-l border-slate-200 shadow-2xl animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 bg-white border-b border-slate-200/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs shrink-0 ring-1 ring-slate-800">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight truncate">
                  Walk-in Customer Quick Dossier
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-[11px] sm:text-[11.5px] text-slate-500 font-normal mt-0.5 truncate">
                Counter Lookup • Identity, Vault Allocations &amp; Financial Dues
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/customers/${customer._id}`, {
                  state: { from: location.pathname + location.search },
                });
              }}
              className="h-8 px-2.5 rounded-xl text-xs font-medium text-slate-700 hover:text-emerald-800 bg-slate-50 hover:bg-emerald-50 border-slate-200 hover:border-emerald-200 cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              title="Open Full Customer Page"
            >
              <span className="hidden sm:inline">Full Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="grid h-8.5 w-8.5 sm:h-9 sm:w-9 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200 shrink-0"
              aria-label="Close lookup drawer (ESC)"
              title="Close (ESC)"
            >
              <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 text-xs">
          {/* 1. Customer Profile Card Header */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-3.5">
              <div className="flex items-center gap-3 sm:gap-3.5">
                {customer.photoUrl ? (
                  <img
                    src={customer.photoUrl}
                    alt={customer.fullName}
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white border border-slate-800 flex items-center justify-center font-bold text-base sm:text-lg shrink-0 font-sans tracking-wide shadow-xs ring-1 ring-slate-900/10">
                    {customer.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-bold text-slate-900 leading-tight truncate font-sans">
                      {customer.fullName}
                    </h2>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(customer.customerCode, 'code')}
                      className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/80 px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 tabular-nums cursor-pointer transition-colors"
                      title="Click to copy customer code"
                    >
                      <span>{customer.customerCode}</span>
                      {copiedField === 'code' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-400" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <CustomerStatusBadge status={customer.status} />
                    <KycStatusBadge status={customer.kycStatus} />
                    {customer.createdAt && (
                      <span className="text-[11px] text-slate-500 font-sans tabular-nums flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Since {new Date(customer.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Direct Quick Contact Buttons */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center justify-center h-8.5 w-8.5 rounded-xl bg-slate-50 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors shadow-2xs"
                  title={`Call ${customer.phone}`}
                >
                  <Phone className="w-4 h-4" />
                </a>
                {customer.phone && (
                  <a
                    href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center h-8.5 w-8.5 rounded-xl bg-slate-50 text-slate-700 hover:text-emerald-800 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-colors shadow-2xs"
                    title="WhatsApp Chat"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>
                )}
                {customer.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="inline-flex items-center justify-center h-8.5 w-8.5 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 transition-colors shadow-2xs"
                    title={`Email ${customer.email}`}
                  >
                    <Mail className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* 2. Active Safe-Deposit Locker Occupancy (Core Vault Info) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <KeyRound className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-semibold text-slate-900 text-xs tracking-tight uppercase">
                  Safe-Deposit Vault Allocation
                </h4>
              </div>
              {activeAllocation && (
                <span className="text-[10.5px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Active Tenancy
                </span>
              )}
            </div>

            {isAllocationsLoading ? (
              <div className="py-4 text-center text-slate-400 text-xs font-normal">
                Checking vault tenancy records…
              </div>
            ) : activeAllocation ? (
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50/50 via-slate-50 to-white border border-emerald-200/80 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 font-sans tracking-tight">
                        Locker #{activeAllocation.lockerId?.lockerNumber || activeAllocation.lockerId?.lockerCode}
                      </span>
                      <span className="text-[10.5px] font-medium bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                        {activeAllocation.lockerId?.size} Size
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap font-sans">
                      {activeAllocation.lockerId?.rackNumber && (
                        <span>
                          {activeAllocation.lockerId.rackNumber.toLowerCase().startsWith('rack')
                            ? activeAllocation.lockerId.rackNumber
                            : `Rack ${activeAllocation.lockerId.rackNumber}`}
                        </span>
                      )}
                      {activeAllocation.lockerId?.floor && (
                        <span>
                          • {activeAllocation.lockerId.floor.toLowerCase().includes('floor')
                            ? activeAllocation.lockerId.floor
                            : `Floor ${activeAllocation.lockerId.floor}`}
                        </span>
                      )}
                      {activeAllocation.lockerId?.section && (
                        <span>
                          • {activeAllocation.lockerId.section.toLowerCase().startsWith('section')
                            ? activeAllocation.lockerId.section
                            : `Section ${activeAllocation.lockerId.section}`}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-900 block font-sans tabular-nums">
                      {formatINR(activeAllocation.rentSnapshot ?? activeAllocation.annualRent)} / yr
                    </span>
                    <span className="text-[10.5px] text-slate-500 block font-sans tabular-nums">
                      Deposit: {formatINR(activeAllocation.depositSnapshot ?? activeAllocation.securityDeposit)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-slate-600 font-sans tabular-nums">
                  <span>
                    Started:{' '}
                    <strong className="font-semibold text-slate-800">
                      {activeAllocation.startDate
                        ? new Date(activeAllocation.startDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'N/A'}
                    </strong>
                  </span>
                  {activeAllocation.nextRenewalDueDate && (
                    <span className="text-emerald-800 font-medium">
                      Renewal Due:{' '}
                      <strong className="font-semibold">
                        {new Date(activeAllocation.nextRenewalDueDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="font-semibold text-slate-700 block text-xs">
                    No Active Locker Assigned
                  </span>
                  <p className="text-slate-500 text-[11px] font-normal">
                    Customer is in directory with 0 active lockers. Ready for new allotment.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onClose();
                    navigate('/allocations');
                  }}
                  className="h-7 text-xs rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 cursor-pointer shadow-2xs"
                >
                  Allocate
                </Button>
              </div>
            )}
          </div>

          {/* 3. Financial Standing & Billing Status */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-semibold text-slate-900 text-xs tracking-tight uppercase">
                  Financial Standing &amp; Invoices
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate(`/customers/${customer._id}?tab=billing`);
                }}
                className="text-[11px] font-medium text-emerald-800 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>{invoicesData?.length ?? 0} Invoices Total</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {isInvoicesLoading ? (
              <div className="py-2 text-center text-slate-400 text-xs font-normal">
                Loading billing history…
              </div>
            ) : totalUnpaidDue > 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <div>
                    <span className="font-bold text-xs text-rose-700 font-sans tabular-nums block">
                      {formatINR(totalUnpaidDue)} Pending Dues
                    </span>
                    <p className="text-[11px] text-amber-900 font-normal">
                      {unpaidInvoices.length} unpaid / pending renewal bill(s)
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    navigate(`/customers/${customer._id}?tab=billing`);
                  }}
                  className="h-7 text-xs px-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white cursor-pointer shadow-2xs shrink-0"
                >
                  View &amp; Collect
                </Button>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center gap-2.5 text-emerald-900 text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-medium">All dues cleared • Account in good financial standing</span>
              </div>
            )}
          </div>

          {/* 4. KYC Documents & Identity Proofs */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <h4 className="font-semibold text-slate-900 text-xs tracking-tight uppercase">
                  KYC Documents &amp; Compliance
                </h4>
              </div>
              {onManageKyc && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onManageKyc(customer);
                  }}
                  className="text-emerald-800 hover:text-emerald-950 font-semibold text-[11px] hover:underline cursor-pointer"
                >
                  Manage KYC Docs →
                </button>
              )}
            </div>

            {isKycLoading ? (
              <div className="py-2 text-center text-slate-400 text-xs font-normal">
                Loading verified documents…
              </div>
            ) : kycDocs && kycDocs.length > 0 ? (
              <div className="space-y-2">
                {kycDocs.map((doc) => (
                  <div
                    key={doc._id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-slate-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-slate-800 text-xs block">
                          {doc.documentType}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {doc.documentNumber}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {doc.verificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            ) : customer.kycStatus === 'VERIFIED' ? (
              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/70 text-xs flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    Branch Certified In-Person Verification
                  </span>
                  <p className="text-[11px] text-emerald-800/80 font-normal">
                    Physical ID &amp; address authenticated by counter officer. 0 digital attachments.
                  </p>
                </div>
                {onManageKyc && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      onManageKyc(customer);
                    }}
                    className="h-7 text-[10.5px] px-2.5 rounded-xl border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-50 cursor-pointer shrink-0"
                  >
                    Attach Scan
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                <span>No identity documents attached yet.</span>
                {onManageKyc && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      onManageKyc(customer);
                    }}
                    className="h-7 text-[10.5px] px-2.5 rounded-xl border-amber-300 bg-white text-amber-900 hover:bg-amber-100/80 cursor-pointer"
                  >
                    Upload Now
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* 5. Contact & Demographic Dossier */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
            <h4 className="font-semibold text-slate-900 text-xs tracking-tight pb-2.5 border-b border-slate-100 flex items-center gap-2 uppercase">
              <MapPin className="w-3.5 h-3.5 text-emerald-800" />
              <span>Contact &amp; Address Details</span>
            </h4>

            <div className="space-y-2.5 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-normal">
                  <Phone className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Primary Phone</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="font-sans font-medium text-slate-900 text-xs tracking-tight tabular-nums">
                    {formatPhone(customer.phone)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(customer.phone, 'phone')}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Copy phone"
                  >
                    {copiedField === 'phone' ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              {customer.alternatePhone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-normal">Alternate Phone</span>
                  <span className="font-sans font-medium text-slate-700 text-xs tracking-tight tabular-nums">
                    {formatPhone(customer.alternatePhone)}
                  </span>
                </div>
              )}

              {customer.email && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5 font-normal">
                    <Mail className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Email Address</span>
                  </span>
                  <span className="text-slate-800 font-medium truncate max-w-[220px] text-xs">
                    {customer.email}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-slate-700 leading-relaxed font-normal text-xs">
                  {(() => {
                    const parts = [
                      customer.address?.trim(),
                      customer.city && customer.city !== 'Main Vault' ? customer.city.trim() : '',
                      customer.state && customer.state !== 'Operational' ? customer.state.trim() : '',
                      customer.postalCode?.trim(),
                    ].filter(Boolean);
                    return parts.length > 0 ? parts.join(', ') : 'No permanent address registered';
                  })()}
                </p>
              </div>

              {customer.dateOfBirth && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-slate-600">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    DOB: <strong className="font-semibold text-slate-800">{customer.dateOfBirth}</strong> {customer.gender ? `(${customer.gender})` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 6. Counter Notes & Operator Remarks */}
          {customer.notes && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs space-y-1">
              <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-700" />
                <span>Internal Counter Notes:</span>
              </span>
              <p className="text-amber-800 leading-relaxed font-normal">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-3.5 sm:px-6 sm:py-3.5 bg-white border-t border-slate-200/90 flex items-center justify-between gap-2 shrink-0 shadow-lg">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9 px-3.5 hover:bg-slate-50 cursor-pointer"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            {onManageKyc && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onManageKyc(customer);
                }}
                className="flex items-center gap-1.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs h-9 px-3 cursor-pointer whitespace-nowrap"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>KYC</span>
              </Button>
            )}

            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(customer);
                }}
                className="flex items-center gap-1.5 rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs h-9 px-3 cursor-pointer whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span>Edit</span>
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => {
                onClose();
                navigate(`/customers/${customer._id}`, {
                  state: { from: location.pathname + location.search },
                });
              }}
              className="bg-emerald-800 hover:bg-emerald-900 text-white font-semibold shadow-xs flex items-center gap-1.5 rounded-xl px-3.5 sm:px-4 text-xs h-9 cursor-pointer whitespace-nowrap"
            >
              <span>Full Profile</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}


import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Calendar,
  KeyRound,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  IndianRupee,
  Phone,
  Layers,
  ArrowRight,
  Percent,
  Sparkles,
  Clock,
} from 'lucide-react';
import { allocationApi } from '../../allocations/api/allocationApi';
import { LockerAllocation } from '../../allocations/types';
import { GenerateRenewalInput, BillingCycle } from '../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatPhone } from '../../customers/utils/phoneFormatter';
import { formatINR } from '../../lockers/utils/formatters';

interface GenerateRenewalModalProps {
  preSelectedAllocation?: LockerAllocation | null;
  onClose: () => void;
  onSubmit: (data: GenerateRenewalInput) => Promise<void>;
  isSubmitting: boolean;
}

export function GenerateRenewalModal({
  preSelectedAllocation = null,
  onClose,
  onSubmit,
  isSubmitting,
}: GenerateRenewalModalProps) {
  const [allocationQuery, setAllocationQuery] = useState('');
  const [allocationList, setAllocationList] = useState<LockerAllocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<LockerAllocation | null>(
    preSelectedAllocation
  );

  const initialStartDate = preSelectedAllocation?.nextRenewalDueDate
    ? new Date(preSelectedAllocation.nextRenewalDueDate).toISOString().slice(0, 10)
    : preSelectedAllocation?.endDate
    ? new Date(
        new Date(preSelectedAllocation.endDate).setDate(
          new Date(preSelectedAllocation.endDate).getDate() + 1
        )
      )
        .toISOString()
        .slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const [startDate, setStartDate] = useState(initialStartDate);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(
    preSelectedAllocation?.billingCycle || 'ANNUAL'
  );
  const [baseRent, setBaseRent] = useState<number>(
    preSelectedAllocation?.rentSnapshot || preSelectedAllocation?.annualRent || 1655
  );
  const [discount, setDiscount] = useState<number>(0);
  const [lateFee, setLateFee] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);
  const [gstRate, setGstRate] = useState<number>(0); // 0 or 18
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Focus & Escape key handling
  useEffect(() => {
    titleRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, isSubmitting]);

  // Search active allocations
  useEffect(() => {
    if (selectedAllocation && selectedAllocation === preSelectedAllocation) return;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await allocationApi.getAllocations({
          search: allocationQuery.trim() || undefined,
          status: 'ACTIVE',
          limit: 10,
        });
        setAllocationList(result.allocations);
      } catch {
        // Silently handled
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [allocationQuery, selectedAllocation, preSelectedAllocation]);

  // Safe Locker & Customer metadata resolution
  const lockerInfo = useMemo(() => {
    if (!selectedAllocation) return null;
    if (typeof selectedAllocation.lockerId === 'object' && selectedAllocation.lockerId) {
      return selectedAllocation.lockerId;
    }
    if (
      preSelectedAllocation &&
      typeof preSelectedAllocation.lockerId === 'object' &&
      preSelectedAllocation.lockerId
    ) {
      return preSelectedAllocation.lockerId;
    }
    return null;
  }, [selectedAllocation, preSelectedAllocation]);

  const lockerNumber =
    lockerInfo?.lockerNumber ||
    (selectedAllocation as any)?.lockerNumber ||
    (preSelectedAllocation as any)?.lockerNumber ||
    '—';
  const lockerSize =
    lockerInfo?.size ||
    (selectedAllocation as any)?.size ||
    (preSelectedAllocation as any)?.size ||
    '';
  const lockerCode =
    lockerInfo?.lockerCode ||
    (selectedAllocation as any)?.lockerCode ||
    (preSelectedAllocation as any)?.lockerCode ||
    '';

  const customerInfo = useMemo(() => {
    if (!selectedAllocation) return null;
    if (typeof selectedAllocation.customerId === 'object' && selectedAllocation.customerId) {
      return selectedAllocation.customerId;
    }
    if (
      preSelectedAllocation &&
      typeof preSelectedAllocation.customerId === 'object' &&
      preSelectedAllocation.customerId
    ) {
      return preSelectedAllocation.customerId;
    }
    return null;
  }, [selectedAllocation, preSelectedAllocation]);

  const customerName = customerInfo?.fullName || 'Customer';
  const customerPhone = customerInfo?.phone || '';
  const customerCode = customerInfo?.customerCode || '';

  // Subtotal & Taxes
  const subtotal = Math.max(0, Number(baseRent) + Number(lateFee) + Number(otherCharges) - Number(discount));

  useEffect(() => {
    if (gstRate === 18) {
      setTaxAmount(Math.round(subtotal * 0.18));
    } else if (gstRate === 0) {
      setTaxAmount(0);
    }
  }, [gstRate, subtotal]);

  const totalAmount = Math.max(0, subtotal + Number(taxAmount));

  // Computed Live Renewal Period Range
  const computedPeriod = useMemo(() => {
    if (!startDate) return null;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null;

    const end = new Date(start);
    if (billingCycle === 'ANNUAL') {
      end.setFullYear(end.getFullYear() + 1);
      end.setDate(end.getDate() - 1);
    } else if (billingCycle === 'HALF_YEARLY') {
      end.setMonth(end.getMonth() + 6);
      end.setDate(end.getDate() - 1);
    } else if (billingCycle === 'QUARTERLY') {
      end.setMonth(end.getMonth() + 3);
      end.setDate(end.getDate() - 1);
    } else if (billingCycle === 'MONTHLY') {
      end.setMonth(end.getMonth() + 1);
      end.setDate(end.getDate() - 1);
    }

    const nextDue = new Date(end);
    nextDue.setDate(nextDue.getDate() + 1);

    return {
      startFormatted: start.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      endFormatted: end.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      nextDueFormatted: nextDue.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    };
  }, [startDate, billingCycle]);

  const handleSelectAllocation = (alloc: LockerAllocation) => {
    setSelectedAllocation(alloc);
    setBaseRent(alloc.rentSnapshot || alloc.annualRent || (alloc.lockerId as any)?.annualRent || 1655);
    if (alloc.nextRenewalDueDate) {
      setStartDate(new Date(alloc.nextRenewalDueDate).toISOString().slice(0, 10));
    } else if (alloc.endDate) {
      const nextDay = new Date(alloc.endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setStartDate(nextDay.toISOString().slice(0, 10));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAllocation) {
      setError('Please select an active allocation agreement.');
      return;
    }
    setError(null);

    try {
      await onSubmit({
        allocationId: selectedAllocation._id,
        startDate,
        billingCycle,
        baseRent: Number(baseRent),
        discount: Number(discount),
        lateFee: Number(lateFee),
        otherCharges: Number(otherCharges),
        taxAmount: Number(taxAmount),
        notes: notes.trim() || undefined,
      });
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to generate renewal invoice.'
      );
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[120] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs select-none animate-in fade-in-0 duration-150 overflow-y-auto">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="generate-renewal-title"
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 animate-in zoom-in-95 duration-150 my-auto text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4.5 border-b border-slate-100 bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center shadow-2xs">
              <Calendar className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h2
                ref={titleRef}
                tabIndex={-1}
                id="generate-renewal-title"
                className="text-base sm:text-lg font-bold text-slate-900 tracking-tight outline-none"
              >
                Generate Renewal Statement
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Issue next billing period cycle statement for active locker tenancy
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8.5 w-8.5 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={handleFormSubmit}
          className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs"
        >
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-semibold text-xs leading-relaxed">{error}</span>
            </div>
          )}

          {/* 1. Allocation Selection / Tenant Dossier Banner */}
          {!selectedAllocation ? (
            <div className="space-y-3">
              <label className="font-bold text-xs text-slate-800">
                1. Select Active Tenancy Agreement *
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={allocationQuery}
                  onChange={(e) => setAllocationQuery(e.target.value)}
                  placeholder="Search customer, agreement code (e.g. ALC-000057), or locker..."
                  className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-300 rounded-xl font-normal text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 text-xs shadow-2xs"
                />
              </div>

              {isSearching && (
                <div className="p-6 text-center text-slate-400 font-normal animate-pulse text-xs">
                  Searching active allocations...
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                {allocationList.map((alloc) => (
                  <div
                    key={alloc._id}
                    onClick={() => handleSelectAllocation(alloc)}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:bg-emerald-50/30 cursor-pointer transition-all flex flex-col justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {alloc.allocationCode}
                      </span>
                      <span className="font-bold text-emerald-800 text-xs">
                        Locker #{(alloc.lockerId as any)?.lockerNumber || (alloc as any).lockerNumber} (
                        {(alloc.lockerId as any)?.size || (alloc as any).size})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="font-semibold text-slate-800 truncate max-w-[130px]">
                        {(alloc.customerId as any)?.fullName}
                      </span>
                      <span className="text-emerald-800 font-bold tabular-nums text-xs">
                        ₹{(alloc.rentSnapshot || alloc.annualRent).toLocaleString('en-IN')}/yr
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/90 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-800 text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0">
                  {customerName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded text-emerald-900 border border-emerald-300 shadow-2xs">
                      {selectedAllocation.allocationCode}
                    </span>
                    <span className="font-bold text-xs text-slate-900 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-emerald-800" />
                      Locker #{lockerNumber} {lockerSize ? `(Size ${lockerSize})` : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-900 font-medium mt-1 flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{customerName}</span>
                    {customerCode && <span>&bull; {customerCode}</span>}
                    {customerPhone && (
                      <span className="flex items-center gap-1 font-mono text-slate-700">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {formatPhone(customerPhone)}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {!preSelectedAllocation && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAllocation(null)}
                  className="rounded-xl text-xs h-8 px-3 bg-white border-slate-300 hover:bg-slate-50 font-semibold text-slate-700 cursor-pointer shrink-0"
                >
                  Change
                </Button>
              )}
            </div>
          )}

          {/* 2. Billing Parameters */}
          {selectedAllocation && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Renewal Cycle Start Date *</span>
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="h-10 text-xs bg-slate-50 border-slate-300 font-medium rounded-xl focus:border-emerald-700 focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Billing Cycle Term *</span>
                  </label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as any)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-xs text-slate-900 cursor-pointer focus:border-emerald-700 focus:bg-white"
                  >
                    <option value="ANNUAL">Annual (12 Months / 1 Year)</option>
                    <option value="HALF_YEARLY">Half-Yearly (6 Months)</option>
                    <option value="QUARTERLY">Quarterly (3 Months)</option>
                    <option value="MONTHLY">Monthly (1 Month)</option>
                  </select>
                </div>
              </div>

              {/* Computed Period Banner */}
              {computedPeriod && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className="font-semibold text-slate-500 uppercase text-[10px]">
                      New Cycle Coverage:
                    </span>
                    <span className="font-bold text-slate-900">{computedPeriod.startFormatted}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-bold text-slate-900">{computedPeriod.endFormatted}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-emerald-900 font-semibold bg-emerald-100/70 px-2.5 py-0.5 rounded-md border border-emerald-200/80">
                    <span>Next Renewal Due:</span>
                    <span className="font-bold">{computedPeriod.nextDueFormatted}</span>
                  </div>
                </div>
              )}

              {/* Financial Tariff Adjusters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Base Rent Tariff (₹) *</label>
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    value={baseRent}
                    onChange={(e) => setBaseRent(Number(e.target.value))}
                    required
                    className="h-10 text-xs bg-slate-50 border-slate-300 font-bold text-slate-900 rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Late Penalty Fee (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    value={lateFee}
                    onChange={(e) => setLateFee(Number(e.target.value))}
                    className="h-10 text-xs bg-slate-50 border-slate-300 font-normal rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-xs text-slate-700">Special Discount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="10"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="h-10 text-xs bg-slate-50 border-slate-300 font-medium text-emerald-800 rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                </div>
              </div>

              {/* GST / Tax Options */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Applicable GST / Tax</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setGstRate(0)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        gstRate === 0
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      0% (Exempt)
                    </button>
                    <button
                      type="button"
                      onClick={() => setGstRate(18)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        gstRate === 18
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      18% GST (+₹{Math.round(subtotal * 0.18).toLocaleString('en-IN')})
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-1">
                <label className="font-bold text-xs text-slate-700">
                  Invoice Notes &amp; Remarks (Optional)
                </label>
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Regular renewal for period 2026-2027"
                  className="h-9 text-xs bg-slate-50 border-slate-300 rounded-xl focus:border-emerald-700 focus:bg-white"
                />
              </div>

              {/* Total Financial Summary Card */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-3 shadow-md">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-[10.5px] text-slate-400">
                    <span>Base: ₹{baseRent.toLocaleString('en-IN')}</span>
                    {lateFee > 0 && <span>• Late Fee: +₹{lateFee.toLocaleString('en-IN')}</span>}
                    {discount > 0 && <span>• Discount: -₹{discount.toLocaleString('en-IN')}</span>}
                    {taxAmount > 0 && <span>• GST: +₹{taxAmount.toLocaleString('en-IN')}</span>}
                  </div>
                  <div className="text-xl font-bold tabular-nums text-emerald-400">
                    ₹{totalAmount.toLocaleString('en-IN')}
                    <span className="text-xs font-normal text-slate-300 ml-1.5">Total Invoiced</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9.5 px-4 rounded-xl text-xs cursor-pointer shadow-xs shrink-0"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Issuing...</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Confirm &amp; Issue Invoice</span>
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}


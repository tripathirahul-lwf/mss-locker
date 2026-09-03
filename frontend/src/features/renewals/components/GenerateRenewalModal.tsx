import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { allocationApi } from '../../allocations/api/allocationApi';
import { LockerAllocation } from '../../allocations/types';
import { GenerateRenewalInput, BillingCycle } from '../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatPhone } from '../../customers/utils/phoneFormatter';

interface GenerateRenewalModalProps {
  onClose: () => void;
  onSubmit: (data: GenerateRenewalInput) => Promise<void>;
  isSubmitting: boolean;
}

export function GenerateRenewalModal({
  onClose,
  onSubmit,
  isSubmitting,
}: GenerateRenewalModalProps) {
  const [allocationQuery, setAllocationQuery] = useState('');
  const [allocationList, setAllocationList] = useState<LockerAllocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<LockerAllocation | null>(null);

  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('ANNUAL');
  const [baseRent, setBaseRent] = useState<number>(1180);
  const [discount, setDiscount] = useState<number>(0);
  const [lateFee, setLateFee] = useState<number>(0);
  const [otherCharges, setOtherCharges] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Search active allocations
  useEffect(() => {
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
  }, [allocationQuery]);

  const handleSelectAllocation = (alloc: LockerAllocation) => {
    setSelectedAllocation(alloc);
    setBaseRent(alloc.rentSnapshot || alloc.annualRent);
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

  const subtotal = Math.max(0, baseRent + lateFee + otherCharges - discount);
  const totalAmount = Math.max(0, subtotal + taxAmount);

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-[2px] select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/90 font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
              <Calendar className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight font-sans">
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
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs font-normal">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-medium text-xs leading-relaxed">{error}</span>
            </div>
          )}

          {/* 1. Allocation Search / Picker */}
          {!selectedAllocation ? (
            <div className="space-y-3">
              <label className="font-medium text-xs text-slate-700">
                1. Select Active Tenancy Agreement *
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={allocationQuery}
                  onChange={(e) => setAllocationQuery(e.target.value)}
                  placeholder="Search customer, agreement code (e.g. ALC-000001), or locker..."
                  className="w-full h-10 pl-10 pr-4 bg-slate-50/80 border border-slate-300 rounded-xl font-normal text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 text-xs shadow-2xs font-sans"
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
                    className="p-3.5 rounded-xl border border-slate-200/90 bg-white hover:border-emerald-400 hover:bg-emerald-50/20 cursor-pointer transition-all flex flex-col justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-sans font-medium text-xs text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200 tabular-nums">
                        {alloc.allocationCode}
                      </span>
                      <span className="font-semibold text-emerald-800 text-xs font-sans">
                        Locker #{alloc.lockerId?.lockerNumber} ({alloc.lockerId?.size})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="font-medium text-slate-800 truncate font-sans max-w-[130px]">
                        {alloc.customerId?.fullName}
                      </span>
                      <span className="font-sans text-emerald-800 font-semibold tabular-nums text-xs">
                        ₹{(alloc.rentSnapshot || alloc.annualRent).toLocaleString('en-IN')}/yr
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileCheck className="w-5 h-5 text-emerald-800 shrink-0" />
                <div className="min-w-0 truncate">
                  <p className="font-semibold text-xs font-sans truncate">
                    {selectedAllocation.allocationCode} &bull; Locker #{selectedAllocation.lockerId?.lockerNumber} ({selectedAllocation.lockerId?.size})
                  </p>
                  <p className="text-[11px] text-emerald-900/90 font-normal font-sans">
                    Tenant: <strong>{selectedAllocation.customerId?.fullName}</strong> &bull; {formatPhone(selectedAllocation.customerId?.phone || '')}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedAllocation(null)}
                className="rounded-xl text-xs h-8 px-3 bg-white border-slate-300 hover:bg-slate-50 font-medium text-slate-700 cursor-pointer shrink-0"
              >
                Change
              </Button>
            </div>
          )}

          {/* 2. Billing Parameters */}
          {selectedAllocation && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Renewal Cycle Start Date *</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-normal rounded-xl focus:border-emerald-700 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Billing Cycle *</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as any)}
                    className="w-full h-10 px-3 bg-slate-50/80 border border-slate-300 rounded-xl font-medium text-xs text-slate-900 cursor-pointer focus:border-emerald-700 focus:bg-white"
                  >
                    <option value="ANNUAL">Annual (12 Months)</option>
                    <option value="HALF_YEARLY">Half-Yearly (6 Months)</option>
                    <option value="QUARTERLY">Quarterly (3 Months)</option>
                    <option value="MONTHLY">Monthly (1 Month)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Base Rent Tariff (₹) *</label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={baseRent}
                    onChange={(e) => setBaseRent(Number(e.target.value))}
                    required
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-semibold text-slate-900 rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Late Penalty Fee (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={lateFee}
                    onChange={(e) => setLateFee(Number(e.target.value))}
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-normal rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Discount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-normal text-emerald-800 rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                </div>
              </div>

              {/* Total Summary Footer */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-3 shadow-sm">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider block">
                    Calculated Invoiced Amount
                  </span>
                  <span className="text-xl font-semibold font-sans tabular-nums text-white">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium h-9 px-4 rounded-xl text-xs cursor-pointer shadow-xs"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating...</span>
                    </span>
                  ) : (
                    'Confirm & Issue Invoice'
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

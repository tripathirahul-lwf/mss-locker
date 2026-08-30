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
} from 'lucide-react';
import { allocationApi } from '../../allocations/api/allocationApi';
import { LockerAllocation } from '../../allocations/types';
import { GenerateRenewalInput, BillingCycle } from '../types';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

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
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Generate Renewal Invoice
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Issue next billing period cycle statement for active locker tenancy
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleFormSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="font-bold leading-relaxed">{error}</span>
            </div>
          )}

          {/* 1. Allocation Search / Picker */}
          {!selectedAllocation ? (
            <div className="space-y-3">
              <label className="font-bold text-slate-800">
                1. Select Active Tenancy Agreement *
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={allocationQuery}
                  onChange={(e) => setAllocationQuery(e.target.value)}
                  placeholder="Search customer, agreement code (e.g. ALC-000001), or locker..."
                  className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-300 rounded-2xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {isSearching && (
                <div className="p-6 text-center text-slate-400 font-semibold animate-pulse">
                  Searching active allocations...
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto">
                {allocationList.map((alloc) => (
                  <div
                    key={alloc._id}
                    onClick={() => handleSelectAllocation(alloc)}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer transition-all flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                        {alloc.allocationCode}
                      </span>
                      <span className="font-bold text-blue-700">
                        Locker #{alloc.lockerId?.lockerNumber} ({alloc.lockerId?.size})
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-800 truncate">
                        {alloc.customerId?.fullName}
                      </span>
                      <span className="font-mono text-emerald-700 font-bold">
                        ₹{(alloc.rentSnapshot || alloc.annualRent).toLocaleString('en-IN')}/yr
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCheck className="w-5 h-5 text-blue-600 shrink-0" />
                <div>
                  <p className="font-bold text-xs text-blue-950">
                    {selectedAllocation.allocationCode} &bull; Locker #{selectedAllocation.lockerId?.lockerNumber} ({selectedAllocation.lockerId?.size})
                  </p>
                  <p className="text-[11px] text-blue-800">
                    Tenant: <strong>{selectedAllocation.customerId?.fullName}</strong> ({selectedAllocation.customerId?.phone})
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedAllocation(null)}
                className="rounded-xl text-[11px] h-8 bg-white"
              >
                Change
              </Button>
            </div>
          )}

          {/* 2. Billing Parameters */}
          {selectedAllocation && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Renewal Cycle Start Date *</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="h-11 text-xs bg-slate-50 border-slate-300 font-bold rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Billing Cycle *</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as any)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900"
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
                  <label className="font-bold text-slate-700">Base Rent Tariff (₹) *</label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={baseRent}
                    onChange={(e) => setBaseRent(Number(e.target.value))}
                    required
                    className="h-11 text-sm bg-slate-50 border-slate-300 font-black text-slate-900 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Late Penalty Fee (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={lateFee}
                    onChange={(e) => setLateFee(Number(e.target.value))}
                    className="h-11 text-xs bg-slate-50 border-slate-300 font-bold rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Discount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="h-11 text-xs bg-slate-50 border-slate-300 font-bold text-emerald-700 rounded-xl"
                  />
                </div>
              </div>

              {/* Total Summary */}
              <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    Calculated Invoiced Amount
                  </span>
                  <span className="text-xl font-black font-mono">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </span>
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-5 rounded-2xl text-xs cursor-pointer"
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

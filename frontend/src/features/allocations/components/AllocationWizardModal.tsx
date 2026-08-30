import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  KeyRound,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  Layers,
  ChevronRight,
  ChevronLeft,
  Loader2,
  FileCheck,
  Sparkles,
  Phone,
  MapPin,
  Calendar,
  IndianRupee,
  ShieldAlert,
} from 'lucide-react';
import { customerApi } from '../../customers/api/customerApi';
import { lockerApi } from '../../lockers/api/lockerApi';
import { Customer } from '../../customers/types';
import { Locker } from '../../lockers/types';
import { CreateAllocationInput, ReserveLockerInput, BillingCycle, AllocationType } from '../types';
import { BILLING_CYCLES, ALLOCATION_TYPES } from '../constants';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { KycStatusBadge } from '../../customers/components/KycStatusBadge';
import { formatPhone } from '../../customers/utils/phoneFormatter';

interface AllocationWizardModalProps {
  mode?: 'allocate' | 'reserve';
  onClose: () => void;
  onSubmit: (data: CreateAllocationInput | ReserveLockerInput) => Promise<void>;
  isSubmitting: boolean;
}

export function AllocationWizardModal({
  mode = 'allocate',
  onClose,
  onSubmit,
  isSubmitting,
}: AllocationWizardModalProps) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Customer Search State
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerList, setCustomerList] = useState<Customer[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Step 2: Available Locker State
  const [availableLockers, setAvailableLockers] = useState<Locker[]>([]);
  const [isLoadingLockers, setIsLoadingLockers] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(null);
  const [sizeFilter, setSizeFilter] = useState('');
  const [rackFilter, setRackFilter] = useState('');

  // Step 3: Terms State
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('ANNUAL');
  const [annualRent, setAnnualRent] = useState<number>(3000);
  const [securityDeposit, setSecurityDeposit] = useState<number>(10000);
  const [allocationType, setAllocationType] = useState<AllocationType>('NEW');
  const [remarks, setRemarks] = useState('');
  const [reservationDays, setReservationDays] = useState<number>(7);

  const [error, setError] = useState<string | null>(null);

  // Search Customers
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsSearchingCustomer(true);
      try {
        const result = await customerApi.getCustomers({
          search: customerQuery.trim() || undefined,
          status: 'ACTIVE',
          limit: 12,
        });
        setCustomerList(result.customers);
      } catch {
        // Handled silently
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [customerQuery]);

  // Fetch Available Lockers
  useEffect(() => {
    if (currentStep === 2) {
      const fetchAvailable = async () => {
        setIsLoadingLockers(true);
        try {
          const lockers = await lockerApi.getAvailableLockers({
            size: sizeFilter || undefined,
            rackNumber: rackFilter || undefined,
          });
          setAvailableLockers(lockers);
        } catch {
          // Handled silently
        } finally {
          setIsLoadingLockers(false);
        }
      };
      fetchAvailable();
    }
  }, [currentStep, sizeFilter, rackFilter]);

  // Sync tariffs when locker is selected
  const handleSelectLocker = (locker: Locker) => {
    setSelectedLocker(locker);
    setAnnualRent(locker.annualRent);
    setSecurityDeposit(locker.securityDeposit);
  };

  const handleNextStep = () => {
    setError(null);
    if (currentStep === 1) {
      if (!selectedCustomer) {
        setError('Please select a customer to proceed with allocation.');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!selectedLocker) {
        setError('Please select an available physical locker unit.');
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!startDate) {
        setError('Tenancy start date is required.');
        return;
      }
      if (annualRent < 0 || securityDeposit < 0) {
        setError('Rent and security deposit cannot be negative numbers.');
        return;
      }
      setCurrentStep(4);
    }
  };

  const handleFinalSubmit = async () => {
    if (!selectedCustomer || !selectedLocker) return;
    setError(null);

    try {
      if (mode === 'reserve') {
        const expiresAt = new Date(
          Date.now() + reservationDays * 24 * 60 * 60 * 1000
        ).toISOString();

        await onSubmit({
          customerId: selectedCustomer._id,
          lockerId: selectedLocker._id,
          startDate: new Date(startDate).toISOString(),
          reservationExpiresAt: expiresAt,
          billingCycle,
          annualRent: Number(annualRent),
          securityDeposit: Number(securityDeposit),
          remarks: remarks.trim() || undefined,
        });
      } else {
        await onSubmit({
          customerId: selectedCustomer._id,
          lockerId: selectedLocker._id,
          startDate: new Date(startDate).toISOString(),
          billingCycle,
          annualRent: Number(annualRent),
          securityDeposit: Number(securityDeposit),
          allocationType,
          remarks: remarks.trim() || undefined,
        });
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to complete allocation.'
      );
    }
  };

  const isReserve = mode === 'reserve';

  // Calculate calculated end date for 1 cycle preview
  const previewEndDate = new Date(new Date(startDate).setFullYear(new Date(startDate).getFullYear() + 1))
    .toISOString()
    .slice(0, 10);

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-sm select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3.5">
            <div
              className={`p-3 rounded-2xl text-white shadow-md ${
                isReserve
                  ? 'bg-gradient-to-tr from-amber-500 to-orange-600 shadow-amber-500/20'
                  : 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20'
              }`}
            >
              {isReserve ? <Clock className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {isReserve ? 'Reserve Locker (Place On Hold)' : 'New Locker Tenancy Allocation'}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Step {currentStep} of 4 &bull;{' '}
                {currentStep === 1
                  ? 'Identify and select verified customer'
                  : currentStep === 2
                  ? 'Choose vacant physical safe-deposit unit'
                  : currentStep === 3
                  ? 'Set billing cycle & financial snapshot tariffs'
                  : 'Review terms and generate legal tenancy agreement'}
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

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-200/80 text-center text-xs font-bold bg-slate-50/50">
          {[
            { step: 1, label: '1. Customer Profile' },
            { step: 2, label: '2. Physical Unit' },
            { step: 3, label: '3. Pricing & Terms' },
            { step: 4, label: '4. Final Confirmation' },
          ].map((tab) => (
            <div
              key={tab.step}
              className={`py-3.5 transition-colors ${
                currentStep === tab.step
                  ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/60 font-black'
                  : currentStep > tab.step
                  ? 'text-slate-800 bg-slate-50/30'
                  : 'text-slate-400'
              }`}
            >
              {tab.label}
            </div>
          ))}
        </div>

        {/* Step Body */}
        <div className="p-5 sm:p-7 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="font-bold leading-relaxed">{error}</span>
            </div>
          )}

          {/* STEP 1: Select Customer */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search verified customer by name, mobile phone number, or code (e.g. CUS-000001)..."
                  className="w-full h-12 pl-10 pr-4 bg-slate-50/80 border border-slate-300 rounded-2xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs sm:text-sm"
                />
              </div>

              {isSearchingCustomer && (
                <div className="p-8 text-center text-slate-400 font-semibold animate-pulse">
                  Searching registered customers...
                </div>
              )}

              {!isSearchingCustomer && customerList.length === 0 && (
                <div className="p-10 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <User className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-sm">No active customer found</p>
                  <p className="text-xs max-w-sm mx-auto">
                    Please create and verify the customer record first in the Customer Management module.
                  </p>
                </div>
              )}

              {/* Customer Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-h-80 overflow-y-auto pr-1">
                {customerList.map((cust) => {
                  const isSelected = selectedCustomer?._id === cust._id;
                  const isKycOk = cust.kycStatus === 'VERIFIED';

                  return (
                    <div
                      key={cust._id}
                      onClick={() => setSelectedCustomer(cust)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-blue-300 bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      {/* Top Row: Avatar, Name & KYC Badge */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          {cust.photoUrl ? (
                            <img
                              src={cust.photoUrl}
                              alt={cust.fullName}
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {cust.fullName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate">
                              {cust.fullName}
                            </h4>
                            <span className="font-mono text-[11px] text-slate-500 block font-semibold">
                              {cust.customerCode}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <KycStatusBadge status={cust.kycStatus} />
                        </div>
                      </div>

                      {/* Bottom Row: Phone & Address */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 text-slate-700 font-mono font-bold">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{formatPhone(cust.phone)}</span>
                        </div>

                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-blue-700 font-bold text-[10px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Selected</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Customer Highlight Banner */}
              {selectedCustomer && (
                <div
                  className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                    selectedCustomer.kycStatus === 'VERIFIED'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {selectedCustomer.kycStatus === 'VERIFIED' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <p className="font-bold text-xs">
                        Selected: {selectedCustomer.fullName} ({selectedCustomer.customerCode})
                      </p>
                      {selectedCustomer.kycStatus !== 'VERIFIED' && (
                        <p className="text-[11px] opacity-90 font-medium">
                          Note: KYC is {selectedCustomer.kycStatus}. Ensure KYC verification documents are completed.
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold shrink-0">
                    {formatPhone(selectedCustomer.phone)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Select Available Locker */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Filter by Locker Size</label>
                  <select
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
                  >
                    <option value="">All Sizes (A to G2)</option>
                    {['A', 'B', 'B1', 'C', 'D', 'D1', 'E', 'F', 'F1', 'G', 'G1', 'G2'].map((s) => (
                      <option key={s} value={s}>
                        Size {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Filter by Physical Rack</label>
                  <Input
                    type="text"
                    value={rackFilter}
                    onChange={(e) => setRackFilter(e.target.value)}
                    placeholder="e.g. Rack-01 or R12"
                    className="h-11 text-xs bg-slate-50 border-slate-300 rounded-xl font-bold"
                  />
                </div>
              </div>

              {isLoadingLockers && (
                <div className="p-8 text-center text-slate-400 font-semibold animate-pulse">
                  Querying vacant safe-deposit lockers...
                </div>
              )}

              {!isLoadingLockers && availableLockers.length === 0 && (
                <div className="p-10 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <KeyRound className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-sm">No vacant lockers found</p>
                  <p className="text-xs max-w-sm mx-auto">
                    All units matching your criteria are currently occupied or reserved.
                  </p>
                </div>
              )}

              {/* Available Lockers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-h-80 overflow-y-auto pr-1">
                {availableLockers.map((locker) => {
                  const isSelected = selectedLocker?._id === locker._id;

                  return (
                    <div
                      key={locker._id}
                      onClick={() => handleSelectLocker(locker)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-blue-300 bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-black text-slate-900 text-sm">
                            <KeyRound className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>Locker #{locker.lockerNumber}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            {locker.rackNumber} &bull; {locker.section || 'Main Vault'}
                          </p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-900 font-black font-mono text-[11px] shrink-0">
                          {locker.size}
                        </span>
                      </div>

                      <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[9px] font-sans font-bold uppercase">
                            Annual Rent
                          </span>
                          <strong className="text-emerald-700 text-xs font-mono font-bold">
                            ₹{locker.annualRent.toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[9px] font-sans font-bold uppercase">
                            Deposit
                          </span>
                          <strong className="text-slate-800 text-xs font-mono font-bold">
                            ₹{locker.securityDeposit.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Locker Banner */}
              {selectedLocker && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-xs">
                        Selected Unit: Locker #{selectedLocker.lockerNumber} (Size {selectedLocker.size})
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        {selectedLocker.rackNumber} &bull; {selectedLocker.section || 'Main Vault'}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-950 shrink-0">
                    ₹{selectedLocker.annualRent.toLocaleString('en-IN')}/yr
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Pricing & Terms */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Tenancy Start Date *</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="h-11 text-xs bg-slate-50 border-slate-300 font-bold rounded-xl"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    Calculated 1-Year End Date: <strong>{previewEndDate}</strong>
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Billing Cycle *</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
                  >
                    {BILLING_CYCLES.map((bc) => (
                      <option key={bc.value} value={bc.value}>
                        {bc.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">
                    Annual Rent Tariff Snapshot (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={annualRent}
                    onChange={(e) => setAnnualRent(Number(e.target.value))}
                    required
                    className="h-11 text-sm bg-slate-50 border-slate-300 font-black text-slate-900 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-500">
                    Locked into tenancy snapshot. Future tariff revisions won't alter this agreement.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">
                    Security Caution Deposit Snapshot (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="500"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                    required
                    className="h-11 text-sm bg-slate-50 border-slate-300 font-black text-slate-900 rounded-xl"
                  />
                  <p className="text-[10px] text-slate-500">
                    Refundable caution money upon physical key return.
                  </p>
                </div>
              </div>

              {isReserve ? (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Hold / Reservation Duration (Days)</label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={reservationDays}
                    onChange={(e) => setReservationDays(Number(e.target.value))}
                    className="h-11 text-xs bg-slate-50 border-slate-300 font-bold rounded-xl"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700">Agreement Classification</label>
                  <select
                    value={allocationType}
                    onChange={(e) => setAllocationType(e.target.value as AllocationType)}
                    className="w-full h-11 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 cursor-pointer"
                  >
                    {ALLOCATION_TYPES.map((at) => (
                      <option key={at.value} value={at.value}>
                        {at.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Operational Remarks / Key Handover Notes</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes regarding key handover, authorized joint operator, or special instructions"
                  rows={2}
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-medium"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Review & Final Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200/90 flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-blue-600 shrink-0" />
                <div>
                  <h4 className="font-black text-blue-950 text-xs">
                    Please Review Tenancy Agreement Details
                  </h4>
                  <p className="text-[11px] text-blue-800 font-medium">
                    Confirming will assign <strong>Locker #{selectedLocker?.lockerNumber}</strong> to <strong>{selectedCustomer?.fullName}</strong> and transition unit status to {isReserve ? 'RESERVED' : 'OCCUPIED'}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Card */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Verified Tenant Customer
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center shrink-0">
                      {selectedCustomer?.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 text-sm truncate">
                        {selectedCustomer?.fullName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {selectedCustomer?.customerCode} &bull; {selectedCustomer?.phone}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Locker Card */}
                <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Physical Safe-Deposit Compartment
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                      <KeyRound className="w-6 h-6" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900 text-sm truncate">
                        Locker #{selectedLocker?.lockerNumber} (Size {selectedLocker?.size})
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {selectedLocker?.rackNumber} &bull; {selectedLocker?.section || 'Main Vault'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Snapshot Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Agreed Financial Pricing (Immutable Snapshot)
                </span>
                <div className="grid grid-cols-3 gap-3 text-center font-mono">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-sans text-slate-500 block font-bold">START DATE</span>
                    <strong className="text-slate-900 text-xs">{startDate}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-sans text-slate-500 block font-bold">ANNUAL RENT</span>
                    <strong className="text-emerald-700 text-xs">₹{annualRent.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-sans text-slate-500 block font-bold">CAUTION DEPOSIT</span>
                    <strong className="text-blue-700 text-xs">₹{securityDeposit.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                disabled={isSubmitting}
                className="rounded-xl flex items-center gap-1 text-xs cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </Button>

            {currentStep < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={handleNextStep}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 rounded-xl flex items-center gap-1 text-xs cursor-pointer"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 min-w-[170px] rounded-xl text-xs cursor-pointer"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Allocating Unit...</span>
                  </span>
                ) : isReserve ? (
                  'Confirm Reservation'
                ) : (
                  'Confirm & Allocate Locker'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

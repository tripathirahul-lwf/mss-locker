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
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-5 bg-slate-950/60 backdrop-blur-[2px] select-none animate-in fade-in-0 duration-150">
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200/90"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border shadow-2xs ${
                isReserve
                  ? 'bg-amber-50 border-amber-200/80 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200/80 text-emerald-800'
              }`}
            >
              {isReserve ? <Clock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900 tracking-tight font-sans">
                {isReserve ? 'Reserve Locker (Place On Hold)' : 'New Locker Tenancy Allocation'}
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
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
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-200/90 text-center text-xs bg-slate-50/60 font-sans">
          {[
            { step: 1, num: '1', label: 'Customer' },
            { step: 2, num: '2', label: 'Locker Unit' },
            { step: 3, num: '3', label: 'Terms & Tariffs' },
            { step: 4, num: '4', label: 'Confirmation' },
          ].map((tab) => (
            <div
              key={tab.step}
              className={`py-3 px-2 flex items-center justify-center gap-1.5 transition-all ${
                currentStep === tab.step
                  ? 'border-b-2 border-emerald-800 text-emerald-950 bg-emerald-50/80 font-semibold'
                  : currentStep > tab.step
                  ? 'text-emerald-700 font-medium bg-slate-50/30'
                  : 'text-slate-400 font-normal'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center shrink-0 tabular-nums ${
                  currentStep === tab.step
                    ? 'bg-emerald-800 text-white font-semibold'
                    : currentStep > tab.step
                    ? 'bg-emerald-100 text-emerald-800 font-semibold'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {currentStep > tab.step ? '✓' : tab.num}
              </span>
              <span className="truncate">{tab.label}</span>
            </div>
          ))}
        </div>

        {/* Step Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs font-normal">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-medium text-xs leading-relaxed">{error}</span>
            </div>
          )}

          {/* STEP 1: Select Customer */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search verified customer by name, mobile phone number, or code (e.g. CUS-000001)..."
                  className="w-full h-10 pl-10 pr-9 bg-slate-50/80 border border-slate-300 rounded-xl font-normal text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 text-xs shadow-2xs font-sans"
                />
                {customerQuery && (
                  <button
                    type="button"
                    onClick={() => setCustomerQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isSearchingCustomer && (
                <div className="p-8 text-center text-slate-400 font-normal animate-pulse">
                  Searching registered customers...
                </div>
              )}

              {!isSearchingCustomer && customerList.length === 0 && (
                <div className="p-10 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <User className="w-9 h-9 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-700 text-xs">No active customer found</p>
                  <p className="text-xs max-w-sm mx-auto font-normal">
                    Please create and verify the customer record first in the Customer Management module.
                  </p>
                </div>
              )}

              {/* Customer Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
                {customerList.map((cust) => {
                  const isSelected = selectedCustomer?._id === cust._id;

                  return (
                    <div
                      key={cust._id}
                      onClick={() => setSelectedCustomer(cust)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-emerald-700 bg-emerald-50/60 shadow-xs ring-2 ring-emerald-700/30'
                          : 'border-slate-200/90 hover:border-emerald-400 bg-white hover:bg-emerald-50/20'
                      }`}
                    >
                      {/* Top Row: Avatar, Name & KYC Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {cust.photoUrl ? (
                            <img
                              src={cust.photoUrl}
                              alt={cust.fullName}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold font-sans text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {cust.fullName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-slate-900 text-xs truncate font-sans">
                              {cust.fullName}
                            </h4>
                            <span className="text-[11px] text-slate-500 block font-normal font-sans tabular-nums truncate">
                              {cust.customerCode}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 ml-1">
                          <KycStatusBadge status={cust.kycStatus} />
                        </div>
                      </div>

                      {/* Bottom Row: Phone & Selection State */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-normal">
                        <div className="flex items-center gap-1.5 text-slate-900 min-w-0">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-sans font-medium text-slate-900 text-[13px] tabular-nums tracking-tight truncate">
                            {formatPhone(cust.phone)}
                          </span>
                        </div>

                        {isSelected && (
                          <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold text-[11px] shrink-0 ml-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
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
                  className={`p-3 sm:p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 overflow-hidden ${
                    selectedCustomer.kycStatus === 'VERIFIED'
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50/90 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {selectedCustomer.kycStatus === 'VERIFIED' ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-700 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4.5 h-4.5 text-amber-700 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-xs font-sans truncate">
                        Selected: {selectedCustomer.fullName} ({selectedCustomer.customerCode})
                      </p>
                      {selectedCustomer.kycStatus !== 'VERIFIED' && (
                        <p className="text-[11px] opacity-90 font-normal">
                          Note: KYC is {selectedCustomer.kycStatus}. Ensure KYC verification documents are completed.
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-sans font-medium text-xs tabular-nums text-slate-900 shrink-0 pl-7 sm:pl-0">
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
                  <label className="font-medium text-xs text-slate-700">Filter by Locker Size</label>
                  <select
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50/80 border border-slate-300 rounded-xl font-medium text-xs text-slate-900 cursor-pointer focus:border-emerald-700 focus:bg-white"
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
                  <label className="font-medium text-xs text-slate-700">Filter by Physical Rack</label>
                  <Input
                    type="text"
                    value={rackFilter}
                    onChange={(e) => setRackFilter(e.target.value)}
                    placeholder="e.g. Rack-01 or R12"
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 rounded-xl font-normal focus:border-emerald-700 focus:bg-white"
                  />
                </div>
              </div>

              {isLoadingLockers && (
                <div className="p-8 text-center text-slate-400 font-normal animate-pulse">
                  Querying vacant safe-deposit lockers...
                </div>
              )}

              {!isLoadingLockers && availableLockers.length === 0 && (
                <div className="p-10 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <KeyRound className="w-9 h-9 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-700 text-xs">No vacant lockers found</p>
                  <p className="text-xs max-w-sm mx-auto font-normal">
                    All units matching your criteria are currently occupied or reserved.
                  </p>
                </div>
              )}

              {/* Available Lockers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
                {availableLockers.map((locker) => {
                  const isSelected = selectedLocker?._id === locker._id;

                  return (
                    <div
                      key={locker._id}
                      onClick={() => handleSelectLocker(locker)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-emerald-800 bg-emerald-50/50 shadow-xs ring-2 ring-emerald-800/30'
                          : 'border-slate-200/90 hover:border-emerald-400 bg-white hover:bg-emerald-50/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-semibold text-slate-900 text-xs font-sans">
                            <KeyRound className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                            <span>Locker #{locker.lockerNumber}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                            {locker.rackNumber} &bull; {locker.section || 'Main Vault'}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium font-sans text-[10.5px] shrink-0">
                          {locker.size}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-normal">
                        <div>
                          <span className="text-slate-400 block text-[9.5px] font-sans uppercase">
                            Annual Rent
                          </span>
                          <strong className="text-slate-900 text-xs font-sans font-semibold tabular-nums">
                            ₹{locker.annualRent.toLocaleString('en-IN')}
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[9.5px] font-sans uppercase">
                            Deposit
                          </span>
                          <strong className="text-slate-700 text-xs font-sans font-semibold tabular-nums">
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
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-700 shrink-0" />
                    <div>
                      <p className="font-semibold text-xs font-sans">
                        Selected Unit: Locker #{selectedLocker.lockerNumber} (Size {selectedLocker.size})
                      </p>
                      <p className="text-[11px] text-emerald-800 font-normal">
                        {selectedLocker.rackNumber} &bull; {selectedLocker.section || 'Main Vault'}
                      </p>
                    </div>
                  </div>
                  <span className="font-sans text-xs font-semibold text-emerald-950 shrink-0 tabular-nums">
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
                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Tenancy Start Date *</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-normal rounded-xl focus:border-emerald-700 focus:bg-white"
                  />
                  <span className="text-[10px] text-slate-500 block font-normal">
                    Calculated 1-Year End Date: <strong className="font-medium text-slate-700 tabular-nums">{previewEndDate}</strong>
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Billing Cycle *</label>
                  <select
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
                    className="w-full h-10 px-3 bg-slate-50/80 border border-slate-300 rounded-xl font-medium text-xs text-slate-900 cursor-pointer focus:border-emerald-700 focus:bg-white"
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
                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">
                    Annual Rent Tariff Snapshot (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={annualRent}
                    onChange={(e) => setAnnualRent(Number(e.target.value))}
                    required
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-semibold text-slate-900 rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-500 font-normal">
                    Locked into tenancy snapshot. Future tariff revisions won't alter this agreement.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">
                    Security Caution Deposit Snapshot (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="500"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                    required
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-semibold text-slate-900 rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                  <p className="text-[10px] text-slate-500 font-normal">
                    Refundable caution money upon physical key return.
                  </p>
                </div>
              </div>

              {isReserve ? (
                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Hold / Reservation Duration (Days)</label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={reservationDays}
                    onChange={(e) => setReservationDays(Number(e.target.value))}
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-normal rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-medium text-xs text-slate-700">Agreement Classification</label>
                  <select
                    value={allocationType}
                    onChange={(e) => setAllocationType(e.target.value as AllocationType)}
                    className="w-full h-10 px-3 bg-slate-50/80 border border-slate-300 rounded-xl font-medium text-xs text-slate-900 cursor-pointer focus:border-emerald-700 focus:bg-white"
                  >
                    {ALLOCATION_TYPES.map((at) => (
                      <option key={at.value} value={at.value}>
                        {at.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-medium text-xs text-slate-700">Operational Remarks / Key Handover Notes</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional notes regarding key handover, authorized joint operator, or special instructions"
                  rows={2}
                  className="w-full p-2.5 text-xs bg-slate-50/80 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 font-normal"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Review & Final Confirmation */}
          {currentStep === 4 && (
            <div className="space-y-4 font-normal">
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 flex items-center gap-2.5">
                <FileCheck className="w-5 h-5 text-emerald-800 shrink-0" />
                <div>
                  <h4 className="font-semibold text-emerald-950 text-xs">
                    Please Review Tenancy Agreement Details
                  </h4>
                  <p className="text-[11px] text-emerald-800 font-normal mt-0.5">
                    Confirming will assign <strong>Locker #{selectedLocker?.lockerNumber}</strong> to <strong>{selectedCustomer?.fullName}</strong> and transition unit status to {isReserve ? 'RESERVED' : 'OCCUPIED'}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Customer Card */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                    Verified Tenant Customer
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-semibold flex items-center justify-center shrink-0 shadow-2xs text-xs">
                      {selectedCustomer?.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-xs truncate font-sans">
                        {selectedCustomer?.fullName}
                      </p>
                      <p className="text-[11px] text-slate-500 font-sans tabular-nums">
                        {selectedCustomer?.customerCode} &bull; {selectedCustomer?.phone}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Locker Card */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
                  <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                    Physical Safe-Deposit Compartment
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-xs truncate font-sans">
                        Locker #{selectedLocker?.lockerNumber} (Size {selectedLocker?.size})
                      </p>
                      <p className="text-[11px] text-slate-500 font-normal">
                        {selectedLocker?.rackNumber} &bull; {selectedLocker?.section || 'Main Vault'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Snapshot Card */}
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                  Agreed Financial Pricing (Immutable Snapshot)
                </span>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase">START DATE</span>
                    <strong className="text-slate-900 text-xs font-sans font-medium tabular-nums">{startDate}</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase">ANNUAL RENT</span>
                    <strong className="text-emerald-800 text-xs font-sans font-semibold tabular-nums">₹{annualRent.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase">CAUTION DEPOSIT</span>
                    <strong className="text-slate-800 text-xs font-sans font-semibold tabular-nums">₹{securityDeposit.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-4.5 bg-slate-50/80 border-t border-slate-200/90 flex items-center justify-between gap-3 shrink-0">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
                disabled={isSubmitting}
                className="rounded-xl border-slate-300 font-medium text-xs h-9 px-3.5 flex items-center gap-1 cursor-pointer hover:bg-slate-50"
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
              className="rounded-xl border-slate-300 font-medium text-xs h-9 px-3.5 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </Button>

            {currentStep < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={handleNextStep}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs rounded-xl h-9 px-4 flex items-center gap-1 text-xs cursor-pointer"
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
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs min-w-[170px] rounded-xl h-9 px-4 text-xs cursor-pointer"
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

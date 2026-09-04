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
  Building,
  Check,
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
import { LOCKER_SIZES } from '../../lockers/constants';

interface AllocationWizardModalProps {
  mode?: 'allocate' | 'reserve';
  preSelectedLocker?: Locker | null;
  onClose: () => void;
  onSubmit: (data: CreateAllocationInput | ReserveLockerInput) => Promise<void>;
  isSubmitting: boolean;
}

export function AllocationWizardModal({
  mode = 'allocate',
  preSelectedLocker = null,
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
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(preSelectedLocker);
  const [sizeFilter, setSizeFilter] = useState('');
  const [rackFilter, setRackFilter] = useState('');

  // Step 3: Terms State
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('ANNUAL');
  const [annualRent, setAnnualRent] = useState<number>(preSelectedLocker?.annualRent ?? 3000);
  const [securityDeposit, setSecurityDeposit] = useState<number>(preSelectedLocker?.securityDeposit ?? 10000);
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
    setAnnualRent(locker.annualRent || 0);
    setSecurityDeposit(locker.securityDeposit || 0);
  };

  const canNavigateToStep = (targetStep: 1 | 2 | 3 | 4): boolean => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return Boolean(selectedCustomer);
    if (targetStep === 3) return Boolean(selectedCustomer && selectedLocker);
    if (targetStep === 4) return Boolean(selectedCustomer && selectedLocker && startDate);
    return false;
  };

  const handleStepClick = (targetStep: 1 | 2 | 3 | 4) => {
    if (canNavigateToStep(targetStep)) {
      setError(null);
      setCurrentStep(targetStep);
    }
  };

  const handleNextStep = () => {
    setError(null);
    if (currentStep === 1) {
      if (!selectedCustomer) {
        setError('Please select a verified customer to proceed.');
        return;
      }
      // If a locker was already pre-selected from Locker details, move straight to Terms (Step 3)
      if (selectedLocker) {
        setCurrentStep(3);
      } else {
        setCurrentStep(2);
      }
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

  // Financial calculations
  const parsedAnnualRent = Number(annualRent) || 0;
  const parsedDeposit = Number(securityDeposit) || 0;
  const totalInitialInflow = parsedAnnualRent + parsedDeposit;
  const monthlyEquivalent = Math.round(parsedAnnualRent / 12);

  const cycleInstallmentRent =
    billingCycle === 'MONTHLY'
      ? Math.round(parsedAnnualRent / 12)
      : billingCycle === 'QUARTERLY'
      ? Math.round(parsedAnnualRent / 4)
      : billingCycle === 'HALF_YEARLY'
      ? Math.round(parsedAnnualRent / 2)
      : parsedAnnualRent;

  const cycleFirstDue = cycleInstallmentRent + parsedDeposit;

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
        <div className="flex items-center justify-between p-4.5 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/80 shrink-0">
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
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-sans">
                {isReserve ? 'Reserve Safe-Deposit Locker' : 'New Locker Tenancy Allocation'}
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
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Step Indicator Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-200/90 text-center text-xs bg-slate-50/60 font-sans select-none">
          {[
            { step: 1 as const, num: '1', label: 'Customer' },
            { step: 2 as const, num: '2', label: 'Locker Unit' },
            { step: 3 as const, num: '3', label: 'Terms & Tariffs' },
            { step: 4 as const, num: '4', label: 'Confirmation' },
          ].map((tab) => {
            const isClickable = canNavigateToStep(tab.step);
            const isCurrent = currentStep === tab.step;
            const isCompleted = currentStep > tab.step;

            return (
              <button
                key={tab.step}
                type="button"
                onClick={() => handleStepClick(tab.step)}
                disabled={!isClickable && !isCurrent}
                className={`py-3 px-2 flex items-center justify-center gap-1.5 transition-all text-xs outline-none ${
                  isCurrent
                    ? 'border-b-2 border-emerald-800 text-emerald-950 bg-emerald-50/80 font-bold cursor-default'
                    : isCompleted
                    ? 'text-emerald-800 font-semibold bg-slate-50/30 hover:bg-emerald-50/40 cursor-pointer'
                    : isClickable
                    ? 'text-slate-600 font-medium hover:bg-slate-100/60 cursor-pointer'
                    : 'text-slate-400 font-normal cursor-not-allowed opacity-60'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center shrink-0 tabular-nums ${
                    isCurrent
                      ? 'bg-emerald-800 text-white font-bold'
                      : isCompleted
                      ? 'bg-emerald-100 text-emerald-800 font-bold'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? '✓' : tab.num}
                </span>
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Step Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs font-normal">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span className="font-semibold text-xs leading-relaxed">{error}</span>
            </div>
          )}

          {/* STEP 1: Select Customer */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Pre-Selected Locker Notice Banner */}
              {selectedLocker && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50/90 border border-emerald-200/90 text-emerald-950 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0 shadow-2xs">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          Locker #{selectedLocker.lockerNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white text-slate-700 font-semibold text-[10.5px] border border-slate-200 shadow-2xs">
                          Size {selectedLocker.size}
                        </span>
                        <span className="text-[11px] text-emerald-800 font-medium">
                          {selectedLocker.rackNumber} &bull; {selectedLocker.section || 'Main Vault'}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 font-normal mt-0.5">
                        Unit pre-selected. Pick a verified customer to complete tenancy agreement.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 pl-10.5 sm:pl-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">Base Rent</span>
                      <strong className="text-slate-900 text-xs font-bold tabular-nums">
                        ₹{selectedLocker.annualRent?.toLocaleString('en-IN')}/yr
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search verified customer by name, mobile phone number, or code (e.g. CUS-000371)..."
                  className="w-full h-10 pl-10 pr-9 bg-slate-50/80 border border-slate-300 rounded-xl font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 text-xs shadow-2xs font-sans"
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
                <div className="p-8 text-center text-slate-400 font-normal flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-800" />
                  <span>Searching registered customers...</span>
                </div>
              )}

              {!isSearchingCustomer && customerList.length === 0 && (
                <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <User className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-xs">No active customer found</p>
                  <p className="text-xs max-w-sm mx-auto font-normal text-slate-500">
                    Verify customer name/mobile number or register customer in the Customers module first.
                  </p>
                </div>
              )}

              {/* Customer Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {customerList.map((cust) => {
                  const isSelected = selectedCustomer?._id === cust._id;

                  return (
                    <div
                      key={cust._id}
                      onClick={() => setSelectedCustomer(cust)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-emerald-800 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-800/30'
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
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold font-sans text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {cust.fullName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-slate-900 text-xs truncate font-sans">
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
                          <span className="font-sans font-medium text-slate-900 text-xs tabular-nums tracking-tight truncate">
                            {formatPhone(cust.phone)}
                          </span>
                        </div>

                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 text-emerald-800 font-bold text-[11px] shrink-0 ml-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Selected</span>
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-normal">Click to select</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Customer Floating Banner */}
              {selectedCustomer && (
                <div
                  className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 overflow-hidden ${
                    selectedCustomer.kycStatus === 'VERIFIED'
                      ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950 shadow-2xs'
                      : 'bg-amber-50/90 border-amber-200 text-amber-950 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {selectedCustomer.kycStatus === 'VERIFIED' ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-emerald-700 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4.5 h-4.5 text-amber-700 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-xs font-sans truncate">
                        Selected: {selectedCustomer.fullName} ({selectedCustomer.customerCode})
                      </p>
                      <p className="text-[11px] text-slate-600 font-normal">
                        {selectedCustomer.kycStatus === 'VERIFIED'
                          ? 'KYC Verified customer. Ready for agreement.'
                          : `KYC is ${selectedCustomer.kycStatus}. Ensure verification documents are completed.`}
                      </p>
                    </div>
                  </div>
                  <span className="font-sans font-semibold text-xs tabular-nums text-slate-900 shrink-0 pl-7 sm:pl-0">
                    {formatPhone(selectedCustomer.phone)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Select Available Locker */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {/* If pre-selected unit is active, show hero banner */}
              {selectedLocker && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                      <Check className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">
                          Selected: Locker #{selectedLocker.lockerNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10.5px] font-bold text-slate-700">
                          Size {selectedLocker.size}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                        {selectedLocker.rackNumber} &bull; {selectedLocker.section || 'Main Vault'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-11.5 sm:pl-0">
                    <span className="text-xs font-bold text-slate-900 tabular-nums">
                      ₹{selectedLocker.annualRent?.toLocaleString('en-IN')}/yr
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleNextStep}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl h-8 px-3 cursor-pointer shadow-2xs"
                    >
                      Use This Locker &rarr;
                    </Button>
                  </div>
                </div>
              )}

              {/* Filter Toolbar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-xs text-slate-700">Filter by Locker Size</label>
                  <select
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-50/80 border border-slate-300 rounded-xl font-medium text-xs text-slate-900 cursor-pointer focus:border-emerald-700 focus:bg-white"
                  >
                    <option value="">All Sizes (A to G2)</option>
                    {LOCKER_SIZES.map((s) => (
                      <option key={s.code} value={s.code}>
                        Size {s.code} ({s.dimensions})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-xs text-slate-700">Filter by Physical Rack</label>
                  <Input
                    type="text"
                    value={rackFilter}
                    onChange={(e) => setRackFilter(e.target.value)}
                    placeholder="e.g. Rack 20 or Rack-01"
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 rounded-xl font-normal focus:border-emerald-700 focus:bg-white"
                  />
                </div>
              </div>

              {isLoadingLockers && (
                <div className="p-8 text-center text-slate-400 font-normal flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-800" />
                  <span>Querying vacant safe-deposit lockers...</span>
                </div>
              )}

              {!isLoadingLockers && availableLockers.length === 0 && (
                <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-slate-200">
                  <KeyRound className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-xs">No vacant lockers found</p>
                  <p className="text-xs max-w-sm mx-auto font-normal text-slate-500">
                    All units matching your criteria are currently occupied or reserved.
                  </p>
                </div>
              )}

              {/* Available Lockers Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {availableLockers.map((locker) => {
                  const isSelected = selectedLocker?._id === locker._id;

                  return (
                    <div
                      key={locker._id}
                      onClick={() => handleSelectLocker(locker)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                        isSelected
                          ? 'border-emerald-800 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-800/30'
                          : 'border-slate-200/90 hover:border-emerald-400 bg-white hover:bg-emerald-50/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs font-sans">
                            <KeyRound className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                            <span>Locker #{locker.lockerNumber}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {locker.rackNumber} &bull; {locker.section || 'Main Vault'}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold font-sans text-[10.5px] shrink-0">
                          {locker.size}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-normal">
                        <div>
                          <span className="text-slate-400 block text-[9.5px] font-sans uppercase font-medium">
                            Rent
                          </span>
                          <strong className="text-slate-900 text-xs font-sans font-bold tabular-nums">
                            ₹{locker.annualRent?.toLocaleString('en-IN')}/yr
                          </strong>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-400 block text-[9.5px] font-sans uppercase font-medium">
                            Deposit
                          </span>
                          <strong className="text-slate-700 text-xs font-sans font-semibold tabular-nums">
                            ₹{locker.securityDeposit?.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Pricing & Terms */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {/* Unit & Customer Header Pill */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <span className="font-bold text-slate-900">{selectedCustomer?.fullName}</span>
                  <span className="text-slate-500 font-normal">({selectedCustomer?.customerCode})</span>
                </div>
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-800" />
                  <span className="font-bold text-slate-900">Locker #{selectedLocker?.lockerNumber}</span>
                  <span className="px-1.5 py-0.2 rounded bg-white border border-slate-200 font-semibold text-[10.5px]">
                    Size {selectedLocker?.size}
                  </span>
                </div>
              </div>

              {/* Date and Billing Cycle Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="font-semibold text-xs text-slate-700">Tenancy Start Date *</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-medium rounded-xl focus:border-emerald-700 focus:bg-white"
                  />
                  <span className="text-[10.5px] text-slate-500 block font-normal">
                    1-Year Expiry: <strong className="font-semibold text-slate-700 tabular-nums">{previewEndDate}</strong>
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-xs text-slate-700">Billing Cycle *</label>
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

              {/* Tariff Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="font-semibold text-xs text-slate-700">
                    Annual Rent Tariff (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={annualRent}
                    onChange={(e) => setAnnualRent(Number(e.target.value))}
                    required
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-bold text-slate-900 rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                  <p className="text-[10.5px] text-slate-500 font-normal">
                    Equivalent to ~₹{monthlyEquivalent.toLocaleString('en-IN')}/month.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-xs text-slate-700">
                    Caution Deposit (₹) *
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                    required
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-bold text-slate-900 rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                  <p className="text-[10.5px] text-slate-500 font-normal">
                    100% refundable upon key return at surrender.
                  </p>
                </div>
              </div>

              {/* Dynamic Financial Inflow Breakdown Card */}
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/90 space-y-2">
                <span className="text-[10.5px] font-bold text-emerald-950 uppercase tracking-wider block">
                  Booking Inflow &amp; Payment Schedule Breakdown
                </span>
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200/80 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Annual Rent</span>
                    <strong className="text-slate-900 text-xs font-bold tabular-nums">
                      ₹{parsedAnnualRent.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-emerald-200/80 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Caution Deposit</span>
                    <strong className="text-slate-900 text-xs font-bold tabular-nums">
                      ₹{parsedDeposit.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-emerald-100/90 rounded-xl border border-emerald-300 shadow-2xs">
                    <span className="text-[10px] text-emerald-950 block uppercase font-bold">Total Initial Inflow</span>
                    <strong className="text-emerald-950 text-xs font-bold tabular-nums">
                      ₹{totalInitialInflow.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                {billingCycle !== 'ANNUAL' && (
                  <p className="text-[11px] text-emerald-900 font-medium pt-1">
                    &bull; {billingCycle} Cycle: First installment of <strong>₹{cycleInstallmentRent.toLocaleString('en-IN')}</strong> + Deposit <strong>₹{parsedDeposit.toLocaleString('en-IN')}</strong> = <strong>₹{cycleFirstDue.toLocaleString('en-IN')}</strong> due at check-in.
                  </p>
                )}
              </div>

              {isReserve ? (
                <div className="space-y-1">
                  <label className="font-semibold text-xs text-slate-700">Hold / Reservation Duration (Days)</label>
                  <Input
                    type="number"
                    min="1"
                    max="30"
                    value={reservationDays}
                    onChange={(e) => setReservationDays(Number(e.target.value))}
                    className="h-10 text-xs bg-slate-50/80 border-slate-300 font-medium rounded-xl tabular-nums focus:border-emerald-700 focus:bg-white"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-semibold text-xs text-slate-700">Agreement Classification</label>
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
                <label className="font-semibold text-xs text-slate-700">Operational Remarks / Key Handover Notes</label>
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
            <div className="space-y-3.5 font-normal">
              <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 flex items-center gap-2.5 shadow-2xs">
                <FileCheck className="w-5 h-5 text-emerald-800 shrink-0" />
                <div>
                  <h4 className="font-bold text-emerald-950 text-xs">
                    Please Review Tenancy Agreement Details
                  </h4>
                  <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                    Confirming will assign <strong>Locker #{selectedLocker?.lockerNumber}</strong> to <strong>{selectedCustomer?.fullName}</strong> and transition unit status to {isReserve ? 'RESERVED' : 'OCCUPIED'}.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Customer Card */}
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Verified Tenant Customer
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold flex items-center justify-center shrink-0 shadow-2xs text-xs">
                      {selectedCustomer?.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate font-sans">
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
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Safe-Deposit Compartment
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate font-sans">
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
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Agreed Financial Pricing (Immutable Snapshot)
                </span>
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase font-medium">START DATE</span>
                    <strong className="text-slate-900 text-xs font-sans font-bold tabular-nums">{startDate}</strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase font-medium">ANNUAL RENT</span>
                    <strong className="text-emerald-800 text-xs font-sans font-bold tabular-nums">
                      ₹{parsedAnnualRent.toLocaleString('en-IN')}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9.5px] font-sans text-slate-500 block uppercase font-medium">CAUTION DEPOSIT</span>
                    <strong className="text-slate-800 text-xs font-sans font-bold tabular-nums">
                      ₹{parsedDeposit.toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:px-6 sm:py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div>
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setError(null);
                  // If preSelectedLocker is present and we're at Step 3, going back goes to Step 1 directly
                  if (currentStep === 3 && preSelectedLocker && selectedLocker?._id === preSelectedLocker._id) {
                    setCurrentStep(1);
                  } else {
                    setCurrentStep((prev) => (prev - 1) as any);
                  }
                }}
                disabled={isSubmitting}
                className="rounded-xl border-slate-300 font-semibold text-slate-700 text-xs h-8.5 px-3.5 flex items-center gap-1 cursor-pointer hover:bg-slate-100"
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
              className="rounded-xl border-slate-300 text-slate-700 font-semibold text-xs h-8.5 px-3.5 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </Button>

            {currentStep < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={handleNextStep}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold shadow-xs rounded-xl h-8.5 px-4 flex items-center gap-1 text-xs cursor-pointer"
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
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold shadow-xs min-w-[170px] rounded-xl h-8.5 px-4 text-xs cursor-pointer"
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

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Key,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Lock,
  Receipt,
  Coins,
  Sparkles,
  Check,
  RotateCcw,
  User,
  Info,
} from 'lucide-react';
import { allocationApi } from '../../allocations/api/allocationApi';
import { LockerAllocation } from '../../allocations/types';
import { closureApi } from '../api/closureApi';
import {
  ClosureType,
  LockerCondition,
  PhysicalChecklist,
  ClosureReadinessSummary,
} from '../types';

interface NewClosureWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const STEPS = [
  { id: 1, title: 'Tenancy', subtitle: 'Select Allocation' },
  { id: 2, title: 'Reason & Date', subtitle: 'Terms & Timeline' },
  { id: 3, title: 'Financials', subtitle: 'Dues & Caution Refund' },
  { id: 4, title: 'Custody Handover', subtitle: 'Vault & Keys Checklist' },
  { id: 5, title: 'Review & Submit', subtitle: 'Pre-Flight Verification' },
];

const PRESET_REASONS = [
  {
    label: 'Relocating City',
    text: 'Customer relocating to another city / state, no longer requiring safe deposit vault custody.',
  },
  {
    label: 'No Longer Needed',
    text: 'Customer completed personal custody requirement; locker safe custody no longer needed.',
  },
  {
    label: 'Upgrading Locker',
    text: 'Customer requested surrender to switch to a different locker size / category.',
  },
  {
    label: 'Estate / Deceased Claim',
    text: 'Surrender processed under legal heir estate claim and deceased settlement guidelines.',
  },
  {
    label: 'Rental Cost Saving',
    text: 'Customer discontinuing annual subscription due to high maintenance and rental expense.',
  },
];

export const NewClosureWizard: React.FC<NewClosureWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [maxStepReached, setMaxStepReached] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Allocation Search
  const [allocSearch, setAllocSearch] = useState<string>('');
  const [allocations, setAllocations] = useState<LockerAllocation[]>([]);
  const [loadingAllocations, setLoadingAllocations] = useState<boolean>(false);
  const [selectedAllocation, setSelectedAllocation] =
    useState<LockerAllocation | null>(null);

  // Step 2: Reason & Type
  const [closureType, setClosureType] =
    useState<ClosureType>('CUSTOMER_REQUEST');
  const [requestedClosureDate, setRequestedClosureDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [closureReason, setClosureReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Step 3: Financial Readiness
  const [readiness, setReadiness] = useState<ClosureReadinessSummary | null>(
    null
  );
  const [loadingReadiness, setLoadingReadiness] = useState<boolean>(false);

  // Step 4: Physical Checklist (Full 7-point custody checklist)
  const [checklist, setChecklist] = useState<PhysicalChecklist>({
    lockerEmptied: true,
    lockerInspected: true,
    lockerCondition: 'GOOD',
    customerKeyReturned: true,
    masterKeyCheckCompleted: true,
    documentsReturned: true,
    physicalAccessRevoked: true,
    damageNotes: '',
    keyReplacementRequired: false,
  });

  // Track max step reached for breadcrumb navigation
  useEffect(() => {
    if (currentStep > maxStepReached) {
      setMaxStepReached(currentStep);
    }
  }, [currentStep, maxStepReached]);

  // Search active allocations
  useEffect(() => {
    if (!isOpen) return;

    const fetchAllocations = async () => {
      setLoadingAllocations(true);
      try {
        const res = await allocationApi.getAllocations({
          status: 'ACTIVE',
          search: allocSearch,
          limit: 15,
        });
        setAllocations(res.allocations);
      } catch (err: any) {
        console.error('Error fetching allocations:', err);
      } finally {
        setLoadingAllocations(false);
      }
    };

    const timer = setTimeout(fetchAllocations, 250);
    return () => clearTimeout(timer);
  }, [allocSearch, isOpen]);

  // Fetch readiness when allocation is selected and navigating to Step 3
  useEffect(() => {
    if (selectedAllocation && currentStep === 3) {
      setLoadingReadiness(true);
      closureApi
        .getClosureReadiness(selectedAllocation._id, checklist)
        .then((data) => setReadiness(data))
        .catch((err) => console.error('Error calculating readiness:', err))
        .finally(() => setLoadingReadiness(false));
    }
  }, [selectedAllocation, currentStep, checklist]);

  if (!isOpen) return null;

  const handleNext = () => {
    setError(null);
    if (currentStep === 1 && !selectedAllocation) {
      setError('Please select an active locker allocation to continue.');
      return;
    }
    if (currentStep === 2 && (!closureReason || closureReason.trim().length < 5)) {
      setError('Please provide a specific reason for the locker closure (minimum 5 characters).');
      return;
    }
    if (
      currentStep === 4 &&
      checklist.lockerCondition !== 'GOOD' &&
      (!checklist.damageNotes || checklist.damageNotes.trim().length < 3)
    ) {
      setError('Please provide brief damage notes for non-standard locker condition.');
      return;
    }
    setCurrentStep((prev) => Math.min(5, prev + 1));
  };

  const handlePrev = () => {
    setError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const goToStep = (stepNumber: number) => {
    if (stepNumber <= maxStepReached || stepNumber <= currentStep) {
      setError(null);
      setCurrentStep(stepNumber);
    }
  };

  const setDatePreset = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setRequestedClosureDate(d.toISOString().split('T')[0]);
  };

  const markAllChecklistNormal = () => {
    setChecklist({
      lockerEmptied: true,
      lockerInspected: true,
      lockerCondition: 'GOOD',
      customerKeyReturned: true,
      masterKeyCheckCompleted: true,
      documentsReturned: true,
      physicalAccessRevoked: true,
      damageNotes: '',
      keyReplacementRequired: false,
    });
  };

  const handleSubmit = async () => {
    if (!selectedAllocation) return;

    setSubmitting(true);
    setError(null);

    try {
      await closureApi.createClosure({
        allocationId: selectedAllocation._id,
        closureType,
        closureReason,
        requestedClosureDate,
        physicalChecklist: checklist,
        notes,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to initiate locker closure workflow'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Helper calculation for Net Financial Balance
  const netFinancialBalance = readiness
    ? readiness.availableRefundableBalance - readiness.outstandingInvoiceAmount
    : 0;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex h-[100dvh] w-screen items-center justify-center overflow-y-auto bg-slate-950/65 p-2 sm:p-4 md:p-6 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-closure-title"
        className="my-auto flex max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden transition-all"
      >
        {/* Modal Top Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/75 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="new-closure-title"
                className="text-base sm:text-lg font-bold text-slate-900 leading-tight"
              >
                Initiate Locker Surrender & Closure
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Step {currentStep} of 5 &bull; {STEPS[currentStep - 1].title} —{' '}
                {STEPS[currentStep - 1].subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close surrender wizard"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Interactive Multi-Step Stepper Bar */}
        <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-2.5 shrink-0">
          {/* Desktop/Tablet Stepper */}
          <div className="hidden sm:flex items-center justify-between gap-1">
            {STEPS.map((step) => {
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const isClickable = step.id <= maxStepReached;

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => isClickable && goToStep(step.id)}
                  disabled={!isClickable}
                  className={`flex-1 flex items-center gap-2 p-1.5 rounded-lg text-left transition-all ${
                    isCurrent
                      ? 'bg-emerald-50 text-emerald-900 font-semibold'
                      : isCompleted
                      ? 'text-slate-700 hover:bg-slate-100 cursor-pointer'
                      : 'text-slate-400 cursor-not-allowed opacity-75'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/30'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5 stroke-[2.5]" /> : step.id}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs truncate font-medium">{step.title}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile Stepper Pill & Mini Bar */}
          <div className="sm:hidden flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span className="font-semibold text-slate-900">
                Step {currentStep}/5: {STEPS[currentStep - 1].title}
              </span>
              <span className="text-emerald-700 text-[11px] font-mono">
                {Math.round((currentStep / 5) * 100)}% completed
              </span>
            </div>
            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 5) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {/* STEP 1: Select Active Allocation */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Search Active Custody Lease
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={allocSearch}
                    onChange={(e) => setAllocSearch(e.target.value)}
                    placeholder="Search by customer name, phone, locker #, or allocation code..."
                    className="w-full pl-9 pr-8 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    autoFocus
                  />
                  {allocSearch && (
                    <button
                      type="button"
                      onClick={() => setAllocSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="max-h-72 sm:max-h-80 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white shadow-2xs">
                {loadingAllocations ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    <div className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
                    <p>Loading active agreements from custody ledger...</p>
                  </div>
                ) : allocations.length === 0 ? (
                  <div className="p-8 text-center">
                    <Lock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-700">
                      No active allocations found
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Try searching with locker number, customer name or agreement code.
                    </p>
                  </div>
                ) : (
                  allocations.map((alloc: any) => {
                    const isSelected = selectedAllocation?._id === alloc._id;
                    const cust = alloc.customerId;
                    const lock = alloc.lockerId;

                    return (
                      <div
                        key={alloc._id}
                        onClick={() => setSelectedAllocation(alloc)}
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-50/90 border-l-4 border-l-emerald-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] font-semibold text-slate-500 leading-none">
                              LOCKER
                            </span>
                            <span className="font-mono font-bold text-xs text-slate-900 leading-tight">
                              #{lock?.lockerNumber || 'N/A'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm truncate">
                                {cust?.fullName || 'Customer Record'}
                              </span>
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {lock?.size || 'Standard'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5 flex flex-wrap items-center gap-x-2">
                              <span>Code: {alloc.allocationCode}</span>
                              {cust?.phone && <span>&bull; Phone: {cust.phone}</span>}
                              {alloc.securityDeposit > 0 && (
                                <span className="text-emerald-700 font-semibold">
                                  &bull; Deposit: ₹{alloc.securityDeposit.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="p-1 rounded-full bg-emerald-600 text-white shrink-0 ml-2">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-600 shrink-0">
                            Select &rarr;
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Closure Reason & Details */}
          {currentStep === 2 && selectedAllocation && (
            <div className="space-y-4">
              {/* Elevated Target Tenancy Card */}
              <div className="p-3.5 bg-gradient-to-r from-slate-50 to-emerald-50/40 border border-emerald-200/80 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        Locker #{(selectedAllocation.lockerId as any)?.lockerNumber} &bull;{' '}
                        {(selectedAllocation.customerId as any)?.fullName}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                        {(selectedAllocation.lockerId as any)?.size || 'Standard'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-0.5">
                      Tenancy Code: {selectedAllocation.allocationCode} &bull; Phone:{' '}
                      {(selectedAllocation.customerId as any)?.phone || 'N/A'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline shrink-0 px-2 py-1"
                >
                  Change
                </button>
              </div>

              {/* Closure Type & Date Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Closure Type
                  </label>
                  <select
                    value={closureType}
                    onChange={(e) => setClosureType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="CUSTOMER_REQUEST">Customer Voluntary Surrender</option>
                    <option value="NORMAL">Standard Tenure Expiration</option>
                    <option value="NON_RENEWAL">Non-Renewal Default</option>
                    <option value="ADMINISTRATIVE">Administrative Termination</option>
                    <option value="TRANSFER">Locker Relocation / Category Upgrade</option>
                    <option value="LEGACY_IMPORT">Historical Legacy Record</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Requested Closure Date
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDatePreset(0)}
                        className="text-[10px] font-semibold text-emerald-700 hover:underline"
                      >
                        Today
                      </button>
                      <span className="text-slate-300">&bull;</span>
                      <button
                        type="button"
                        onClick={() => setDatePreset(30)}
                        className="text-[10px] font-semibold text-emerald-700 hover:underline"
                      >
                        +30 Days
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="date"
                      value={requestedClosureDate}
                      onChange={(e) => setRequestedClosureDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Preset Reason Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Reason for Surrender / Closure *
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {closureReason.length} characters (min 5)
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_REASONS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setClosureReason(preset.text)}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 transition-colors"
                    >
                      + {preset.label}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  placeholder="e.g. Relocating to another city, no longer requiring safe deposit locker custody..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Internal Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional cashier remarks or handover instructions..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Financial Readiness */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {loadingReadiness ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  <div className="inline-block w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
                  <p>Calculating live billing dues, caution money balance & invoices...</p>
                </div>
              ) : readiness ? (
                <>
                  {/* High-Level Status Banner */}
                  <div
                    className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                      readiness.isFinanciallyCleared
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : 'bg-rose-50/80 border-rose-200 text-rose-950'
                    }`}
                  >
                    {readiness.isFinanciallyCleared ? (
                      <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="font-bold text-sm">
                        {readiness.isFinanciallyCleared
                          ? 'Financially Cleared for Closure'
                          : 'Financial Settlement Pending'}
                      </div>
                      <p className="text-xs mt-0.5 opacity-90">
                        {readiness.isFinanciallyCleared
                          ? 'All rental invoices are cleared and caution deposit ledger is reconciled.'
                          : 'Outstanding dues or pending caution deposit refunds must be settled before final release.'}
                      </p>
                    </div>
                    {/* Net Settlement Pill */}
                    <div className="shrink-0 text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">
                        Net Position
                      </span>
                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                          netFinancialBalance >= 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {netFinancialBalance >= 0
                          ? `Refund: ₹${netFinancialBalance.toLocaleString('en-IN')}`
                          : `Collect: ₹${Math.abs(netFinancialBalance).toLocaleString('en-IN')}`}
                      </span>
                    </div>
                  </div>

                  {/* 2-Column Ledger Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Invoices */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                          <Receipt className="w-3.5 h-3.5 text-slate-400" />
                          Rental Invoices Dues
                        </span>
                        {readiness.outstandingInvoiceAmount === 0 && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                            Cleared
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-bold text-slate-900 font-mono mt-1.5">
                        ₹{readiness.outstandingInvoiceAmount.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {readiness.outstandingInvoicesCount} unpaid invoice(s) &bull; Total
                        billed: ₹{readiness.totalBilledAmount.toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Caution Deposit */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 uppercase flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-emerald-600" />
                          Available Refundable Deposit
                        </span>
                        <span className="text-[10px] font-bold text-slate-700 bg-slate-200/70 px-1.5 py-0.5 rounded">
                          Held: ₹{readiness.netDepositHeld.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-xl font-bold text-emerald-700 font-mono mt-1.5">
                        ₹{readiness.availableRefundableBalance.toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Refund pending: ₹{readiness.pendingRefundAmount.toLocaleString('en-IN')}{' '}
                        &bull; Deductions: ₹{readiness.totalDeductions.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Open Invoices List if any */}
                  {readiness.openInvoices && readiness.openInvoices.length > 0 && (
                    <div className="border border-rose-200/80 rounded-xl p-3 bg-rose-50/40">
                      <div className="text-xs font-bold text-rose-900 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Unpaid Invoices Requiring Settlement:
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto">
                        {readiness.openInvoices.map((inv) => (
                          <div
                            key={inv._id}
                            className="text-xs bg-white p-2 rounded-lg border border-rose-200/60 flex items-center justify-between font-mono"
                          >
                            <div>
                              <span className="font-bold text-slate-800">
                                {inv.invoiceNumber}
                              </span>
                              <span className="text-slate-500 ml-2 font-sans">
                                Due: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                            <span className="font-bold text-rose-700">
                              ₹{inv.balanceAmount.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Items / Blockers */}
                  {readiness.blockers.length > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="text-xs font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-amber-700" />
                        Settlement Action Items:
                      </div>
                      <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                        {readiness.blockers.map((b, idx) => (
                          <li key={idx}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* STEP 4: Physical Custody Checklist (Full 7 Checkpoints) */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-700 font-semibold">
                  Verify vault handover protocols completed by counter staff:
                </div>
                <button
                  type="button"
                  onClick={markAllChecklistNormal}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Mark All Verified
                </button>
              </div>

              {/* 6 Primary Handover Checks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.lockerEmptied}
                    onChange={(e) =>
                      setChecklist({ ...checklist, lockerEmptied: e.target.checked })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Locker Completely Emptied by Customer
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.customerKeyReturned}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        customerKeyReturned: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Customer Keys Returned to Vault
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.masterKeyCheckCompleted}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        masterKeyCheckCompleted: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Master / Custodian Key Check Completed
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.documentsReturned}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        documentsReturned: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Passbook & Surrender Form Returned
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.physicalAccessRevoked}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        physicalAccessRevoked: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Biometric & RFID Vault Access Revoked
                  </span>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={checklist.lockerInspected}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        lockerInspected: e.target.checked,
                      })
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Lock, Hinges & Body Inspected
                  </span>
                </label>
              </div>

              {/* Key Lost / Replacement Toggle */}
              <div
                className={`p-3 rounded-xl border transition-all ${
                  checklist.keyReplacementRequired
                    ? 'bg-amber-50/90 border-amber-300 text-amber-900'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <Key
                      className={`w-4 h-4 ${
                        checklist.keyReplacementRequired ? 'text-amber-700' : 'text-slate-500'
                      }`}
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Lost Key / Lock Replacement Required
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Flag if customer lost keys or cylinder needs drilling/replacement.
                      </span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={checklist.keyReplacementRequired}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        keyReplacementRequired: e.target.checked,
                      })
                    }
                    className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                </label>

                {checklist.keyReplacementRequired && (
                  <div className="mt-2 text-[11px] text-amber-800 bg-amber-100/70 p-2 rounded-lg font-medium">
                    ⚠️ Notice: Cylinder replacement fee will be deducted from customer caution
                    deposit during final settlement.
                  </div>
                )}
              </div>

              {/* Condition Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Locker Physical Condition
                  </label>
                  <select
                    value={checklist.lockerCondition}
                    onChange={(e) =>
                      setChecklist({
                        ...checklist,
                        lockerCondition: e.target.value as LockerCondition,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="GOOD">Good / Ready for Immediate Re-allocation</option>
                    <option value="MINOR_DAMAGE">Minor Cosmetic Scratch / Clean Required</option>
                    <option value="DAMAGED">Damaged / Requires Locksmith Maintenance</option>
                    <option value="KEY_ISSUE">Key Stuck / Cylinder Fault</option>
                    <option value="OTHER">Other Operational Issue</option>
                  </select>
                </div>

                {checklist.lockerCondition !== 'GOOD' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Damage / Maintenance Notes *
                    </label>
                    <input
                      type="text"
                      value={checklist.damageNotes}
                      onChange={(e) =>
                        setChecklist({ ...checklist, damageNotes: e.target.value })
                      }
                      placeholder="Specify damage notes or locksmith task..."
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {currentStep === 5 && selectedAllocation && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3.5">
                {/* Tenancy Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div>
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      Custody Account
                    </span>
                    <div className="font-bold text-slate-900 text-sm">
                      {(selectedAllocation.customerId as any)?.fullName} &bull; Locker #
                      {(selectedAllocation.lockerId as any)?.lockerNumber}
                    </div>
                  </div>
                  <span className="text-xs font-mono bg-white px-2 py-1 border rounded-md text-slate-700">
                    {selectedAllocation.allocationCode}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Closure Type</span>
                    <span className="font-semibold text-slate-800">{closureType}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Effective Date</span>
                    <span className="font-semibold text-slate-800">
                      {requestedClosureDate}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Reason for Closure</span>
                    <span className="font-medium text-slate-800">{closureReason}</span>
                  </div>
                </div>

                {/* Financial Clearance Preview */}
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Financial Clearance:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-md ${
                      readiness?.isFinanciallyCleared
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {readiness?.isFinanciallyCleared
                      ? 'CLEARED'
                      : `PENDING SETTLEMENT (Dues: ₹${readiness?.outstandingInvoiceAmount.toLocaleString('en-IN')})`}
                  </span>
                </div>

                {/* Physical Handover Preview */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Locker Physical Condition:</span>
                  <span className="font-semibold text-slate-800">
                    {checklist.lockerCondition}{' '}
                    {checklist.keyReplacementRequired && '(Key Replacement Flagged)'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500">Workflow Entry Stage:</span>
                  <span className="font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                    DRAFT &rarr; PENDING REVIEW
                  </span>
                </div>
              </div>

              {/* Security Protocol Notice */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Submitting will create an authoritative Locker Closure workflow. In accordance with
                  safe deposit vault governance, an authorized Checker / Manager must inspect physical
                  surrender documents and approve financial refund before the locker is officially released.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Fixed Bottom Actions Footer */}
        <div className="px-5 py-3.5 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handlePrev}
            disabled={currentStep === 1 || submitting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-slate-700 hover:text-slate-900 font-semibold text-xs rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-200/60 transition-colors"
            >
              Cancel
            </button>

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Next Step
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Initiating Workflow...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Initiate Closure Workflow</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  KeyRound,
  AlertCircle,
  Loader2,
  CheckCircle2,
  User,
  ChevronDown,
  Calendar,
  Layers,
  Receipt,
  Search,
  Check,
  Building2,
  ShieldCheck,
  Mail,
  Clock,
} from 'lucide-react';
import { customerApi } from '../../customers/api/customerApi';
import { lockerApi } from '../../lockers/api/lockerApi';
import { Customer } from '../../customers/types';
import { Locker } from '../../lockers/types';
import { CreateAllocationInput, ReserveLockerInput, BillingCycle } from '../types';
import { LOCKER_SIZES } from '../../lockers/constants';

interface AllocationWizardModalProps {
  mode?: 'allocate' | 'reserve';
  preSelectedLocker?: Locker | null;
  preSelectedCustomer?: Customer | null;
  onClose: () => void;
  onSubmit: (data: CreateAllocationInput | ReserveLockerInput) => Promise<void>;
  isSubmitting: boolean;
}

export function AllocationWizardModal({
  mode = 'allocate',
  preSelectedLocker = null,
  preSelectedCustomer = null,
  onClose,
  onSubmit,
  isSubmitting,
}: AllocationWizardModalProps) {
  const initialSizeDef = LOCKER_SIZES.find(
    (s) => s.code === (preSelectedLocker?.size || 'A')
  );
  const initialTotalRent = preSelectedLocker?.annualRent || initialSizeDef?.defaultRent || 1180;
  const isDefaultSizeRent =
    !preSelectedLocker?.annualRent ||
    (initialSizeDef && preSelectedLocker.annualRent === initialSizeDef.defaultRent);
  const initialBaseRent =
    isDefaultSizeRent && initialSizeDef?.baseRent
      ? initialSizeDef.baseRent
      : preSelectedLocker?.securityDeposit
      ? Math.round(preSelectedLocker.securityDeposit / 2)
      : Math.round(initialTotalRent / 1.18);
  const initialGst = Math.max(0, initialTotalRent - initialBaseRent);

  // Locker details
  const [lockerNumber, setLockerNumber] = useState(preSelectedLocker?.lockerNumber || '');
  const [size, setSize] = useState(preSelectedLocker?.size || 'A');
  const [keyNumber, setKeyNumber] = useState(preSelectedLocker?.masterKeyReference || '');
  const [rackNumber, setRackNumber] = useState(preSelectedLocker?.rackNumber || '');
  const [rentAmount, setRentAmount] = useState<number>(initialBaseRent);
  const [gstAmount, setGstAmount] = useState<number>(initialGst);
  const [securityDeposit, setSecurityDeposit] = useState<number>(
    preSelectedLocker?.securityDeposit || initialSizeDef?.defaultDeposit || 2000
  );

  // Plan & Dates & Allocation Type
  const [rentalPlan, setRentalPlan] = useState<'1 Year' | '6 Months' | '3 Months' | '1 Month'>(
    '1 Year'
  );
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [allocationType, setAllocationType] = useState<'NEW' | 'RESERVED'>(
    mode === 'reserve' ? 'RESERVED' : 'NEW'
  );

  // Customer Details
  const [customerName, setCustomerName] = useState(preSelectedCustomer?.fullName || '');
  const [customerMobile, setCustomerMobile] = useState(preSelectedCustomer?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(preSelectedCustomer?.email || '');
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(preSelectedCustomer || null);

  // Sync customer details if preSelectedCustomer changes
  useEffect(() => {
    if (preSelectedCustomer) {
      setMatchedCustomer(preSelectedCustomer);
      setCustomerName(preSelectedCustomer.fullName);
      setCustomerMobile(preSelectedCustomer.phone);
      setCustomerEmail(preSelectedCustomer.email || '');
    }
  }, [preSelectedCustomer]);

  // Search / Lookup dropdown state
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Available Lockers lookup state
  const [availableLockers, setAvailableLockers] = useState<Locker[]>([]);
  const [selectedLocker, setSelectedLocker] = useState<Locker | null>(preSelectedLocker);
  const [showLockerDropdown, setShowLockerDropdown] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Auto-sync tariffs when size changes (if no locker explicitly selected yet)
  const handleSizeChange = (newSize: string) => {
    setSize(newSize);
    const sizeDef = LOCKER_SIZES.find((s) => s.code === newSize);
    if (sizeDef) {
      const base = sizeDef.baseRent || Math.round(sizeDef.defaultRent / 1.18);
      const gst = Math.max(0, sizeDef.defaultRent - base);
      setRentAmount(base);
      setGstAmount(gst);
      setSecurityDeposit(sizeDef.defaultDeposit);
    }
  };

  // Sync GST automatically when rent amount is modified
  const handleRentChange = (amount: number) => {
    setRentAmount(amount);
    setGstAmount(Math.round(amount * 0.18));
  };

  // Pre-load available lockers list for quick selection
  useEffect(() => {
    let isMounted = true;
    lockerApi
      .getAvailableLockers({ limit: 100 } as any)
      .then((lockers) => {
        if (isMounted) setAvailableLockers(lockers);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Quick Customer search when user types in Customer Name or Mobile
  useEffect(() => {
    const query = customerQuery.trim();
    if (!query) {
      setCustomerResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingCustomer(true);
      try {
        const res = await customerApi.getCustomers({ search: query, limit: 6, status: 'ACTIVE' });
        setCustomerResults(res.customers);
      } catch {
        // silent
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [customerQuery]);

  // Select customer from lookup
  const handleSelectCustomer = (cust: Customer) => {
    setMatchedCustomer(cust);
    setCustomerName(cust.fullName);
    setCustomerMobile(cust.phone);
    setCustomerEmail(cust.email || '');
    setShowCustomerDropdown(false);
    setCustomerQuery('');
  };

  // Select locker from lookup
  const handleSelectLocker = (l: Locker) => {
    setSelectedLocker(l);
    setLockerNumber(l.lockerNumber);
    setSize(l.size);
    setRackNumber(l.rackNumber);
    setKeyNumber(l.masterKeyReference || '');
    const sizeDef = LOCKER_SIZES.find((s) => s.code === l.size);
    const totalRent = l.annualRent || sizeDef?.defaultRent || 1180;
    const isDefaultSizeRent =
      !l.annualRent || (sizeDef && l.annualRent === sizeDef.defaultRent);
    const base =
      isDefaultSizeRent && sizeDef?.baseRent
        ? sizeDef.baseRent
        : l.securityDeposit
        ? Math.round(l.securityDeposit / 2)
        : Math.round(totalRent / 1.18);
    const gst = Math.max(0, totalRent - base);
    setRentAmount(base);
    setGstAmount(gst);
    setSecurityDeposit(l.securityDeposit || sizeDef?.defaultDeposit || 2000);
    setShowLockerDropdown(false);
  };

  // Escape key close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!lockerNumber.trim()) {
      setError('Please provide or select a Locker Number.');
      return;
    }
    if (!rackNumber.trim()) {
      setError('Please provide a Rack Number.');
      return;
    }

    try {
      // Step 1: Ensure Locker exists or obtain ID
      let finalLockerId = selectedLocker?._id;

      if (!finalLockerId) {
        // Check if locker with this number already exists
        const searchRes = await lockerApi.getLockers({ search: lockerNumber.trim(), limit: 1 });
        const existing = searchRes.lockers.find(
          (l) => l.lockerNumber.toLowerCase() === lockerNumber.trim().toLowerCase()
        );

        if (existing) {
          finalLockerId = existing._id;
        } else {
          // Create the locker first if it's a completely new unit
          const newLocker = await lockerApi.createLocker({
            lockerNumber: lockerNumber.trim(),
            size,
            rackNumber: rackNumber.trim(),
            masterKeyReference: keyNumber.trim() || undefined,
            annualRent: (Number(rentAmount) || 0) + (Number(gstAmount) || 0),
            securityDeposit: Number(securityDeposit),
            status: 'VACANT',
            operationalStatus: 'ACTIVE',
          });
          finalLockerId = newLocker._id;
        }
      }

      // Step 2: Ensure Customer exists or create customer record
      let finalCustomerId = matchedCustomer?._id;

      if (!finalCustomerId) {
        if (!customerName.trim()) {
          setError('Customer Name is required for tenancy allocation.');
          return;
        }
        if (!customerMobile.trim() || customerMobile.trim().length < 10) {
          setError('Valid 10-digit Customer Mobile number is required.');
          return;
        }

        // Check duplicate by phone
        const custSearch = await customerApi.getCustomers({
          search: customerMobile.trim(),
          limit: 1,
        });
        const existingCust = custSearch.customers.find((c) =>
          c.phone.includes(customerMobile.trim())
        );

        if (existingCust) {
          finalCustomerId = existingCust._id;
        } else {
          // Quick create customer
          const newCust = await customerApi.createCustomer({
            fullName: customerName.trim(),
            phone: customerMobile.trim(),
            email: customerEmail.trim() || undefined,
          });
          finalCustomerId = newCust._id;
        }
      }

      // Step 3: Map rental plan to BillingCycle enum
      const billingCycleMap: Record<string, BillingCycle> = {
        '1 Year': 'ANNUAL',
        '6 Months': 'HALF_YEARLY',
        '3 Months': 'QUARTERLY',
        '1 Month': 'MONTHLY',
      };

      const cycle = billingCycleMap[rentalPlan] || 'ANNUAL';

      const startD = new Date(startDate);
      let monthsToAdd = 12;
      if (cycle === 'HALF_YEARLY') monthsToAdd = 6;
      else if (cycle === 'QUARTERLY') monthsToAdd = 3;
      else if (cycle === 'MONTHLY') monthsToAdd = 1;
      const endD = new Date(startD);
      endD.setMonth(endD.getMonth() + monthsToAdd);
      endD.setDate(endD.getDate() - 1);

      // Step 4: Execute Allocation
      const totalRent = (Number(rentAmount) || 0) + (Number(gstAmount) || 0);
      if (allocationType === 'RESERVED') {
        await onSubmit({
          customerId: finalCustomerId,
          lockerId: finalLockerId,
          startDate: new Date(startDate).toISOString(),
          endDate: endD.toISOString(),
          billingCycle: cycle,
          annualRent: totalRent,
          securityDeposit: Number(securityDeposit),
          remarks: keyNumber.trim() ? `Key: ${keyNumber.trim()}` : undefined,
        });
      } else {
        await onSubmit({
          customerId: finalCustomerId,
          lockerId: finalLockerId,
          startDate: new Date(startDate).toISOString(),
          endDate: endD.toISOString(),
          billingCycle: cycle,
          annualRent: totalRent,
          securityDeposit: Number(securityDeposit),
          allocationType: 'NEW',
          remarks: keyNumber.trim() ? `Key: ${keyNumber.trim()}` : undefined,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to complete allocation.');
    }
  };

  const computedRenewalDates = useMemo(() => {
    const startD = new Date(startDate);
    if (isNaN(startD.getTime())) return null;
    let monthsToAdd = 12;
    if (rentalPlan === '6 Months') monthsToAdd = 6;
    else if (rentalPlan === '3 Months') monthsToAdd = 3;
    else if (rentalPlan === '1 Month') monthsToAdd = 1;
    const endD = new Date(startD);
    endD.setMonth(endD.getMonth() + monthsToAdd);
    endD.setDate(endD.getDate() - 1);
    const renewalDueD = new Date(endD);
    renewalDueD.setDate(renewalDueD.getDate() + 1);
    return {
      startDateStr: startD.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      endDateStr: endD.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      renewalDueStr: renewalDueD.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    };
  }, [startDate, rentalPlan]);

  const totalRentWithGst = (Number(rentAmount) || 0) + (Number(gstAmount) || 0);
  const totalInitialPayable = totalRentWithGst + (Number(securityDeposit) || 0);

  const termLabel =
    rentalPlan === '1 Year'
      ? '1st Year Rent'
      : rentalPlan === '6 Months'
      ? '6 Months Rent'
      : rentalPlan === '3 Months'
      ? '3 Months Rent'
      : '1 Month Rent';

  const grossRentLabel =
    rentalPlan === '1 Year'
      ? '1st Year Rent (Gross)'
      : rentalPlan === '6 Months'
      ? 'Half-Yearly Rent (Gross)'
      : rentalPlan === '3 Months'
      ? 'Quarterly Rent (Gross)'
      : 'Monthly Rent (Gross)';

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/60 backdrop-blur-xs select-none animate-in fade-in-0 duration-150 font-sans">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="allotment-wizard-title"
        className="w-full max-w-4xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200/90 animate-in zoom-in-95 duration-150 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header */}
        <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-slate-200/90 bg-gradient-to-r from-slate-50 via-white to-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-800 text-white flex items-center justify-center shadow-xs shrink-0">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="allotment-wizard-title"
                  className="text-base sm:text-lg font-bold tracking-tight text-slate-900"
                >
                  {selectedLocker || preSelectedLocker
                    ? `Allot Locker #${lockerNumber}`
                    : 'New Locker Allotment'}
                </h2>
                {(selectedLocker || preSelectedLocker) && (
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Unit #{lockerNumber} Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                Assign customer tenancy, configure rental plan, and record initial security deposit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Form Container */}
        <form
          id="allocation-wizard-form"
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col flex-1 overflow-hidden min-h-0"
        >
          <div className="p-5 sm:p-7 space-y-4 sm:space-y-5 overflow-y-auto flex-1 text-xs">
          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs font-semibold"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Module 1: Vault Unit & Physical Specification */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-xs">
                  <Layers className="w-4 h-4 text-emerald-800" />
                </div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                  1. Vault Unit & Physical Specification
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                Cabinet position & master key registration
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Locker Number */}
              <div className="relative">
                <label
                  htmlFor="alloc-locker-number"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Locker Number <span className="text-emerald-700">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none pointer-events-none">
                    #
                  </span>
                  <input
                    id="alloc-locker-number"
                    type="text"
                    value={lockerNumber}
                    onChange={(e) => {
                      setLockerNumber(e.target.value);
                      setSelectedLocker(null);
                      setShowLockerDropdown(true);
                    }}
                    onFocus={() => setShowLockerDropdown(true)}
                    placeholder="e.g. 42 or LOC-042"
                    className="w-full h-11 pl-9 pr-10 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 transition shadow-xs"
                    required
                  />
                  {availableLockers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowLockerDropdown(!showLockerDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                      title="Browse available lockers"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Available Lockers Autocomplete Dropdown */}
                {showLockerDropdown && availableLockers.length > 0 && !selectedLocker && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto p-1.5 text-xs">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 mb-1">
                      <span>Available Free Units</span>
                      <span className="font-semibold text-emerald-800">
                        {availableLockers.length} Free
                      </span>
                    </div>
                    {availableLockers
                      .filter((l) =>
                        l.lockerNumber.toLowerCase().includes(lockerNumber.trim().toLowerCase())
                      )
                      .slice(0, 8)
                      .map((l) => (
                        <div
                          key={l._id}
                          onClick={() => handleSelectLocker(l)}
                          className="px-3 py-2 hover:bg-emerald-50 rounded-lg cursor-pointer flex items-center justify-between text-slate-800 transition"
                        >
                          <span className="font-bold text-slate-900">#{l.lockerNumber}</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Size {l.size} &bull; {l.rackNumber}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Size & Dimensions */}
              <div>
                <label
                  htmlFor="alloc-size"
                  className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between"
                >
                  <span>Size & Physical Dimensions</span>
                  <span className="text-[10.5px] text-slate-400 font-normal">
                    Height × Width × Depth
                  </span>
                </label>
                <div className="relative">
                  <select
                    id="alloc-size"
                    value={size}
                    onChange={(e) => handleSizeChange(e.target.value)}
                    className="w-full h-11 pl-4 pr-10 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 cursor-pointer appearance-none transition shadow-xs"
                  >
                    {LOCKER_SIZES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label} &bull; {s.dimensions}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 h-4 w-4" />
                </div>
              </div>

              {/* Row 2: Master Key Reference */}
              <div>
                <label
                  htmlFor="alloc-key-number"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Master Key Reference <span className="text-emerald-700">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 select-none pointer-events-none">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <input
                    id="alloc-key-number"
                    type="text"
                    value={keyNumber}
                    onChange={(e) => setKeyNumber(e.target.value)}
                    placeholder="e.g. KEY-042 or K-1092"
                    className="w-full h-11 pl-11 pr-4 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 transition shadow-xs font-mono uppercase tracking-wider"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Vault Rack Number */}
              <div>
                <label
                  htmlFor="alloc-rack-number"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Vault Rack Number <span className="text-emerald-700">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 select-none pointer-events-none">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <input
                    id="alloc-rack-number"
                    type="text"
                    value={rackNumber}
                    onChange={(e) => setRackNumber(e.target.value)}
                    placeholder="e.g. Rack 493 or Bay-02"
                    className="w-full h-11 pl-11 pr-4 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 transition shadow-xs"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Module 2: Rental Plan & Commercial Tariffs Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-xs">
                  <Receipt className="w-4 h-4 text-emerald-800" />
                </div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                  2. Rental Plan & Commercial Tariffs
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                Applicable GST Rate: <span className="font-bold text-slate-700">18%</span>
              </span>
            </div>

            {/* Balanced 3-column Grid for Tariffs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Row 1, Col 1: Billing Cycle */}
              <div>
                <label
                  htmlFor="alloc-rental-plan"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Billing Cycle
                </label>
                <div className="relative">
                  <select
                    id="alloc-rental-plan"
                    value={rentalPlan}
                    onChange={(e) => setRentalPlan(e.target.value as any)}
                    className="w-full h-11 pl-4 pr-10 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 cursor-pointer appearance-none transition shadow-xs"
                  >
                    <option value="1 Year">1 Year (Annual)</option>
                    <option value="6 Months">6 Months (Half-Yearly)</option>
                    <option value="3 Months">3 Months (Quarterly)</option>
                    <option value="1 Month">1 Month</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 h-4 w-4" />
                </div>
              </div>

              {/* Row 1, Col 2: Allotment Start Date */}
              <div>
                <label
                  htmlFor="alloc-start-date"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Allotment Start Date <span className="text-emerald-700">*</span>
                </label>
                <div className="relative">
                  <input
                    id="alloc-start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-11 px-4 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 cursor-pointer transition shadow-xs"
                    required
                  />
                </div>
              </div>

              {/* Row 1, Col 3: Annual Rent (Excl. GST) */}
              <div>
                <label
                  htmlFor="alloc-rent-amount"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Annual Rent (Excl. GST) <span className="text-emerald-700">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 select-none pointer-events-none">
                    ₹
                  </span>
                  <input
                    id="alloc-rent-amount"
                    type="number"
                    min="0"
                    step="50"
                    value={rentAmount}
                    onChange={(e) => handleRentChange(Number(e.target.value))}
                    placeholder="0"
                    className="w-full h-11 pl-11 pr-4 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 tabular-nums transition shadow-xs"
                    required
                  />
                </div>
              </div>

              {/* Row 2, Col 1: GST (18%) Auto-computed display */}
              <div>
                <label
                  htmlFor="alloc-gst-amount"
                  className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between"
                >
                  <span>GST (18%)</span>
                  <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60">
                    Auto-computed
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 select-none pointer-events-none">
                    ₹
                  </span>
                  <div
                    id="alloc-gst-amount"
                    className="w-full h-11 pl-11 pr-4 text-sm font-bold text-slate-800 bg-slate-100/80 border border-slate-200 rounded-xl flex items-center tabular-nums shadow-xs select-all"
                  >
                    {Number(gstAmount || 0).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Row 2, Col 2: Security Deposit */}
              <div>
                <label
                  htmlFor="alloc-security-deposit"
                  className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between"
                >
                  <span>Security Deposit</span>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/80">
                    Refundable
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 select-none pointer-events-none">
                    ₹
                  </span>
                  <input
                    id="alloc-security-deposit"
                    type="number"
                    min="0"
                    step="100"
                    value={securityDeposit}
                    onChange={(e) => setSecurityDeposit(Number(e.target.value))}
                    placeholder="0"
                    className="w-full h-11 pl-11 pr-4 text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 tabular-nums transition shadow-xs"
                  />
                </div>
              </div>

              {/* Row 2, Col 3: Gross Rent Summary Pill */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {grossRentLabel}
                </label>
                <div className="h-11 px-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
                  <span className="text-xs text-slate-500 font-medium">Rent + 18% GST</span>
                  <span className="text-sm font-bold text-emerald-950 tabular-nums">
                    ₹ {totalRentWithGst.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Agreement Term & Renewal Schedule Preview */}
            {computedRenewalDates && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-slate-200/90 rounded-xl shadow-xs text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>
                    Agreement Term: <strong className="text-slate-800">{computedRenewalDates.startDateStr}</strong> to <strong className="text-slate-800">{computedRenewalDates.endDateStr}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60">
                  <span>Next Renewal Due:</span>
                  <span className="font-bold text-emerald-950">{computedRenewalDates.renewalDueStr}</span>
                </div>
              </div>
            )}

            {/* Clear Financial Settlement Card */}
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/80 to-teal-50/50 p-3.5 sm:p-4.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-slate-600">
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                    Base Rent
                  </span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    ₹ {Number(rentAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-slate-300 font-light text-sm select-none">+</div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                    GST (18%)
                  </span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    ₹ {Number(gstAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-slate-300 font-light text-sm select-none">=</div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-emerald-900 font-bold block">
                    {termLabel}
                  </span>
                  <span className="text-sm font-bold text-emerald-950 tabular-nums">
                    ₹ {totalRentWithGst.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="text-slate-300 font-light text-sm select-none">+</div>
                <div className="space-y-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                    Security Deposit
                  </span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    ₹ {Number(securityDeposit || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Total Due Callout */}
              <div className="flex items-center gap-3 bg-white px-3.5 py-2 rounded-xl border border-emerald-300 shadow-xs md:ml-auto shrink-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="text-right">
                  <span className="text-[9.5px] uppercase tracking-wider text-slate-500 font-bold block">
                    Total Due at Allotment
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-950 tabular-nums">
                    ₹ {totalInitialPayable.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Module 3: Customer Tenancy & Lease Agreement Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-xs">
                  <User className="w-4 h-4 text-emerald-800" />
                </div>
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">
                  3. Customer Tenancy & Lease Agreement
                </h3>
              </div>

              {/* Allocation Type Toggle */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-0.5 rounded-xl text-xs font-semibold shadow-xs">
                <button
                  type="button"
                  onClick={() => setAllocationType('NEW')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs ${
                    allocationType === 'NEW'
                      ? 'bg-emerald-800 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Active Allotment
                </button>
                <button
                  type="button"
                  onClick={() => setAllocationType('RESERVED')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer text-xs ${
                    allocationType === 'RESERVED'
                      ? 'bg-amber-700 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Advance Reservation
                </button>
              </div>
            </div>

            {/* If Customer is Verified & Matched */}
            {matchedCustomer ? (
              <div className="p-4 rounded-xl bg-white border border-emerald-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-800 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                    {matchedCustomer.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {matchedCustomer.fullName}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200">
                        <ShieldCheck className="h-3 w-3 text-emerald-700" />
                        KYC {matchedCustomer.kycStatus}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {matchedCustomer.phone} &bull; Code: {matchedCustomer.customerCode}
                      {matchedCustomer.email && ` • ${matchedCustomer.email}`}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMatchedCustomer(null);
                    setCustomerName('');
                    setCustomerMobile('');
                    setCustomerEmail('');
                  }}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer self-start sm:self-auto shadow-xs"
                >
                  Change Customer
                </button>
              </div>
            ) : (
              /* If Entering or Searching Customer */
              <div className="space-y-4">
                {/* Customer Name Search */}
                <div className="relative">
                  <label
                    htmlFor="alloc-customer-name"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Customer Name <span className="text-emerald-700">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="alloc-customer-name"
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setCustomerQuery(e.target.value);
                        setMatchedCustomer(null);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                      placeholder="Search existing customer or enter new applicant name..."
                      className="w-full h-11 pl-4 pr-11 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:border-emerald-600 focus:ring-3 focus:ring-emerald-600/15 transition shadow-xs"
                      required
                    />
                    {customerQuery ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerName('');
                          setCustomerQuery('');
                          setMatchedCustomer(null);
                        }}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4 pointer-events-none" />
                    )}
                  </div>

                  {/* Customer Autocomplete Dropdown */}
                  {showCustomerDropdown && (isSearchingCustomer || customerResults.length > 0) && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto p-1.5 text-xs">
                      {isSearchingCustomer && (
                        <div className="p-3 text-center text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-800" />
                          <span>Searching customer directory...</span>
                        </div>
                      )}
                      {customerResults.map((cust) => (
                        <div
                          key={cust._id}
                          onClick={() => handleSelectCustomer(cust)}
                          className="px-3 py-2 hover:bg-emerald-50 rounded-lg cursor-pointer flex items-center justify-between text-slate-800 transition"
                        >
                          <div>
                            <p className="font-bold text-xs text-slate-900">{cust.fullName}</p>
                            <p className="text-[10.5px] text-slate-500 font-medium">
                              {cust.phone} &bull; Code: {cust.customerCode}
                            </p>
                          </div>
                          <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            KYC {cust.kycStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Mobile & Email - Balanced 2 Columns */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="alloc-customer-mobile"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Customer Mobile Number <span className="text-emerald-700">*</span>
                      </label>
                      <span
                        className={`text-[10.5px] font-mono font-bold ${
                          customerMobile.length === 10 ? 'text-emerald-700' : 'text-slate-400'
                        }`}
                      >
                        {customerMobile.length}/10
                      </span>
                    </div>
                    <div className="flex items-center h-11 w-full rounded-xl border border-slate-300 bg-white shadow-xs focus-within:border-emerald-600 focus-within:ring-3 focus-within:ring-emerald-600/15 transition overflow-hidden">
                      <div className="flex items-center gap-1.5 px-3 h-full bg-slate-50 border-r border-slate-200 shrink-0 select-none">
                        <svg
                          className="w-4 h-3 rounded-2xs shrink-0 shadow-2xs"
                          viewBox="0 0 640 480"
                          aria-hidden="true"
                        >
                          <path fill="#f93" d="M0 0h640v160H0z" />
                          <path fill="#fff" d="M0 160h640v160H0z" />
                          <path fill="#128807" d="M0 320h640v160H0z" />
                          <circle cx="320" cy="240" r="40" fill="#008" />
                        </svg>
                        <span className="text-xs font-bold text-slate-700 font-mono">+91</span>
                      </div>
                      <input
                        id="alloc-customer-mobile"
                        type="tel"
                        inputMode="numeric"
                        value={customerMobile}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setCustomerMobile(val);
                          setCustomerQuery(val);
                          setMatchedCustomer(null);
                          setShowCustomerDropdown(true);
                        }}
                        placeholder="98765 43210"
                        maxLength={10}
                        className="flex-1 min-w-0 h-full px-3.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent border-none outline-none focus:ring-0 focus:outline-hidden tabular-nums"
                        required
                      />
                      {customerMobile.length === 10 && (
                        <div className="pr-3 flex items-center text-emerald-600 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="alloc-customer-email"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Customer Email Address
                    </label>
                    <div className="flex items-center h-11 w-full rounded-xl border border-slate-300 bg-white shadow-xs focus-within:border-emerald-600 focus-within:ring-3 focus-within:ring-emerald-600/15 transition overflow-hidden">
                      <div className="flex items-center justify-center pl-3.5 pr-2 h-full text-slate-400 shrink-0 select-none">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        id="alloc-customer-email"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="customer@example.com"
                        className="flex-1 min-w-0 h-full pr-3.5 pl-1 text-sm font-semibold text-slate-900 placeholder:text-slate-400 bg-transparent border-none outline-none focus:ring-0 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Pinned Modal Footer - Always Visible */}
          <div className="px-5 sm:px-7 py-3.5 border-t border-slate-200/90 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <span className="text-emerald-700 font-bold">*</span> Mandatory fields for statutory vault register
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl font-semibold text-xs text-slate-600 hover:bg-slate-200/70 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                form="allocation-wizard-form"
                onClick={(e) => {
                  if (!isSubmitting) {
                    handleSubmit(e);
                  }
                }}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-800 hover:bg-emerald-900 transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 min-w-[140px] justify-center"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing Allotment...</span>
                  </>
                ) : allocationType === 'RESERVED' ? (
                  <>
                    <Calendar className="h-4 w-4" />
                    <span>Reserve Locker</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-4 w-4" />
                    <span>
                      Confirm Allotment &bull; ₹ {totalInitialPayable.toLocaleString('en-IN')}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  KeyRound,
  AlertCircle,
  Building,
  ChevronDown,
  Eye,
  EyeOff,
  Copy,
  Check,
  IndianRupee,
  ShieldCheck,
  RotateCcw,
  User,
  Phone,
  Layers,
  MapPin,
  Lock,
} from 'lucide-react';
import { Locker, CreateLockerInput, UpdateLockerInput, LockerStatus, OperationalStatus } from '../types';
import { LOCKER_SIZES, LOCKER_STATUS_CONFIG, OPERATIONAL_STATUS_CONFIG } from '../constants';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { usePermission } from '../../../hooks/usePermission';
import { allocationApi } from '../../allocations/api/allocationApi';

const PRIMARY_SIZES = ['A', 'B', 'C', 'D'] as const;

interface LockerFormModalProps {
  locker?: Locker | null;
  onClose: () => void;
  onSubmit: (data: CreateLockerInput | UpdateLockerInput) => Promise<void>;
  isSubmitting: boolean;
}

export function LockerFormModal({
  locker,
  onClose,
  onSubmit,
  isSubmitting,
}: LockerFormModalProps) {
  const isEdit = Boolean(locker);
  const canViewSensitive = usePermission('lockers.view_sensitive');

  // Form State
  const [lockerNumber, setLockerNumber] = useState('');
  const [lockerCode, setLockerCode] = useState('');
  const [size, setSize] = useState('A');
  const [rackNumber, setRackNumber] = useState('');
  const [section, setSection] = useState('Main Vault');
  const [floor, setFloor] = useState('Ground Floor');
  const [position, setPosition] = useState('');
  const [masterKeyReference, setMasterKeyReference] = useState('');
  const [annualRent, setAnnualRent] = useState<number | string>(1180);
  const [securityDeposit, setSecurityDeposit] = useState<number | string>(2000);
  const [status, setStatus] = useState<LockerStatus>('VACANT');
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus>('ACTIVE');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Ergonomics state
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const lockerNumberRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch active allocation if editing an existing locker
  const { data: allocData } = useQuery({
    queryKey: ['locker-allocations', locker?._id],
    queryFn: () => allocationApi.getLockerAllocations(locker!._id),
    enabled: Boolean(isEdit && locker?._id),
    staleTime: 60_000,
  });

  const currentAllocation = allocData?.currentAllocation;
  const currentTenant = currentAllocation?.customerId;

  const selectedSizeDefinition = useMemo(
    () => LOCKER_SIZES.find((item) => item.code === size),
    [size]
  );

  // Financial calculations
  const numericRent = Math.max(0, Number(annualRent) || 0);
  const numericDeposit = Math.max(0, Number(securityDeposit) || 0);
  const monthlyEquivalent = Math.round(numericRent / 12);

  const tariffIsCustomized = Boolean(
    selectedSizeDefinition &&
      (numericRent !== selectedSizeDefinition.defaultRent ||
        numericDeposit !== selectedSizeDefinition.defaultDeposit)
  );

  // Calculate modified fields count
  const modifiedFieldsCount = useMemo(() => {
    if (!locker) return 0;
    let count = 0;
    if (lockerNumber.trim() !== (locker.lockerNumber || '')) count++;
    if (lockerCode.trim() !== (locker.lockerCode || '')) count++;
    if (size !== locker.size) count++;
    if (rackNumber.trim() !== (locker.rackNumber || '')) count++;
    if (section.trim() !== (locker.section || '')) count++;
    if (floor.trim() !== (locker.floor || 'Ground Floor')) count++;
    if (position.trim() !== (locker.position || '')) count++;
    if (masterKeyReference.trim() !== (locker.masterKeyReference || '')) count++;
    if (numericRent !== locker.annualRent) count++;
    if (numericDeposit !== locker.securityDeposit) count++;
    if (status !== locker.status) count++;
    if (operationalStatus !== locker.operationalStatus) count++;
    if (remarks.trim() !== (locker.remarks || '')) count++;
    return count;
  }, [
    locker,
    lockerNumber,
    lockerCode,
    size,
    rackNumber,
    section,
    floor,
    position,
    masterKeyReference,
    numericRent,
    numericDeposit,
    status,
    operationalStatus,
    remarks,
  ]);

  const isDirty = isEdit ? modifiedFieldsCount > 0 : Boolean(lockerNumber || rackNumber || lockerCode);

  // Populate data when in edit mode
  useEffect(() => {
    if (locker) {
      setLockerNumber(locker.lockerNumber);
      setLockerCode(locker.lockerCode || '');
      setSize(locker.size);
      setRackNumber(locker.rackNumber);
      setSection(locker.section || 'Main Vault');
      setFloor(locker.floor || 'Ground Floor');
      setPosition(locker.position || '');
      setMasterKeyReference(locker.masterKeyReference || '');
      setAnnualRent(locker.annualRent);
      setSecurityDeposit(locker.securityDeposit);
      setStatus(locker.status);
      setOperationalStatus(locker.operationalStatus);
      setRemarks(locker.remarks || '');
    } else {
      const defaultSize = LOCKER_SIZES[0];
      setSize(defaultSize.code);
      setAnnualRent(defaultSize.defaultRent);
      setSecurityDeposit(defaultSize.defaultDeposit);
      setSection('Main Vault');
      setFloor('Ground Floor');
    }
    // Ensure form starts scrolled to top
    window.setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }, 0);
  }, [locker]);

  // Keyboard navigation & shortcuts: Escape to cancel & Ctrl+Enter to save
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        if (isDirty) setConfirmDiscard(true);
        else onClose();
      } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !isSubmitting) {
        event.preventDefault();
        const form = document.getElementById('locker-form') as HTMLFormElement | null;
        if (form) form.requestSubmit();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isDirty, isSubmitting, onClose]);

  const requestClose = () => {
    if (isSubmitting) return;
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  };

  const clearFieldError = (name: string) => {
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handleSizeChange = (newSizeCode: string) => {
    setSize(newSizeCode);
    if (!isEdit) {
      const sizeDef = LOCKER_SIZES.find((s) => s.code === newSizeCode);
      if (sizeDef) {
        setAnnualRent(sizeDef.defaultRent);
        setSecurityDeposit(sizeDef.defaultDeposit);
      }
    }
  };

  const resetTariffs = () => {
    if (!selectedSizeDefinition) return;
    setAnnualRent(selectedSizeDefinition.defaultRent);
    setSecurityDeposit(selectedSizeDefinition.defaultDeposit);
    clearFieldError('annualRent');
    clearFieldError('securityDeposit');
  };

  const handleCopyKey = () => {
    if (!masterKeyReference) return;
    navigator.clipboard.writeText(masterKeyReference);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If edit mode and no changes made, smoothly close
    if (isEdit && !isDirty) {
      onClose();
      return;
    }

    const nextErrors: Record<string, string> = {};

    if (!lockerNumber.trim()) nextErrors.lockerNumber = 'Enter a unique physical locker number.';
    if (!rackNumber.trim()) nextErrors.rackNumber = 'Enter the vault rack identifier.';
    if (!Number.isFinite(numericRent) || numericRent < 0) {
      nextErrors.annualRent = 'Enter a valid annual rent (zero or positive).';
    }
    if (!Number.isFinite(numericDeposit) || numericDeposit < 0) {
      nextErrors.securityDeposit = 'Enter a valid security deposit (zero or positive).';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError(`Please complete ${Object.keys(nextErrors).length} required field${Object.keys(nextErrors).length > 1 ? 's' : ''}.`);
      window.setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    try {
      if (isEdit && locker) {
        await onSubmit({
          lockerNumber: lockerNumber.trim(),
          lockerCode: lockerCode.trim() || undefined,
          size,
          rackNumber: rackNumber.trim(),
          section: section.trim() || 'Main Vault',
          floor: floor.trim() || 'Ground Floor',
          position: position.trim() || undefined,
          masterKeyReference: canViewSensitive ? masterKeyReference.trim() : undefined,
          annualRent: numericRent,
          securityDeposit: numericDeposit,
          status,
          operationalStatus,
          remarks: remarks.trim(),
          expectedUpdatedAt: locker.updatedAt,
        });
      } else {
        await onSubmit({
          lockerNumber: lockerNumber.trim(),
          lockerCode: lockerCode.trim() || undefined,
          size,
          rackNumber: rackNumber.trim(),
          section: section.trim() || 'Main Vault',
          floor: floor.trim() || 'Ground Floor',
          position: position.trim() || undefined,
          masterKeyReference: masterKeyReference.trim() || undefined,
          annualRent: numericRent,
          securityDeposit: numericDeposit,
          status,
          operationalStatus,
          remarks: remarks.trim(),
        });
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'An error occurred while saving the locker record.'
      );
    }
  };

  const isPrimarySize = PRIMARY_SIZES.includes(size as any);

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4 animate-in fade-in-0 duration-150"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="locker-form-title"
        className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="border-b border-slate-100 bg-white p-4 sm:px-6 sm:py-4 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 flex items-center justify-center shadow-2xs">
                <KeyRound className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2
                    id="locker-form-title"
                    className="text-base font-semibold text-slate-900 tracking-tight"
                  >
                    {isEdit ? `Edit Locker #${locker?.lockerNumber}` : 'Add New Physical Locker'}
                  </h2>
                  {isEdit && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        locker?.status === 'OCCUPIED'
                          ? 'bg-sky-50 text-sky-800 border-sky-200'
                          : locker?.status === 'VACANT'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          locker?.status === 'OCCUPIED'
                            ? 'bg-sky-500'
                            : locker?.status === 'VACANT'
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span>{locker?.status === 'OCCUPIED' ? 'Occupied' : locker?.status || 'Vacant'}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isEdit
                    ? `Rack ${locker?.rackNumber || 'N/A'} • ${locker?.section || 'Main Vault'} • Size ${locker?.size}`
                    : 'Register a new safe-deposit box compartment into the vault registry'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active Tenant Context Bar (If locker is currently occupied) */}
          {isEdit && locker?.status === 'OCCUPIED' && currentTenant && (
            <div className="mt-3.5 flex items-center justify-between gap-3 p-2.5 px-3 rounded-xl bg-sky-50/70 border border-sky-100 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-sky-600 text-white font-semibold text-xs flex items-center justify-center shrink-0">
                  {currentTenant.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate">
                      {currentTenant.fullName}
                    </span>
                    <span className="text-[11px] font-mono text-sky-800 bg-sky-100/80 px-1.5 py-0.2 rounded">
                      {currentTenant.customerCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                    {currentTenant.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{currentTenant.phone}</span>
                      </span>
                    )}
                    {currentAllocation?.allocationCode && (
                      <span className="hidden sm:inline">
                        Lease #{currentAllocation.allocationCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-sky-800 bg-white border border-sky-200 px-2 py-0.5 rounded-md shadow-2xs">
                Active Tenant
              </span>
            </div>
          )}
        </div>

        {/* Modal Form Content */}
        <form
          id="locker-form"
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div ref={scrollContainerRef} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-xs"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Location & Dimensions Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-4.5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
                    <Building className="w-3.5 h-3.5 text-emerald-800" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-xs">
                      Location & Dimensions
                    </h3>
                  </div>
                </div>
                <span className="text-[10.5px] text-slate-400 font-medium">
                  <span className="text-rose-600 font-semibold">*</span> Required fields
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Locker Number */}
                <div className="space-y-1">
                  <label htmlFor="locker-number" className="font-medium text-slate-700 text-xs block">
                    Locker Number <span className="text-rose-600 font-semibold">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs select-none">
                      #
                    </span>
                    <Input
                      id="locker-number"
                      ref={lockerNumberRef}
                      type="text"
                      value={lockerNumber}
                      onChange={(e) => {
                        setLockerNumber(e.target.value);
                        clearFieldError('lockerNumber');
                      }}
                      placeholder="e.g. 101"
                      required
                      aria-invalid={Boolean(fieldErrors.lockerNumber)}
                      className={`h-9 pl-7 text-xs bg-white font-semibold text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 shadow-2xs ${
                        fieldErrors.lockerNumber
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.lockerNumber && (
                    <p className="text-[11px] font-medium text-rose-600">{fieldErrors.lockerNumber}</p>
                  )}
                </div>

                {/* Rack Number */}
                <div className="space-y-1">
                  <label htmlFor="rack-number" className="font-medium text-slate-700 text-xs block">
                    Rack Identifier <span className="text-rose-600 font-semibold">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs select-none">
                      <Layers className="w-3.5 h-3.5" />
                    </span>
                    <Input
                      id="rack-number"
                      type="text"
                      value={rackNumber}
                      onChange={(e) => {
                        setRackNumber(e.target.value);
                        clearFieldError('rackNumber');
                      }}
                      placeholder="e.g. Rack 493"
                      required
                      aria-invalid={Boolean(fieldErrors.rackNumber)}
                      className={`h-9 pl-8 text-xs bg-white font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 shadow-2xs ${
                        fieldErrors.rackNumber
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.rackNumber && (
                    <p className="text-[11px] font-medium text-rose-600">{fieldErrors.rackNumber}</p>
                  )}
                </div>

                {/* Size Classification with Quick Segmented Selector */}
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-slate-700 text-xs block">
                      Size Classification <span className="text-rose-600 font-semibold">*</span>
                    </label>
                    {selectedSizeDefinition && (
                      <span className="text-[11px] font-medium text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                        📐 {selectedSizeDefinition.dimensions}
                      </span>
                    )}
                  </div>

                  {/* Segmented Pill Selector for Primary Sizes + Dropdown for Custom/Extended */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleSizeChange('A')}
                      className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        size === 'A'
                          ? 'bg-white text-emerald-900 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      A • Small
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSizeChange('B')}
                      className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        size === 'B'
                          ? 'bg-white text-emerald-900 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      B • Med
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSizeChange('C')}
                      className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        size === 'C'
                          ? 'bg-white text-emerald-900 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      C • Large
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSizeChange('D')}
                      className={`h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        size === 'D'
                          ? 'bg-white text-emerald-900 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                    >
                      D • XL
                    </button>
                    <div className="col-span-4 sm:col-span-1 relative">
                      <select
                        value={isPrimarySize ? '' : size}
                        onChange={(e) => {
                          if (e.target.value) handleSizeChange(e.target.value);
                        }}
                        className={`w-full h-8 pl-2 pr-6 text-[11px] font-medium rounded-lg appearance-none cursor-pointer transition-all ${
                          !isPrimarySize
                            ? 'bg-white text-emerald-900 shadow-xs border border-slate-200'
                            : 'bg-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <option value="" disabled>
                          {isPrimarySize ? 'More sizes...' : `Size ${size}`}
                        </option>
                        {LOCKER_SIZES.filter((s) => !PRIMARY_SIZES.includes(s.code as any)).map((s) => (
                          <option key={s.code} value={s.code}>
                            {s.label} ({s.code})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Vault Section */}
                <div className="space-y-1">
                  <label htmlFor="vault-section" className="font-medium text-slate-700 text-xs block">
                    Vault Section <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="vault-section"
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. Main Vault Room"
                    className="h-9 text-xs bg-white border-slate-300 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 font-medium text-slate-900 shadow-2xs"
                  />
                </div>

                {/* Floor Level */}
                <div className="space-y-1">
                  <label htmlFor="floor-level" className="font-medium text-slate-700 text-xs block">
                    Floor Level <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="floor-level"
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. Ground Floor"
                    className="h-9 text-xs bg-white border-slate-300 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 font-medium text-slate-900 shadow-2xs"
                  />
                </div>

                {/* Grid Position */}
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="grid-position" className="font-medium text-slate-700 text-xs block">
                    Grid Position / Coordinates <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs select-none">
                      <MapPin className="w-3.5 h-3.5" />
                    </span>
                    <Input
                      id="grid-position"
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g. Unit 1 (Row 2, Column 3)"
                      className="h-9 pl-8 text-xs bg-white border-slate-300 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 font-medium text-slate-900 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Rental Tariff & Deposit Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-4.5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-800" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-xs">
                      Rental Tariff & Security Deposit
                    </h3>
                  </div>
                </div>
                {tariffIsCustomized ? (
                  <button
                    type="button"
                    onClick={resetTariffs}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset standard (₹{selectedSizeDefinition?.defaultRent} / ₹{selectedSizeDefinition?.defaultDeposit})</span>
                  </button>
                ) : (
                  <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Standard Size {size} Tariff
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Annual Rent */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="annual-rent" className="font-medium text-slate-700 text-xs block">
                      Annual Rent (₹) <span className="text-rose-600 font-semibold">*</span>
                    </label>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      ≈ ₹{monthlyEquivalent.toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold select-none">
                      ₹
                    </span>
                    <Input
                      id="annual-rent"
                      type="number"
                      min="0"
                      step="100"
                      value={annualRent}
                      onChange={(e) => {
                        setAnnualRent(e.target.value);
                        clearFieldError('annualRent');
                      }}
                      required
                      inputMode="decimal"
                      aria-invalid={Boolean(fieldErrors.annualRent)}
                      className={`h-9 pl-7 text-xs bg-white font-semibold text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 tabular-nums shadow-2xs ${
                        fieldErrors.annualRent
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.annualRent && (
                    <p className="text-[11px] font-medium text-rose-600">{fieldErrors.annualRent}</p>
                  )}
                </div>

                {/* Security Deposit */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="security-deposit" className="font-medium text-slate-700 text-xs block">
                      Security Deposit (₹) <span className="text-rose-600 font-semibold">*</span>
                    </label>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      Refundable Escrow
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold select-none">
                      ₹
                    </span>
                    <Input
                      id="security-deposit"
                      type="number"
                      min="0"
                      step="500"
                      value={securityDeposit}
                      onChange={(e) => {
                        setSecurityDeposit(e.target.value);
                        clearFieldError('securityDeposit');
                      }}
                      required
                      inputMode="decimal"
                      aria-invalid={Boolean(fieldErrors.securityDeposit)}
                      className={`h-9 pl-7 text-xs bg-white font-semibold text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 tabular-nums shadow-2xs ${
                        fieldErrors.securityDeposit
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.securityDeposit && (
                    <p className="text-[11px] font-medium text-rose-600">{fieldErrors.securityDeposit}</p>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Status & Operational Governance Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 sm:p-4.5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-xs">
                      Status & Access Governance
                    </h3>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Occupancy Status */}
                <div className="space-y-1">
                  <label htmlFor="occupancy-status" className="font-medium text-slate-700 text-xs block">
                    Occupancy Status
                  </label>
                  <div className="relative">
                    <select
                      id="occupancy-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as LockerStatus)}
                      className="w-full h-9 pl-3 pr-8 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 text-xs appearance-none cursor-pointer shadow-2xs"
                    >
                      <option value="VACANT">Vacant (Available for lease)</option>
                      <option value="OCCUPIED">Occupied (Leased to customer)</option>
                      <option value="RESERVED">Reserved (Pending allotment)</option>
                      <option value="BLOCKED">Blocked (Legal / Dispute hold)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                  {isEdit && locker?.status === 'OCCUPIED' && currentTenant && status !== 'OCCUPIED' && (
                    <p className="text-[10.5px] font-medium text-amber-700">
                      ⚠️ Active lease held by {currentTenant.fullName}. To officially vacate, please use the Allocation Surrender workflow.
                    </p>
                  )}
                </div>

                {/* Operational Health */}
                <div className="space-y-1">
                  <label htmlFor="operational-status" className="font-medium text-slate-700 text-xs block">
                    Operational Health
                  </label>
                  <div className="relative">
                    <select
                      id="operational-status"
                      value={operationalStatus}
                      onChange={(e) => setOperationalStatus(e.target.value as OperationalStatus)}
                      className="w-full h-9 pl-3 pr-8 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 text-xs appearance-none cursor-pointer shadow-2xs"
                    >
                      <option value="ACTIVE">● Active / Fully Functional</option>
                      <option value="MAINTENANCE">▲ Under Routine Maintenance</option>
                      <option value="DAMAGED">■ Damaged / Needs Locksmith</option>
                      <option value="DECOMMISSIONED">✕ Decommissioned / Inactive</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>

                {/* Master Key Reference */}
                {canViewSensitive && (
                  <div className="sm:col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="master-key-reference" className="font-medium text-slate-700 text-xs block">
                        Master Key Reference <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <span className="text-[10.5px] text-slate-400 font-normal">
                        Vault physical key index
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs select-none">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <Input
                        id="master-key-reference"
                        type={keyRevealed ? 'text' : 'password'}
                        value={masterKeyReference}
                        onChange={(e) => setMasterKeyReference(e.target.value)}
                        placeholder="e.g. MK-R493-01"
                        className="h-9 pl-8 text-xs bg-white border-slate-300 pr-16 text-slate-900 font-mono tracking-wider font-semibold rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 shadow-2xs"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setKeyRevealed(!keyRevealed)}
                          className="h-6.5 w-6.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                          title={keyRevealed ? 'Hide Master Key' : 'Reveal Master Key'}
                        >
                          {keyRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                        {masterKeyReference && (
                          <button
                            type="button"
                            onClick={handleCopyKey}
                            className="h-6.5 w-6.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center cursor-pointer transition-colors"
                            title="Copy to clipboard"
                          >
                            {copiedKey ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="sm:col-span-2 space-y-1">
                  <label htmlFor="locker-notes" className="font-medium text-slate-700 text-xs block">
                    Maintenance & Custody Notes <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="locker-notes"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Physical condition notes, lock replacement logs, or ledger remarks..."
                    rows={2}
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700/20 font-normal resize-none shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:px-6 sm:py-3.5 bg-white border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs">
              {isEdit ? (
                isDirty ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[11px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>{modifiedFieldsCount} field{modifiedFieldsCount > 1 ? 's' : ''} modified</span>
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px]">No changes detected</span>
                )
              ) : (
                <span className="text-slate-400 text-[11px]">Ctrl + Enter to save</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={requestClose}
                disabled={isSubmitting}
                className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9 px-4 cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-semibold shadow-xs rounded-xl text-xs h-9 px-4 cursor-pointer transition-all active:scale-[0.98]"
              >
                {isSubmitting
                  ? 'Saving changes...'
                  : isEdit
                  ? isDirty
                    ? 'Save Locker Changes'
                    : 'Done (No changes)'
                  : 'Create Physical Locker'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Discard Confirmation Dialog */}
      {confirmDiscard && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="discard-title"
          className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4 animate-in fade-in-0 duration-150"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-800 border border-amber-200">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div>
                <h3 id="discard-title" className="text-sm font-semibold text-slate-900">
                  Discard unsaved changes?
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 font-normal">
                  Your modifications will not be saved.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl font-medium text-xs cursor-pointer"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="rounded-xl font-medium text-xs cursor-pointer"
                onClick={onClose}
              >
                Discard changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

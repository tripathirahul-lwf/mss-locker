import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import React,{ useState,useEffect,useRef,useMemo } from 'react';
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
RotateCcw,Phone,
Layers,
MapPin,
Lock,
Loader2
} from 'lucide-react';
import { Locker,CreateLockerInput,UpdateLockerInput,LockerStatus,OperationalStatus } from '../types';
import { LOCKER_SIZES } from '../constants';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { usePermission } from '../../../hooks/usePermission';
import { lockerApi } from '../api/lockerApi';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';
import { allocationApi } from '../../allocations/api/allocationApi';

const PRIMARY_SIZES = ['A', 'B', 'C', 'D'] as const;

interface LockerFormModalProps {
  locker?: Locker | null;
  onClose: () => void;
  onSubmit: (data: CreateLockerInput | UpdateLockerInput) => Promise<void>;
  isSubmitting: boolean;
  embedded?: boolean;
  closeRequestRef?: React.MutableRefObject<(() => void) | null>;
}

export function LockerFormModal({
  locker: initialLocker,
  onClose,
  onSubmit,
  isSubmitting,
  embedded = false,
  closeRequestRef,
}: LockerFormModalProps) {
  const isEdit = Boolean(initialLocker);
  const { data: fullLocker, isFetching: loadingLocker, isError: failedLocker, refetch: retryLocker } = useQuery({
    queryKey: ['locker-edit', initialLocker?._id],
    queryFn: () => lockerApi.getLockerById(initialLocker!._id),
    enabled: Boolean(initialLocker?._id),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const locker = fullLocker || initialLocker;
  const canViewSensitive = usePermission('lockers.view_sensitive');
  const canViewAllocations = usePermission('allocations.view');

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

  const submittingRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const lockerNumberRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch active allocation if editing an existing locker
  const { data: allocData } = useQuery({
    queryKey: ['locker-allocations', locker?._id],
    queryFn: () => allocationApi.getLockerAllocations(locker!._id),
    enabled: Boolean(isEdit && locker?._id && canViewAllocations),
    staleTime: 60_000,
  });

  const currentAllocation = allocData?.currentAllocation;
  const currentTenant = currentAllocation?.customerId;

  const selectedSizeDefinition = useMemo(
    () => LOCKER_SIZES.find((item) => item.code === size),
    [size]
  );

  // Financial calculations
  const numericRent = Number(annualRent);
  const numericDeposit = Number(securityDeposit);
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
    if (floor.trim() !== (locker.floor ?? '')) count++;
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
      setSection(locker.section ?? '');
      setFloor(locker.floor ?? '');
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

  // Keyboard navigation & shortcuts: Escape to cancel & Ctrl+Enter / Ctrl+S to save
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[role="alertdialog"]')) return;
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        if (isDirty) setConfirmDiscard(true);
        else onClose();
      } else if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === 'Enter' || event.key === 's') &&
        !isSubmitting
      ) {
        event.preventDefault();
        const form = document.getElementById('locker-form') as HTMLFormElement | null;
        if (form) form.requestSubmit();
      }
    };

    const releaseScroll = lockBodyScroll();
    window.addEventListener('keydown', onKeyDown);
    return () => {
      releaseScroll();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isDirty, isSubmitting, onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || document.querySelector('[role="alertdialog"]')) return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') || []);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', trap);
    return () => { window.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); };
  }, []);

  useEffect(() => {
    if (isEdit && loadingLocker) return;
    const frame = requestAnimationFrame(() => lockerNumberRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isEdit, loadingLocker]);

  const requestClose = () => {
    if (isSubmitting || submittingRef.current) return;
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  };

  if (closeRequestRef) closeRequestRef.current = requestClose;

  const clearFieldError = (name: string) => {
    setFieldErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const formatRackTitle = (rack?: string) => {
    if (!rack) return 'Vault Matrix';
    const trimmed = rack.trim();
    return trimmed.toLowerCase().startsWith('rack') ? trimmed : `Rack ${trimmed}`;
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

  const applySizeDefaults = (sizeCode: string) => {
    const sizeDef = LOCKER_SIZES.find((s) => s.code === sizeCode);
    if (sizeDef) {
      setAnnualRent(sizeDef.defaultRent);
      setSecurityDeposit(sizeDef.defaultDeposit);
      clearFieldError('annualRent');
      clearFieldError('securityDeposit');
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
    navigator.clipboard.writeText(masterKeyReference).then(() => setCopiedKey(true)).catch(() => setError('Could not copy the key reference.'));
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // If edit mode and no changes made, smoothly close
    if (submittingRef.current || isSubmitting || loadingLocker && isEdit || failedLocker && isEdit || confirmDiscard || (isEdit && !isDirty)) return;

    const nextErrors: Record<string, string> = {};

    if (!lockerNumber.trim()) nextErrors.lockerNumber = 'Enter a unique physical locker number.';
    if (!rackNumber.trim()) nextErrors.rackNumber = 'Enter the vault rack identifier.';
    if (String(annualRent).trim() === '' || !Number.isFinite(numericRent) || numericRent < 0 || Math.abs(numericRent * 100 - Math.round(numericRent * 100)) > 0.000001) {
      nextErrors.annualRent = 'Enter a valid annual rent (zero or positive, up to 2 decimals).';
    }
    if (String(securityDeposit).trim() === '' || !Number.isFinite(numericDeposit) || numericDeposit < 0 || Math.abs(numericDeposit * 100 - Math.round(numericDeposit * 100)) > 0.000001) {
      nextErrors.securityDeposit = 'Enter a valid security deposit (zero or positive, up to 2 decimals).';
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError(`Please complete ${Object.keys(nextErrors).length} required field${Object.keys(nextErrors).length > 1 ? 's' : ''}.`);
      window.setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }

    submittingRef.current = true;
    try {
      if (isEdit && locker) {
        await onSubmit({
          lockerNumber: lockerNumber.trim(),
          lockerCode: lockerCode.trim() || undefined,
          size,
          rackNumber: rackNumber.trim(),
          section: section.trim(),
          floor: floor.trim(),
          position: position.trim(),
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
          section: section.trim(),
          floor: floor.trim(),
          position: position.trim(),
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
    } finally { submittingRef.current = false; }
  };

  const isPrimarySize = PRIMARY_SIZES.includes(size as any);

  if (isEdit && (loadingLocker || failedLocker)) {
    const loading = <div ref={dialogRef} role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true} aria-label="Load locker for editing" className="rounded-2xl bg-white p-6 space-y-4"><p role={failedLocker ? 'alert' : 'status'}>{failedLocker ? 'Could not load the full locker record.' : 'Loading locker details...'}</p>{failedLocker && <Button onClick={() => retryLocker()}>Retry</Button>}<Button onClick={onClose}>Cancel</Button></div>;
    return embedded ? loading : createPortal(<div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4">{loading}</div>, document.body);
  }

  const modalContent = (
    <div
      className={embedded ? "min-w-0" : "fixed inset-0 z-[110] flex h-[100dvh] w-screen items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6 animate-in fade-in-0 duration-150"}
      onMouseDown={(event) => {
        if (!embedded && event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        role={embedded ? undefined : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-labelledby={embedded ? undefined : "locker-form-title"}
        className={embedded ? "min-w-0 bg-white" : "flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl text-base text-slate-950"}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        {!embedded && <div className="bg-white px-5 pb-4 pt-6 sm:px-8 sm:pt-8 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="hidden">
                <KeyRound className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2
                    id="locker-form-title"
                    className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight"
                  >
                    {isEdit ? `Edit Locker #${locker?.lockerNumber}` : 'Add New Physical Locker'}
                  </h2>
                  {isEdit && (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-sm font-medium border ${
                        locker?.status === 'OCCUPIED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : locker?.status === 'VACANT'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          locker?.status === 'OCCUPIED'
                            ? 'bg-emerald-500'
                            : locker?.status === 'VACANT'
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <span>{locker?.status === 'OCCUPIED' ? 'Occupied' : locker?.status || 'Vacant'}</span>
                    </span>
                  )}
                </div>
                <p className="text-sm sm:text-base text-slate-600 mt-2">
                  {isEdit
                    ? `${formatRackTitle(locker?.rackNumber)} • ${locker?.section || 'Main Vault'} • Size ${locker?.size}`
                    : 'Register a new safe-deposit box compartment into the vault registry'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Active Tenant Context Bar (If locker is currently occupied) */}
          {isEdit && locker?.status === 'OCCUPIED' && currentTenant && (
            <div className="mt-3.5 flex items-center justify-between gap-3 p-2.5 px-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center shrink-0">
                  {currentTenant.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate">
                      {currentTenant.fullName}
                    </span>
                    <span className="text-sm font-mono text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded">
                      {currentTenant.customerCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
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
              <span className="shrink-0 text-sm font-medium text-emerald-800 bg-white border border-emerald-200 px-2 py-0.5 rounded-md shadow-2xs">
                Active Tenant
              </span>
            </div>
          )}
        </div>

        }
        <form
          id="locker-form"
          onSubmit={handleSubmit}
          noValidate
          className={embedded ? "min-w-0" : "flex min-h-0 flex-col flex-1 overflow-hidden"}
        >
          <fieldset disabled={isSubmitting} className="contents">
          <div ref={scrollContainerRef} className={embedded ? "space-y-4 text-sm" : "px-5 py-4 sm:px-8 space-y-5 overflow-y-auto min-h-0 flex-1 text-base overscroll-contain"}>
            {error && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 text-sm"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. Location & Dimensions Card */}
            <div className="rounded-2xl bg-slate-100 p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
                    <Building className="w-3.5 h-3.5 text-emerald-800" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">
                      Location & Dimensions
                    </h3>
                  </div>
                </div>
                <span className="text-[10.5px] text-slate-400 font-medium">
                  <span className="text-rose-600 font-semibold">*</span> Required fields
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Locker Number */}
                <div className="space-y-1">
                  <label htmlFor="locker-number" className="font-semibold text-slate-700 text-sm block">
                    Locker Number <span className="text-rose-600 font-semibold">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm select-none">
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
                      className={`h-12 pl-7 text-base bg-white font-semibold text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 shadow-2xs ${
                        fieldErrors.lockerNumber
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.lockerNumber && (
                    <p className="text-sm font-medium text-rose-600">{fieldErrors.lockerNumber}</p>
                  )}
                </div>

                {/* Rack Number */}
                <div className="space-y-1">
                  <label htmlFor="rack-number" className="font-semibold text-slate-700 text-sm block">
                    Rack Identifier <span className="text-rose-600 font-semibold">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">
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
                      className={`h-12 pl-8 text-base bg-white font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 shadow-2xs ${
                        fieldErrors.rackNumber
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.rackNumber && (
                    <p className="text-sm font-medium text-rose-600">{fieldErrors.rackNumber}</p>
                  )}
                </div>

                {/* Size Classification with Quick Segmented Selector */}
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-slate-700 text-sm block">
                      Size Classification <span className="text-rose-600 font-semibold">*</span>
                    </label>
                    {selectedSizeDefinition && (
                      <span className="text-sm font-medium text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                        📐 {selectedSizeDefinition.dimensions}
                      </span>
                    )}
                  </div>

                  {/* Segmented Pill Selector for Primary Sizes + Dropdown for Custom/Extended */}
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 p-1 bg-slate-200/60 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleSizeChange('A')}
                      className={`min-h-12 rounded-xl text-sm transition-all cursor-pointer ${
                        size === 'A'
                          ? 'bg-emerald-800 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                      }`}
                    >
                      A • Small
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSizeChange('B')}
                      className={`min-h-12 rounded-xl text-sm transition-all cursor-pointer ${
                        size === 'B'
                          ? 'bg-emerald-800 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                      }`}
                    >
                      B • Med
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSizeChange('C')}
                      className={`min-h-12 rounded-xl text-sm transition-all cursor-pointer ${
                        size === 'C'
                          ? 'bg-emerald-800 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                      }`}
                    >
                      C • Large
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSizeChange('D')}
                      className={`min-h-12 rounded-xl text-sm transition-all cursor-pointer ${
                        size === 'D'
                          ? 'bg-emerald-800 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
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
                        className={`w-full h-8 pl-2 pr-6 text-sm font-medium rounded-lg appearance-none cursor-pointer transition-all ${
                          !isPrimarySize
                            ? 'bg-emerald-800 text-white font-bold shadow-xs'
                            : 'bg-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <option value="" disabled>
                          {isPrimarySize ? 'More sizes...' : `Size ${size}`}
                        </option>
                        {LOCKER_SIZES.filter((s) => !PRIMARY_SIZES.includes(s.code as any)).map((s) => (
                          <option key={s.code} value={s.code} className="text-slate-900 bg-white font-medium">
                            {s.label} ({s.code})
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
                          !isPrimarySize ? 'text-white' : 'text-slate-400'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Standard Tariff Prompt if tariffs differ from size defaults */}
                  {isEdit && selectedSizeDefinition && (numericRent !== selectedSizeDefinition.defaultRent || numericDeposit !== selectedSizeDefinition.defaultDeposit) && (
                    <div className="flex items-center justify-between text-sm bg-slate-100/90 px-2.5 py-1.5 rounded-lg border border-slate-200">
                      <span className="text-slate-600">
                        Size {size} standard: <strong className="text-slate-800">₹{selectedSizeDefinition.defaultRent.toLocaleString('en-IN')}/yr</strong> &bull; Deposit <strong className="text-slate-800">₹{selectedSizeDefinition.defaultDeposit.toLocaleString('en-IN')}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => applySizeDefaults(size)}
                        className="text-[10.5px] font-semibold text-emerald-800 hover:text-emerald-950 bg-white border border-emerald-300 px-2 py-0.5 rounded shadow-2xs cursor-pointer hover:bg-emerald-50 transition"
                      >
                        Apply Standard Tariff
                      </button>
                    </div>
                  )}
                </div>

                {/* Vault Section */}
                <div className="space-y-1">
                  <label htmlFor="vault-section" className="font-semibold text-slate-700 text-sm block">
                    Vault Section <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="vault-section"
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. Main Vault Room"
                    className="h-12 text-base bg-white border-slate-300 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 font-medium text-slate-900 shadow-2xs"
                  />
                </div>

                {/* Floor Level */}
                <div className="space-y-1">
                  <label htmlFor="floor-level" className="font-semibold text-slate-700 text-sm block">
                    Floor Level <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="floor-level"
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. Ground Floor"
                    className="h-12 text-base bg-white border-slate-300 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 font-medium text-slate-900 shadow-2xs"
                  />
                </div>

                {/* Grid Position */}
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="grid-position" className="font-semibold text-slate-700 text-sm block">
                    Grid Position / Coordinates <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">
                      <MapPin className="w-3.5 h-3.5" />
                    </span>
                    <Input
                      id="grid-position"
                      type="text"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g. Unit 1 (Row 2, Column 3)"
                      className="h-12 pl-8 text-base bg-white border-slate-300 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 font-medium text-slate-900 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Rental Tariff & Deposit Card */}
            <div className="rounded-2xl bg-slate-100 p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-800" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">
                      Rental Tariff & Security Deposit
                    </h3>
                  </div>
                </div>
                {tariffIsCustomized ? (
                  <button
                    type="button"
                    onClick={resetTariffs}
                    className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset standard (₹{selectedSizeDefinition?.defaultRent} / ₹{selectedSizeDefinition?.defaultDeposit})</span>
                  </button>
                ) : (
                  <span className="text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Standard Size {size} Tariff
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Annual Rent */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="annual-rent" className="font-semibold text-slate-700 text-sm block">
                      Annual Rent (₹) <span className="text-rose-600 font-semibold">*</span>
                    </label>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      ≈ ₹{monthlyEquivalent.toLocaleString('en-IN')}/mo
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold select-none">
                      ₹
                    </span>
                    <Input
                      id="annual-rent"
                      type="number"
                      min="0"
                      step="0.01"
                      value={annualRent}
                      onChange={(e) => {
                        setAnnualRent(e.target.value);
                        clearFieldError('annualRent');
                      }}
                      required
                      inputMode="decimal"
                      aria-invalid={Boolean(fieldErrors.annualRent)}
                      className={`h-12 pl-7 text-base bg-white font-semibold text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 tabular-nums shadow-2xs ${
                        fieldErrors.annualRent
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.annualRent && (
                    <p className="text-sm font-medium text-rose-600">{fieldErrors.annualRent}</p>
                  )}
                </div>

                {/* Security Deposit */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="security-deposit" className="font-semibold text-slate-700 text-sm block">
                      Security Deposit (₹) <span className="text-rose-600 font-semibold">*</span>
                    </label>
                    <span className="text-[10.5px] text-slate-500 font-medium">
                      Refundable Escrow
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold select-none">
                      ₹
                    </span>
                    <Input
                      id="security-deposit"
                      type="number"
                      min="0"
                      step="0.01"
                      value={securityDeposit}
                      onChange={(e) => {
                        setSecurityDeposit(e.target.value);
                        clearFieldError('securityDeposit');
                      }}
                      required
                      inputMode="decimal"
                      aria-invalid={Boolean(fieldErrors.securityDeposit)}
                      className={`h-12 pl-7 text-base bg-white font-semibold text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 tabular-nums shadow-2xs ${
                        fieldErrors.securityDeposit
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.securityDeposit && (
                    <p className="text-sm font-medium text-rose-600">{fieldErrors.securityDeposit}</p>
                  )}
                </div>

                {/* Move-in Commercial Total Bar */}
                <div className="sm:col-span-2 p-2.5 rounded-xl bg-white border border-slate-200/90 flex items-center justify-between shadow-2xs">
                  <span className="text-sm text-slate-500 font-medium">
                    Annual Rent + Required Deposit (catalogue):
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    ₹{(numericRent + numericDeposit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Status & Operational Governance Card */}
            <div className="rounded-2xl bg-slate-100 p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-800" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">
                      Status & Access Governance
                    </h3>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Occupancy Status */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label htmlFor="occupancy-status" className="font-semibold text-slate-700 text-sm block">
                      Occupancy Status
                    </label>
                    {isEdit && locker?.status === 'OCCUPIED' && (
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        🔒 Leased to Client
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      id="occupancy-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as LockerStatus)}
                      disabled={isEdit && ['OCCUPIED', 'RESERVED'].includes(locker?.status || '')}
                      className={`w-full h-12 pl-3 pr-8 rounded-xl font-medium text-sm appearance-none shadow-2xs ${
                        isEdit && locker?.status === 'OCCUPIED'
                          ? 'bg-slate-100/90 border border-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 cursor-pointer'
                      }`}
                    >
                      <option value="VACANT">Vacant (Available for lease)</option>
                      <option value="OCCUPIED" disabled={status !== 'OCCUPIED'}>Occupied (Leased to customer)</option>
                      <option value="RESERVED" disabled={status !== 'RESERVED'}>Reserved (Pending allotment)</option>
                      <option value="BLOCKED">Blocked (Legal / Dispute hold)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                  {isEdit && locker?.status === 'OCCUPIED' && currentTenant && (
                    <p className="text-[10.5px] font-normal text-slate-500 mt-1">
                      Active lease held by <span className="font-semibold text-slate-800">{currentTenant.fullName}</span>. To vacate this locker, use the Close Locker action.
                    </p>
                  )}
                </div>

                {/* Operational Health */}
                <div className="space-y-1">
                  <label htmlFor="operational-status" className="font-semibold text-slate-700 text-sm block">
                    Operational Health
                  </label>
                  <div className="relative">
                    <select
                      id="operational-status"
                      value={operationalStatus}
                      onChange={(e) => setOperationalStatus(e.target.value as OperationalStatus)}
                      className="w-full h-12 pl-3 pr-8 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 text-sm appearance-none cursor-pointer shadow-2xs"
                    >
                      <option value="ACTIVE">● Active (Operational)</option>
                      <option value="MAINTENANCE">▲ Maintenance / Servicing</option>
                      <option value="DAMAGED">■ Damaged (Key/Lock Issue)</option>
                      <option value="DECOMMISSIONED">✕ Decommissioned (Inactive)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>

                {/* Master Key Reference */}
                {canViewSensitive && (
                  <div className="sm:col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <label htmlFor="master-key-reference" className="font-semibold text-slate-700 text-sm block">
                        Master Key Reference <span className="font-normal text-slate-400">(optional)</span>
                      </label>
                      <span className="text-[10.5px] text-slate-400 font-normal">
                        Vault physical key index
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <Input
                        id="master-key-reference"
                        type={keyRevealed ? 'text' : 'password'}
                        value={masterKeyReference}
                        onChange={(e) => setMasterKeyReference(e.target.value)}
                        placeholder="e.g. MK-R493-01"
                        className="h-12 pl-8 text-base bg-white border-slate-300 pr-16 text-slate-900 font-mono tracking-wider font-semibold rounded-xl focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700/20 shadow-2xs"
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
                  <label htmlFor="locker-notes" className="font-semibold text-slate-700 text-sm block">
                    Maintenance & Custody Notes <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="locker-notes"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Physical condition notes, lock replacement logs, or ledger remarks..."
                    rows={2}
                    className="w-full p-2.5 text-base bg-white border border-slate-300 rounded-xl focus:border-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-700/20 font-normal resize-none shadow-2xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-5 py-5 sm:px-8 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-sm">
              {isEdit ? (
                isDirty ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>{modifiedFieldsCount} field{modifiedFieldsCount > 1 ? 's' : ''} modified</span>
                  </span>
                ) : (
                  <span className="text-slate-400 text-sm">No changes detected</span>
                )
              ) : (
                <span className="text-slate-400 text-sm">Ctrl + Enter or Ctrl + S to save</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={requestClose}
                disabled={isSubmitting}
                className="rounded-2xl border-slate-300 text-slate-700 font-bold text-base min-h-12 px-6 cursor-pointer hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || (isEdit && !isDirty)}
                className={`font-bold shadow-xs rounded-2xl text-base min-h-12 px-6 transition-all active:scale-[0.98] flex items-center gap-1.5 ${
                  isEdit && !isDirty
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-200'
                    : 'bg-emerald-800 hover:bg-emerald-900 text-white cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving changes...</span>
                  </>
                ) : isEdit ? (
                  'Save Locker Changes'
                ) : (
                  'Create Physical Locker'
                )}
              </Button>
            </div>
          </div>
          </fieldset>
        </form>
      </div>

      <ConfirmationModal isOpen={confirmDiscard} title="Discard unsaved changes?" description="Your modifications will not be saved." confirmText="Discard changes" cancelText="Keep editing" variant="warning" onClose={() => setConfirmDiscard(false)} onConfirm={onClose} isLoading={isSubmitting} />
    </div>
  );

  return embedded ? modalContent : createPortal(modalContent, document.body);
}

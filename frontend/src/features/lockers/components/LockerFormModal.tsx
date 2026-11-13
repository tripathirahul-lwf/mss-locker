import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import React,{ useState,useEffect,useRef,useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X,AlertCircle,ChevronDown,Eye,EyeOff,Copy,Check,RotateCcw,Loader2 } from 'lucide-react';
import { Locker,CreateLockerInput,UpdateLockerInput,LockerStatus,OperationalStatus } from '../types';
import { LOCKER_SIZES } from '../constants';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { usePermission } from '../../../hooks/usePermission';
import { lockerApi } from '../api/lockerApi';
import { ConfirmationModal } from '../../../components/common/ConfirmationModal';
import { allocationApi } from '../../allocations/api/allocationApi';
import { money } from './OccupiedLockerSummary';

const PRIMARY_SIZES = ['A', 'B', 'C', 'D'] as const;
const SIZE_SHORT_LABELS: Record<string, string> = { A: 'Small', B: 'Medium', C: 'Large', D: 'XL' };

// Visual tokens shared with the locker detail view (OccupiedLockerSummary cards)
// so editing looks like the same screen, not a different product.
const GRID = 'grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3 sm:gap-4';
const CARD = 'min-w-0 rounded-2xl bg-slate-100 p-4 sm:p-5';
const FULL_ROW = 'min-[480px]:col-span-2 md:col-span-3';
const LAST_IN_ROW = 'min-[480px]:col-span-2 md:col-span-1';
const LABEL = 'block text-sm text-slate-600';
const OPTIONAL = 'text-slate-400';
const NOTE = 'mt-1 text-xs text-slate-600';
const ERROR_TEXT = 'mt-1 text-xs font-medium text-rose-700';
const CONTROL_BASE = 'h-12 min-h-12 w-full rounded-xl border-slate-300 bg-white px-3 text-base font-semibold text-slate-950 placeholder:font-normal placeholder:text-slate-400 focus-visible:border-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 disabled:opacity-100';
const CONTROL = `mt-2 ${CONTROL_BASE}`;
const CONTROL_ERROR = 'border-rose-400 focus-visible:border-rose-500 focus-visible:ring-rose-500/20';
const SELECT = 'cursor-pointer appearance-none border pl-3 pr-9';

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
      // Embedded inside the locker dialog, keep the host header (Edit / Close) in the tab cycle.
      const container = (embedded ? dialogRef.current?.closest<HTMLElement>('[role="dialog"]') : null) || dialogRef.current;
      const controls = Array.from(container?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)') || []).filter(control => control.getClientRects().length > 0);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !container?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !container?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', trap);
    return () => { window.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); };
  }, [embedded]);

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

  const resetTariffs = () => {
    if (!selectedSizeDefinition) return;
    setAnnualRent(selectedSizeDefinition.defaultRent);
    setSecurityDeposit(selectedSizeDefinition.defaultDeposit);
    clearFieldError('annualRent');
    clearFieldError('securityDeposit');
  };

  const handleCopyKey = () => {
    if (!masterKeyReference) return;
    navigator.clipboard.writeText(masterKeyReference).then(() => {
      setCopiedKey(true);
      window.setTimeout(() => setCopiedKey(false), 2000);
    }).catch(() => setError('Could not copy the key reference.'));
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

  const readCard = (label: string, value: React.ReactNode, note?: React.ReactNode, extra = '') => (
    <div className={`${CARD} ${extra}`}>
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="mt-1 break-words text-base font-semibold leading-relaxed text-slate-950">{value}</dd>
      {note && <dd className={NOTE}>{note}</dd>}
    </div>
  );

  const tenantCards = isEdit && locker?.status === 'OCCUPIED' && currentTenant ? (
    <dl className={GRID} aria-label="Current tenant">
      {readCard('Customer', currentTenant.fullName, currentTenant.customerCode)}
      {readCard('Phone', currentTenant.phone || 'Not recorded')}
      {readCard('Lease', currentAllocation?.allocationCode || 'Not recorded', 'Active tenant', LAST_IN_ROW)}
    </dl>
  ) : null;

  const sectionHeader = (id: string, title: string, aside?: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
      <h3 id={id} className="text-base font-semibold text-emerald-800">{title}</h3>
      {aside}
    </div>
  );

  if (isEdit && (loadingLocker || failedLocker)) {
    const actions = (
      <div className="flex flex-wrap gap-2">
        {failedLocker && <Button onClick={() => retryLocker()} className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-800">Retry</Button>}
        <Button variant="outline" onClick={onClose} className="rounded-xl border-slate-300">Cancel</Button>
      </div>
    );
    if (embedded) {
      return (
        <div ref={dialogRef} role="region" aria-label="Load locker for editing" className="flex min-h-0 flex-1 flex-col items-start gap-4 px-5 py-6 sm:px-8">
          <p role={failedLocker ? 'alert' : 'status'} className={`flex items-center gap-2 text-sm ${failedLocker ? 'text-rose-800' : 'text-slate-600'}`}>
            {failedLocker ? <AlertCircle className="h-4 w-4 text-rose-600" /> : <Loader2 className="h-4 w-4 animate-spin text-emerald-700" />}
            {failedLocker ? 'Could not load the full locker record.' : 'Loading locker details...'}
          </p>
          {actions}
        </div>
      );
    }
    const loading = <div ref={dialogRef} role="dialog" aria-modal aria-label="Load locker for editing" className="rounded-2xl bg-white p-6 space-y-4"><p role={failedLocker ? 'alert' : 'status'}>{failedLocker ? 'Could not load the full locker record.' : 'Loading locker details...'}</p>{actions}</div>;
    return createPortal(<div className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/60 p-4">{loading}</div>, document.body);
  }

  const modalContent = (
    <div
      className={embedded ? "flex min-h-0 min-w-0 flex-1 flex-col" : "fixed inset-0 z-[110] flex h-[100dvh] w-screen items-center justify-center bg-slate-950/70 p-3 backdrop-blur-xs sm:p-5 animate-in fade-in-0 duration-150"}
      onMouseDown={(event) => {
        if (!embedded && event.target === event.currentTarget) requestClose();
      }}
    >
      <div
        ref={dialogRef}
        role={embedded ? "region" : "dialog"}
        aria-modal={embedded ? undefined : true}
        aria-label={embedded ? `Edit Locker #${locker?.lockerNumber ?? ''}` : undefined}
        aria-labelledby={embedded ? undefined : "locker-form-title"}
        className={embedded ? "flex min-h-0 min-w-0 flex-1 flex-col bg-white text-base text-slate-950" : "flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-2xl text-base text-slate-950"}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        {!embedded && <div className="bg-white px-4 pb-5 pt-5 sm:px-8 sm:pt-7 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
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
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold border ${
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
                    ? `Size ${locker?.size} \u2022 ${formatRackTitle(locker?.rackNumber)}`
                    : 'Register a new safe-deposit box compartment into the vault registry'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        }
        <form
          id="locker-form"
          onSubmit={handleSubmit}
          noValidate
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        >
          <fieldset disabled={isSubmitting} className="contents">
          <div ref={scrollContainerRef} className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4 pb-7 pt-1 text-base sm:space-y-7 sm:px-8">
            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Tenant context: same read-only cards as the locker detail view */}
            {tenantCards}

            {/* 1. Location & size */}
            <section className="space-y-4" aria-labelledby="locker-form-location">
              {sectionHeader('locker-form-location', 'Location & size', (
                <span className="text-xs text-slate-500">
                  <span className="font-semibold text-rose-600">*</span> Required
                </span>
              ))}

              <div className={GRID}>
                <div className={CARD}>
                  <label htmlFor="locker-number" className={LABEL}>
                    Locker number <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex select-none items-center text-base font-semibold text-slate-400">#</span>
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
                      className={`${CONTROL_BASE} pl-7 ${fieldErrors.lockerNumber ? CONTROL_ERROR : ''}`}
                    />
                  </div>
                  {fieldErrors.lockerNumber && <p className={ERROR_TEXT}>{fieldErrors.lockerNumber}</p>}
                </div>

                <div className={CARD}>
                  <label htmlFor="rack-number" className={LABEL}>
                    Rack <span className="text-rose-600">*</span>
                  </label>
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
                    className={`${CONTROL} ${fieldErrors.rackNumber ? CONTROL_ERROR : ''}`}
                  />
                  {fieldErrors.rackNumber && <p className={ERROR_TEXT}>{fieldErrors.rackNumber}</p>}
                </div>

                <div className={CARD}>
                  <label htmlFor="grid-position" className={LABEL}>
                    Position <span className={OPTIONAL}>(optional)</span>
                  </label>
                  <Input
                    id="grid-position"
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Unit 1 (Row 2, Col 3)"
                    className={CONTROL}
                  />
                </div>

                <div className={CARD}>
                  <label htmlFor="vault-section" className={LABEL}>
                    Vault section <span className={OPTIONAL}>(optional)</span>
                  </label>
                  <Input
                    id="vault-section"
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. Main Vault Room"
                    className={CONTROL}
                  />
                </div>

                <div className={CARD}>
                  <label htmlFor="floor-level" className={LABEL}>
                    Floor <span className={OPTIONAL}>(optional)</span>
                  </label>
                  <Input
                    id="floor-level"
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. Ground Floor"
                    className={CONTROL}
                  />
                </div>

                <div className={`${CARD} ${FULL_ROW}`} role="group" aria-labelledby="locker-size-label">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span id="locker-size-label" className={LABEL}>
                      Size <span className="text-rose-600">*</span>
                    </span>
                    {selectedSizeDefinition && (
                      <span className="text-xs text-slate-600">{selectedSizeDefinition.dimensions}</span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {PRIMARY_SIZES.map((code) => {
                      const definition = LOCKER_SIZES.find((item) => item.code === code);
                      const selected = size === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => handleSizeChange(code)}
                          className={`min-h-12 rounded-xl border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 ${
                            selected
                              ? 'border-emerald-700 bg-emerald-700 text-white'
                              : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-700 hover:text-emerald-800'
                          }`}
                        >
                          {code} &bull; {SIZE_SHORT_LABELS[code] || definition?.label || code}
                        </button>
                      );
                    })}
                    <div className="relative col-span-2 sm:col-span-1">
                      <select
                        aria-label="More sizes"
                        value={isPrimarySize ? '' : size}
                        onChange={(e) => {
                          if (e.target.value) handleSizeChange(e.target.value);
                        }}
                        className={`h-12 w-full appearance-none rounded-xl border pl-3 pr-9 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 ${
                          !isPrimarySize
                            ? 'border-emerald-700 bg-emerald-700 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-emerald-700'
                        }`}
                      >
                        <option value="" disabled>
                          {isPrimarySize ? 'More sizes' : `Size ${size}`}
                        </option>
                        {LOCKER_SIZES.filter((s) => !PRIMARY_SIZES.includes(s.code as any)).map((s) => (
                          <option key={s.code} value={s.code} className="bg-white font-medium text-slate-900">
                            {s.label} ({s.code})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${!isPrimarySize ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Rent & deposit */}
            <section className="space-y-4" aria-labelledby="locker-form-tariff">
              {sectionHeader('locker-form-tariff', 'Rent & deposit', tariffIsCustomized && selectedSizeDefinition ? (
                <button
                  type="button"
                  onClick={resetTariffs}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  Use size {size} standard ({money(selectedSizeDefinition.defaultRent)} / {money(selectedSizeDefinition.defaultDeposit)})
                </button>
              ) : (
                <span className="text-xs text-slate-500">Size {size} standard tariff</span>
              ))}

              <div className={GRID}>
                <div className={CARD}>
                  <label htmlFor="annual-rent" className={LABEL}>
                    Annual rent incl. GST <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex select-none items-center text-base font-semibold text-slate-400">₹</span>
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
                      className={`${CONTROL_BASE} pl-7 tabular-nums ${fieldErrors.annualRent ? CONTROL_ERROR : ''}`}
                    />
                  </div>
                  {fieldErrors.annualRent ? (
                    <p className={ERROR_TEXT}>{fieldErrors.annualRent}</p>
                  ) : (
                    <p className={NOTE}>
                      {Number.isFinite(numericRent) && numericRent >= 0
                        ? `Before GST: ${money(Math.round(numericRent / 1.18 * 100) / 100)} · ≈ ${money(monthlyEquivalent)}/month`
                        : 'Enter the yearly rent'}
                    </p>
                  )}
                </div>

                <div className={CARD}>
                  <label htmlFor="security-deposit" className={LABEL}>
                    Security deposit <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative mt-2">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex select-none items-center text-base font-semibold text-slate-400">₹</span>
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
                      className={`${CONTROL_BASE} pl-7 tabular-nums ${fieldErrors.securityDeposit ? CONTROL_ERROR : ''}`}
                    />
                  </div>
                  {fieldErrors.securityDeposit ? (
                    <p className={ERROR_TEXT}>{fieldErrors.securityDeposit}</p>
                  ) : (
                    <p className={NOTE}>Refundable on closure</p>
                  )}
                </div>

                <div className={`${CARD} ${LAST_IN_ROW}`}>
                  <p className={LABEL}>Rent + deposit (catalogue)</p>
                  <p className="mt-1 break-words text-base font-semibold leading-relaxed tabular-nums text-slate-950">
                    {Number.isFinite(numericRent + numericDeposit) ? money(numericRent + numericDeposit) : 'Not recorded'}
                  </p>
                  <p className={NOTE}>Amount due at a new allotment</p>
                </div>
              </div>
            </section>

            {/* 3. Status & access */}
            <section className="space-y-4" aria-labelledby="locker-form-status">
              {sectionHeader('locker-form-status', 'Status & access')}

              <div className={GRID}>
                <div className={CARD}>
                  <label htmlFor="occupancy-status" className={LABEL}>Occupancy</label>
                  <div className="relative mt-2">
                    <select
                      id="occupancy-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as LockerStatus)}
                      disabled={isEdit && ['OCCUPIED', 'RESERVED'].includes(locker?.status || '')}
                      className={`${CONTROL_BASE} ${SELECT}`}
                    >
                      <option value="VACANT">Vacant</option>
                      <option value="OCCUPIED" disabled={status !== 'OCCUPIED'}>Occupied</option>
                      <option value="RESERVED" disabled={status !== 'RESERVED'}>Reserved</option>
                      <option value="BLOCKED">Blocked (legal / dispute hold)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                  {isEdit && locker?.status === 'OCCUPIED' && (
                    <p className={NOTE}>
                      {currentTenant ? `Leased to ${currentTenant.fullName}. ` : ''}Use Close locker to vacate.
                    </p>
                  )}
                </div>

                <div className={CARD}>
                  <label htmlFor="operational-status" className={LABEL}>Condition</label>
                  <div className="relative mt-2">
                    <select
                      id="operational-status"
                      value={operationalStatus}
                      onChange={(e) => setOperationalStatus(e.target.value as OperationalStatus)}
                      className={`${CONTROL_BASE} ${SELECT}`}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="MAINTENANCE">Under maintenance</option>
                      <option value="DAMAGED">Damaged (key / lock issue)</option>
                      <option value="DECOMMISSIONED">Decommissioned</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {canViewSensitive && (
                  <div className={`${CARD} ${LAST_IN_ROW}`}>
                    <label htmlFor="master-key-reference" className={LABEL}>
                      Key number <span className={OPTIONAL}>(optional)</span>
                    </label>
                    <div className="relative mt-2">
                      <Input
                        id="master-key-reference"
                        type={keyRevealed ? 'text' : 'password'}
                        value={masterKeyReference}
                        onChange={(e) => setMasterKeyReference(e.target.value)}
                        placeholder="e.g. 12345"
                        autoComplete="off"
                        className={`${CONTROL_BASE} pr-20 font-mono tracking-wider`}
                      />
                      <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setKeyRevealed(!keyRevealed)}
                          className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          aria-label={keyRevealed ? 'Hide key number' : 'Show key number'}
                        >
                          {keyRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        {masterKeyReference && (
                          <button
                            type="button"
                            onClick={handleCopyKey}
                            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            aria-label="Copy key number"
                          >
                            {copiedKey ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className={`${CARD} ${FULL_ROW}`}>
                  <label htmlFor="locker-notes" className={LABEL}>
                    Notes <span className={OPTIONAL}>(optional)</span>
                  </label>
                  <textarea
                    id="locker-notes"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Condition, lock replacement or other remarks"
                    rows={3}
                    className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950 placeholder:text-slate-400 focus-visible:border-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/20"
                  />
                </div>
              </div>
            </section>
          </div>

          {/* Modal Footer */}
          <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-3.5 sm:px-6 sm:py-4 bg-slate-50/90 border-t border-slate-200/80">
            <div className="text-sm">
              {isEdit ? (
                isDirty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>{modifiedFieldsCount} field{modifiedFieldsCount > 1 ? 's' : ''} modified</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">No changes yet</span>
                )
              ) : (
                <span className="text-xs text-slate-500">Ctrl + S to save</span>
              )}
            </div>

            <div className="ml-auto flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={requestClose}
                disabled={isSubmitting}
                className="rounded-xl border-slate-300 text-slate-700 font-semibold text-xs h-9 px-4 cursor-pointer hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || (isEdit && !isDirty)}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-9 px-4 shadow-xs gap-1.5 cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100 disabled:shadow-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
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

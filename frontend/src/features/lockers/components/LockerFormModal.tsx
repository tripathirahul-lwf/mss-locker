import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, KeyRound, AlertCircle, ShieldAlert, Building, ChevronDown } from 'lucide-react';
import { Locker, CreateLockerInput, UpdateLockerInput, LockerStatus, OperationalStatus } from '../types';
import { LOCKER_SIZES } from '../constants';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { usePermission } from '../../../hooks/usePermission';

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
  const [annualRent, setAnnualRent] = useState<number>(3000);
  const [securityDeposit, setSecurityDeposit] = useState<number>(10000);
  const [status, setStatus] = useState<LockerStatus>('VACANT');
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus>('ACTIVE');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [advancedOpen, setAdvancedOpen] = useState(isEdit);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const lockerNumberRef = useRef<HTMLInputElement>(null);
  const selectedSizeDefinition = LOCKER_SIZES.find((item) => item.code === size);
  const tariffIsCustomized = Boolean(selectedSizeDefinition && (annualRent !== selectedSizeDefinition.defaultRent || securityDeposit !== selectedSizeDefinition.defaultDeposit));
  const statusChanged = Boolean(locker && (status !== locker.status || operationalStatus !== locker.operationalStatus));

  // Populate data when in edit mode
  useEffect(() => {
    if (locker) {
      setLockerNumber(locker.lockerNumber);
      setLockerCode(locker.lockerCode || '');
      setSize(locker.size);
      setRackNumber(locker.rackNumber);
      setSection(locker.section || '');
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
      setAnnualRent(defaultSize.defaultRent);
      setSecurityDeposit(defaultSize.defaultDeposit);
    }
  }, [locker]);

  useEffect(() => {
    lockerNumberRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        event.preventDefault();
        if (isDirty) setConfirmDiscard(true);
        else onClose();
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
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nextErrors: Record<string, string> = {};
    if (!lockerNumber.trim()) nextErrors.lockerNumber = 'Enter a unique locker number.';
    if (!rackNumber.trim()) nextErrors.rackNumber = 'Enter the physical rack identifier.';
    if (!Number.isFinite(annualRent) || annualRent < 0) nextErrors.annualRent = 'Enter a valid annual rent of zero or more.';
    if (!Number.isFinite(securityDeposit) || securityDeposit < 0) nextErrors.securityDeposit = 'Enter a valid security deposit of zero or more.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError(`Please correct ${Object.keys(nextErrors).length} highlighted field${Object.keys(nextErrors).length > 1 ? 's' : ''}.`);
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
          section: section.trim(),
          floor: floor.trim(),
          position: position.trim(),
          masterKeyReference: canViewSensitive ? masterKeyReference.trim() : undefined,
          annualRent: Number(annualRent),
          securityDeposit: Number(securityDeposit),
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
          annualRent: Number(annualRent),
          securityDeposit: Number(securityDeposit),
          status,
          operationalStatus,
          remarks: remarks.trim(),
        });
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'An error occurred while saving locker.'
      );
      setAdvancedOpen(true);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex h-[100dvh] w-screen items-end justify-center bg-slate-950/55 p-0 backdrop-blur-[3px] sm:items-center sm:p-4 animate-in fade-in-0 duration-150" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="locker-form-title" aria-describedby="locker-form-description"
        className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl sm:border sm:border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:px-6 sm:py-5 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 id="locker-form-title" className="text-lg font-black text-slate-950 tracking-tight sm:text-xl">
                {isEdit ? `Edit Physical Locker #${locker?.lockerNumber}` : 'Add New Physical Locker'}
              </h2>
              <p id="locker-form-description" className="text-xs text-slate-500 font-medium mt-0.5">
                {isEdit
                  ? 'Update physical drawer coordinates, size, and tariffs'
                  : 'Register a physical unit into the master safe-deposit inventory'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close locker form"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} onChange={() => setIsDirty(true)} noValidate className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-relaxed text-slate-500">
              <p>{isEdit ? <><strong className="text-slate-700">Editing existing record:</strong> review identity, location and financial values before saving.</> : <>Enter the locker identity, location and financial values. Advanced fields can be added later.</>}</p>
              <p className="shrink-0"><span className="font-bold text-red-600" aria-hidden="true">*</span> Required fields</p>
            </div>
            {error && (
              <div role="alert" tabIndex={-1} className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed">{error}</span>
              </div>
            )}

            {/* Section 1: Physical Identification */}
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                <span>Physical Identification & Rack Coordinates</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Locker Number */}
                <div className="space-y-1">
                  <label htmlFor="locker-number" className="font-bold text-slate-700">
                    Locker Number <span className="ml-0.5 font-bold text-red-600" aria-hidden="true">*</span><span className="sr-only"> (required)</span>
                  </label>
                  <Input
                    id="locker-number"
                    ref={lockerNumberRef}
                    type="text"
                    value={lockerNumber}
                    onChange={(e) => { setLockerNumber(e.target.value); clearFieldError('lockerNumber'); }}
                    placeholder="e.g. 101 or A-101"
                    required
                    aria-invalid={Boolean(fieldErrors.lockerNumber)}
                    aria-describedby={fieldErrors.lockerNumber ? 'locker-number-error' : undefined}
                    className={`h-11 text-xs bg-white font-bold text-slate-900 rounded-xl ${fieldErrors.lockerNumber ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                  />
                  {fieldErrors.lockerNumber && <p id="locker-number-error" className="text-[11px] font-semibold text-red-600">{fieldErrors.lockerNumber}</p>}
                </div>

                <div className="space-y-1">
                  <label htmlFor="locker-code" className="font-bold text-slate-700">Locker Code <span className="font-normal text-slate-400">(optional)</span></label>
                  <Input id="locker-code" type="text" value={lockerCode} onChange={(e) => setLockerCode(e.target.value)} placeholder="Auto-generated if left blank" className="h-11 rounded-xl border-slate-300 bg-white font-mono text-xs font-bold uppercase text-slate-900" />
                  <p className="text-[10px] text-slate-500">Stable registry code used in imports and reports.</p>
                </div>

                {/* Locker Size */}
                <div className="space-y-1">
                  <label htmlFor="locker-size" className="font-bold text-slate-700">
                    Size Classification <span className="ml-0.5 font-bold text-red-600" aria-hidden="true">*</span><span className="sr-only"> (required)</span>
                  </label>
                  <select
                    id="locker-size"
                    value={size}
                    onChange={(e) => handleSizeChange(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {LOCKER_SIZES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label} ({s.code})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">{selectedSizeDefinition?.dimensions} — {isEdit ? 'existing tariffs are preserved' : 'tariff auto-filled'}</p>
                </div>

                {/* Rack Identifier */}
                <div className="space-y-1">
                  <label htmlFor="rack-number" className="font-bold text-slate-700">
                    Rack Identifier <span className="ml-0.5 font-bold text-red-600" aria-hidden="true">*</span><span className="sr-only"> (required)</span>
                  </label>
                  <Input
                    id="rack-number"
                    type="text"
                    value={rackNumber}
                    onChange={(e) => { setRackNumber(e.target.value); clearFieldError('rackNumber'); }}
                    placeholder="e.g. Rack-01 or R12"
                    required
                    aria-invalid={Boolean(fieldErrors.rackNumber)}
                    aria-describedby={fieldErrors.rackNumber ? 'rack-number-error' : undefined}
                    className={`h-11 text-xs bg-white font-bold text-slate-900 rounded-xl ${fieldErrors.rackNumber ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                  />
                  {fieldErrors.rackNumber && <p id="rack-number-error" className="text-[11px] font-semibold text-red-600">{fieldErrors.rackNumber}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Section */}
                <div className="space-y-1">
                  <label htmlFor="vault-section" className="font-semibold text-slate-700">Vault Section <span className="font-normal text-slate-400">(optional)</span></label>
                  <Input
                    id="vault-section"
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. Main Vault or Left Wing"
                    className="h-10 text-xs bg-slate-50 border-slate-300 rounded-xl"
                  />
                </div>

                {/* Floor */}
                <div className="space-y-1">
                  <label htmlFor="floor-level" className="font-semibold text-slate-700">Floor Level <span className="font-normal text-slate-400">(optional)</span></label>
                  <Input
                    id="floor-level"
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    placeholder="e.g. Ground Floor"
                    className="h-10 text-xs bg-slate-50 border-slate-300 rounded-xl"
                  />
                </div>

                {/* Position */}
                <div className="space-y-1">
                  <label htmlFor="grid-position" className="font-semibold text-slate-700">Grid Position <span className="font-normal text-slate-400">(optional)</span></label>
                  <Input
                    id="grid-position"
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Row 3 / Col 6"
                    className="h-10 text-xs bg-slate-50 border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Financial Tariffs */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1">
                <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Financial tariffs & security deposit</h3>
                {tariffIsCustomized && <button type="button" onClick={resetTariffs} className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-50">Reset size defaults</button>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Annual Rent */}
                <div className="space-y-1">
                  <label htmlFor="annual-rent" className="font-bold text-slate-700">Annual rent in INR <span className="ml-0.5 font-bold text-red-600" aria-hidden="true">*</span><span className="sr-only"> (required)</span></label>
                  <Input
                    id="annual-rent"
                    type="number"
                    min="0"
                    step="100"
                    value={annualRent}
                    onChange={(e) => { setAnnualRent(Number(e.target.value)); clearFieldError('annualRent'); }}
                    required
                    inputMode="decimal"
                    aria-invalid={Boolean(fieldErrors.annualRent)}
                    aria-describedby={fieldErrors.annualRent ? 'annual-rent-error' : 'annual-rent-help'}
                    className={`h-11 text-xs bg-white font-extrabold text-slate-900 rounded-xl ${fieldErrors.annualRent ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                  />
                  {fieldErrors.annualRent ? <p id="annual-rent-error" className="text-[11px] font-semibold text-red-600">{fieldErrors.annualRent}</p> : <p id="annual-rent-help" className="text-[10px] text-slate-500">Annual charge before taxes.</p>}
                </div>

                {/* Security Deposit */}
                <div className="space-y-1">
                  <label htmlFor="security-deposit" className="font-bold text-slate-700">Security deposit in INR <span className="ml-0.5 font-bold text-red-600" aria-hidden="true">*</span><span className="sr-only"> (required)</span></label>
                  <Input
                    id="security-deposit"
                    type="number"
                    min="0"
                    step="500"
                    value={securityDeposit}
                    onChange={(e) => { setSecurityDeposit(Number(e.target.value)); clearFieldError('securityDeposit'); }}
                    required
                    inputMode="decimal"
                    aria-invalid={Boolean(fieldErrors.securityDeposit)}
                    aria-describedby={fieldErrors.securityDeposit ? 'security-deposit-error' : 'security-deposit-help'}
                    className={`h-11 text-xs bg-white font-extrabold text-slate-900 rounded-xl ${fieldErrors.securityDeposit ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                  />
                  {fieldErrors.securityDeposit ? <p id="security-deposit-error" className="text-[11px] font-semibold text-red-600">{fieldErrors.securityDeposit}</p> : <p id="security-deposit-help" className="text-[10px] text-slate-500">Refundable caution amount.</p>}
                </div>
              </div>
            </div>

            <div>
            <button type="button" onClick={() => setAdvancedOpen(!advancedOpen)} className={`flex min-h-[52px] w-full items-center justify-between border border-slate-200 bg-slate-50 px-4 text-left hover:bg-slate-100 ${advancedOpen ? 'rounded-t-2xl border-b-0' : 'rounded-2xl'}`} aria-expanded={advancedOpen} aria-controls="advanced-locker-fields">
              <span><strong className="block text-xs text-slate-900">Advanced operational details</strong><span className="mt-0.5 block text-[10px] text-slate-500">Statuses, sensitive key reference and internal notes</span></span>
              <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>

            {advancedOpen && <div id="advanced-locker-fields" className="space-y-5 rounded-b-2xl border border-slate-200 border-t-0 bg-slate-50/50 p-4">
            {/* Section 3: Status Controls */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100">
                Occupancy & Operational Health
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Occupancy Status */}
                <div className="space-y-1">
                  <label htmlFor="occupancy-status" className="font-bold text-slate-700">Occupancy Status</label>
                  <select
                    id="occupancy-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as LockerStatus)}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="VACANT">VACANT - Ready for Allotment</option>
                    <option value="RESERVED">RESERVED - On Hold</option>
                    <option value="OCCUPIED">OCCUPIED - Customer Tenancy</option>
                    <option value="BLOCKED">BLOCKED - Blocked / Restricted</option>
                  </select>
                </div>

                {/* Operational Status */}
                <div className="space-y-1">
                  <label htmlFor="operational-status" className="font-bold text-slate-700">Physical Operational Health</label>
                  <select
                    id="operational-status"
                    value={operationalStatus}
                    onChange={(e) =>
                      setOperationalStatus(e.target.value as OperationalStatus)
                    }
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="ACTIVE">ACTIVE - Healthy Unit</option>
                    <option value="MAINTENANCE">MAINTENANCE - Lock Maintenance</option>
                    <option value="DAMAGED">DAMAGED - Physical Repair Required</option>
                    <option value="DECOMMISSIONED">DECOMMISSIONED - Inactive</option>
                  </select>
                </div>
              </div>
              {statusChanged && <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium leading-relaxed text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>Status changes affect allocation availability. Review both values before saving.</span></div>}
            </div>

            {/* Section 4: Sensitive Master-Key Reference */}
            {canViewSensitive && (
              <div className="space-y-2 pt-2 p-4 rounded-2xl bg-amber-50/80 border border-amber-200">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Sensitive: Master Key Index Reference</span>
                </div>
                <p className="text-[11px] text-amber-800 font-medium">
                  Staff physical key identifier. Only authorized operators with sensitive clearance can view/modify this field.
                </p>
                <Input
                  id="master-key-reference"
                  aria-label="Master key index reference"
                  type="text"
                  value={masterKeyReference}
                  onChange={(e) => setMasterKeyReference(e.target.value)}
                  placeholder="e.g. MK-R01-A (Master Key Index)"
                  className="h-10 text-xs bg-white border-amber-300 text-slate-900 font-mono font-bold rounded-xl"
                />
              </div>
            )}

            {/* Section 5: Remarks */}
            <div className="space-y-1 pt-1">
              <label htmlFor="locker-notes" className="font-bold text-slate-700">Internal Operational Notes <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea
                id="locker-notes"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional notes regarding key handover, physical drawer condition or customer preferences"
                rows={2}
                className="w-full p-3 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            </div>}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:px-5 sm:py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3 shrink-0 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            <p aria-live="polite" className="hidden text-[10px] sm:block">{isEdit ? (isDirty ? <span className="font-semibold text-amber-700">Unsaved changes</span> : <span className="text-slate-500">No changes yet</span>) : <span className="text-slate-500">Details are validated before creation.</span>}</p>
            <div className="flex flex-1 items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={requestClose}
              disabled={isSubmitting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || (isEdit && !isDirty)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 min-w-[140px] rounded-xl"
            >
              {isSubmitting
                ? 'Saving...'
                : isEdit
                ? 'Save Locker Changes'
                : 'Create Physical Locker'}
            </Button>
            </div>
          </div>
        </form>
      </div>
      {confirmDiscard && (
        <div role="alertdialog" aria-modal="true" aria-labelledby="discard-title" className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><AlertCircle className="h-5 w-5" /></span><div><h3 id="discard-title" className="text-sm font-bold text-slate-950">Discard unsaved changes?</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">Your entries in this locker form will be lost.</p></div></div>
            <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setConfirmDiscard(false)}>Keep editing</Button><Button type="button" variant="destructive" onClick={onClose}>Discard changes</Button></div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

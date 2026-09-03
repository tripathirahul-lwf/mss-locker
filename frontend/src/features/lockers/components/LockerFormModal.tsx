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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const lockerNumberRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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
    // Ensure form starts scrolled to top
    window.setTimeout(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = 0;
      }
    }, 0);
  }, [locker]);

  useEffect(() => {
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
        aria-describedby="locker-form-description"
        className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-white p-4 sm:px-6 sm:py-4.5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shadow-2xs">
              <KeyRound className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h2
                id="locker-form-title"
                className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight"
              >
                {isEdit
                  ? `Edit Physical Locker #${locker?.lockerNumber}`
                  : 'Add New Physical Locker'}
              </h2>
              <p
                id="locker-form-description"
                className="text-xs text-slate-500 font-normal mt-0.5"
              >
                {isEdit
                  ? 'Update physical drawer coordinates, size, and tariffs'
                  : 'Register a physical unit into the master safe-deposit inventory'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close locker form"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form
          onSubmit={handleSubmit}
          onChange={() => setIsDirty(true)}
          noValidate
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div ref={scrollContainerRef} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-relaxed text-slate-500">
              <p className="font-normal">
                {isEdit ? (
                  <>
                    <span className="font-medium text-slate-700">Editing existing record:</span>{' '}
                    review identity, location and financial values before saving.
                  </>
                ) : (
                  <>Enter locker identity, location coordinates, and tariff structure.</>
                )}
              </p>
              <p className="shrink-0 font-normal">
                <span className="font-semibold text-rose-600" aria-hidden="true">
                  *
                </span>{' '}
                Required fields
              </p>
            </div>

            {error && (
              <div
                role="alert"
                tabIndex={-1}
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs font-normal"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Section 1: Physical Identification */}
            <div className="space-y-3">
              <h3 className="font-medium text-slate-500 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-emerald-800" />
                <span>Physical Identification & Rack Coordinates</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Locker Number */}
                <div className="space-y-1">
                  <label htmlFor="locker-number" className="font-medium text-slate-700 text-xs block">
                    Locker Number <span className="text-rose-600 font-semibold">*</span>
                  </label>
                  <Input
                    id="locker-number"
                    ref={lockerNumberRef}
                    type="text"
                    value={lockerNumber}
                    onChange={(e) => {
                      setLockerNumber(e.target.value);
                      clearFieldError('lockerNumber');
                    }}
                    placeholder="e.g. 101 or A-101"
                    required
                    aria-invalid={Boolean(fieldErrors.lockerNumber)}
                    aria-describedby={
                      fieldErrors.lockerNumber ? 'locker-number-error' : undefined
                    }
                    className={`h-10 text-xs bg-white font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-emerald-700/20 ${
                      fieldErrors.lockerNumber
                        ? 'border-rose-400 ring-1 ring-rose-400'
                        : 'border-slate-300'
                    }`}
                  />
                  {fieldErrors.lockerNumber && (
                    <p id="locker-number-error" className="text-[11px] font-medium text-rose-600">
                      {fieldErrors.lockerNumber}
                    </p>
                  )}
                </div>

                {/* Locker Code */}
                <div className="space-y-1">
                  <label htmlFor="locker-code" className="font-medium text-slate-700 text-xs block">
                    Locker Code <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="locker-code"
                    type="text"
                    value={lockerCode}
                    onChange={(e) => setLockerCode(e.target.value)}
                    placeholder="AUTO-GENERATED IF LEFT BLANK"
                    className="h-10 rounded-xl border-slate-300 bg-white font-mono text-xs font-medium uppercase text-slate-900 placeholder:text-slate-400 focus:border-emerald-700 focus:ring-emerald-700/20"
                  />
                  <p className="text-[10.5px] text-slate-500 font-normal">
                    Stable registry code used in imports and reports.
                  </p>
                </div>

                {/* Locker Size */}
                <div className="space-y-1">
                  <label htmlFor="locker-size" className="font-medium text-slate-700 text-xs block">
                    Size Classification <span className="text-rose-600 font-semibold">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="locker-size"
                      value={size}
                      onChange={(e) => handleSizeChange(e.target.value)}
                      className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 text-xs appearance-none cursor-pointer shadow-2xs"
                    >
                      {LOCKER_SIZES.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.label} ({s.code})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                  <p className="text-[10.5px] text-slate-500 font-normal">
                    {selectedSizeDefinition?.dimensions} &mdash;{' '}
                    {isEdit ? 'existing tariffs are preserved' : 'tariff auto-filled'}
                  </p>
                </div>

                {/* Rack Identifier */}
                <div className="space-y-1">
                  <label htmlFor="rack-number" className="font-medium text-slate-700 text-xs block">
                    Rack Identifier <span className="text-rose-600 font-semibold">*</span>
                  </label>
                  <Input
                    id="rack-number"
                    type="text"
                    value={rackNumber}
                    onChange={(e) => {
                      setRackNumber(e.target.value);
                      clearFieldError('rackNumber');
                    }}
                    placeholder="e.g. Rack-01 or R12"
                    required
                    aria-invalid={Boolean(fieldErrors.rackNumber)}
                    aria-describedby={
                      fieldErrors.rackNumber ? 'rack-number-error' : undefined
                    }
                    className={`h-10 text-xs bg-white font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-emerald-700/20 ${
                      fieldErrors.rackNumber
                        ? 'border-rose-400 ring-1 ring-rose-400'
                        : 'border-slate-300'
                    }`}
                  />
                  {fieldErrors.rackNumber && (
                    <p id="rack-number-error" className="text-[11px] font-medium text-rose-600">
                      {fieldErrors.rackNumber}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {/* Section */}
                <div className="space-y-1">
                  <label htmlFor="vault-section" className="font-medium text-slate-700 text-xs block">
                    Vault Section <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="vault-section"
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    placeholder="e.g. Main Vault"
                    className="h-9.5 text-xs bg-slate-50/70 border-slate-300 rounded-xl focus:bg-white focus:border-emerald-700 focus:ring-emerald-700/20 font-normal"
                  />
                </div>

                {/* Floor */}
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
                    className="h-9.5 text-xs bg-slate-50/70 border-slate-300 rounded-xl focus:bg-white focus:border-emerald-700 focus:ring-emerald-700/20 font-normal"
                  />
                </div>

                {/* Position */}
                <div className="space-y-1">
                  <label htmlFor="grid-position" className="font-medium text-slate-700 text-xs block">
                    Grid Position <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <Input
                    id="grid-position"
                    type="text"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="e.g. Row 3 / Col 6"
                    className="h-9.5 text-xs bg-slate-50/70 border-slate-300 rounded-xl focus:bg-white focus:border-emerald-700 focus:ring-emerald-700/20 font-normal"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Financial Tariffs */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-1">
                <h3 className="font-medium text-slate-500 uppercase tracking-wider text-[11px]">
                  Financial Tariffs & Security Deposit
                </h3>
                {tariffIsCustomized && (
                  <button
                    type="button"
                    onClick={resetTariffs}
                    className="shrink-0 rounded-lg px-2 py-0.5 text-[10.5px] font-medium text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                  >
                    Reset size defaults
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Annual Rent */}
                <div className="space-y-1">
                  <label htmlFor="annual-rent" className="font-medium text-slate-700 text-xs block">
                    Annual Rent in INR <span className="text-rose-600 font-semibold">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans font-medium text-slate-400 text-xs">
                      ₹
                    </span>
                    <Input
                      id="annual-rent"
                      type="number"
                      min="0"
                      step="100"
                      value={annualRent}
                      onChange={(e) => {
                        setAnnualRent(Number(e.target.value));
                        clearFieldError('annualRent');
                      }}
                      required
                      inputMode="decimal"
                      aria-invalid={Boolean(fieldErrors.annualRent)}
                      aria-describedby={
                        fieldErrors.annualRent ? 'annual-rent-error' : 'annual-rent-help'
                      }
                      className={`h-10 pl-7 text-xs bg-white font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-emerald-700/20 tabular-nums ${
                        fieldErrors.annualRent
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.annualRent ? (
                    <p id="annual-rent-error" className="text-[11px] font-medium text-rose-600">
                      {fieldErrors.annualRent}
                    </p>
                  ) : (
                    <p id="annual-rent-help" className="text-[10.5px] text-slate-500 font-normal">
                      Annual charge before taxes.
                    </p>
                  )}
                </div>

                {/* Security Deposit */}
                <div className="space-y-1">
                  <label htmlFor="security-deposit" className="font-medium text-slate-700 text-xs block">
                    Security Deposit in INR <span className="text-rose-600 font-semibold">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans font-medium text-slate-400 text-xs">
                      ₹
                    </span>
                    <Input
                      id="security-deposit"
                      type="number"
                      min="0"
                      step="500"
                      value={securityDeposit}
                      onChange={(e) => {
                        setSecurityDeposit(Number(e.target.value));
                        clearFieldError('securityDeposit');
                      }}
                      required
                      inputMode="decimal"
                      aria-invalid={Boolean(fieldErrors.securityDeposit)}
                      aria-describedby={
                        fieldErrors.securityDeposit
                          ? 'security-deposit-error'
                          : 'security-deposit-help'
                      }
                      className={`h-10 pl-7 text-xs bg-white font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-emerald-700/20 tabular-nums ${
                        fieldErrors.securityDeposit
                          ? 'border-rose-400 ring-1 ring-rose-400'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                  {fieldErrors.securityDeposit ? (
                    <p id="security-deposit-error" className="text-[11px] font-medium text-rose-600">
                      {fieldErrors.securityDeposit}
                    </p>
                  ) : (
                    <p id="security-deposit-help" className="text-[10.5px] text-slate-500 font-normal">
                      Refundable caution amount.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Advanced Operational Details Accordion */}
            <div>
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className={`flex min-h-[48px] w-full items-center justify-between border border-slate-200/90 bg-slate-50/70 px-4 text-left hover:bg-slate-100/80 transition-colors cursor-pointer ${
                  advancedOpen ? 'rounded-t-xl border-b-0' : 'rounded-xl'
                }`}
                aria-expanded={advancedOpen}
                aria-controls="advanced-locker-fields"
              >
                <span>
                  <span className="block text-xs font-semibold text-slate-900">
                    Advanced operational details
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-slate-500 font-normal">
                    Statuses, sensitive key reference and internal notes
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 transition-transform ${
                    advancedOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {advancedOpen && (
                <div
                  id="advanced-locker-fields"
                  className="space-y-4 rounded-b-xl border border-slate-200/90 border-t-0 bg-slate-50/40 p-4"
                >
                  {/* Status Controls */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-slate-500 uppercase tracking-wider text-[10.5px] pb-1 border-b border-slate-100">
                      Occupancy & Operational Health
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Occupancy Status */}
                      <div className="space-y-1">
                        <label
                          htmlFor="occupancy-status"
                          className="font-medium text-slate-700 text-xs block"
                        >
                          Occupancy Status
                        </label>
                        <div className="relative">
                          <select
                            id="occupancy-status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value as LockerStatus)}
                            className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 text-xs appearance-none cursor-pointer shadow-2xs"
                          >
                            <option value="VACANT">VACANT - Ready for Allotment</option>
                            <option value="RESERVED">RESERVED - On Hold</option>
                            <option value="OCCUPIED">OCCUPIED - Customer Tenancy</option>
                            <option value="BLOCKED">BLOCKED - Restricted</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        </div>
                      </div>

                      {/* Operational Status */}
                      <div className="space-y-1">
                        <label
                          htmlFor="operational-status"
                          className="font-medium text-slate-700 text-xs block"
                        >
                          Physical Operational Health
                        </label>
                        <div className="relative">
                          <select
                            id="operational-status"
                            value={operationalStatus}
                            onChange={(e) =>
                              setOperationalStatus(e.target.value as OperationalStatus)
                            }
                            className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 text-xs appearance-none cursor-pointer shadow-2xs"
                          >
                            <option value="ACTIVE">ACTIVE - Healthy Unit</option>
                            <option value="MAINTENANCE">MAINTENANCE - Lock Maintenance</option>
                            <option value="DAMAGED">DAMAGED - Physical Repair</option>
                            <option value="DECOMMISSIONED">DECOMMISSIONED - Inactive</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        </div>
                      </div>
                    </div>

                    {statusChanged && (
                      <div
                        role="status"
                        className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] font-normal leading-relaxed text-amber-900"
                      >
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                        <span>
                          Status changes affect allocation availability. Review both values before
                          saving.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Sensitive Master-Key Reference */}
                  {canViewSensitive && (
                    <div className="space-y-2 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                      <div className="flex items-center gap-2 text-amber-900 font-medium text-xs">
                        <ShieldAlert className="w-4 h-4 text-amber-700" />
                        <span>Sensitive: Master Key Index Reference</span>
                      </div>
                      <p className="text-[10.5px] text-amber-800 font-normal">
                        Staff physical key identifier. Only authorized personnel can view or modify.
                      </p>
                      <Input
                        id="master-key-reference"
                        aria-label="Master key index reference"
                        type="text"
                        value={masterKeyReference}
                        onChange={(e) => setMasterKeyReference(e.target.value)}
                        placeholder="e.g. MK-R01-A"
                        className="h-9 text-xs bg-white border-amber-300 text-slate-900 font-mono font-medium rounded-xl"
                      />
                    </div>
                  )}

                  {/* Remarks */}
                  <div className="space-y-1 pt-1">
                    <label
                      htmlFor="locker-notes"
                      className="font-medium text-slate-700 text-xs block"
                    >
                      Internal Operational Notes{' '}
                      <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <textarea
                      id="locker-notes"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Optional notes regarding drawer condition or special instructions..."
                      rows={2}
                      className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20 font-normal"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:px-6 sm:py-3.5 bg-white border-t border-slate-100 flex items-center justify-between gap-3 shrink-0 pb-[max(.75rem,env(safe-area-inset-bottom))]">
            <p aria-live="polite" className="hidden text-[11px] text-slate-500 font-normal sm:block">
              {isEdit ? (
                isDirty ? (
                  <span className="font-medium text-amber-700">Unsaved changes</span>
                ) : (
                  <span>No changes yet</span>
                )
              ) : (
                <span>Details are validated before creation.</span>
              )}
            </p>
            <div className="flex flex-1 sm:flex-none items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={requestClose}
                disabled={isSubmitting}
                className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9.5 px-4 cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || (isEdit && !isDirty)}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs min-w-[140px] rounded-xl text-xs h-9.5 px-4 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed"
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
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="discard-title"
          className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-4"
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
                  Your entries in this locker form will be lost.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl font-medium text-xs"
                onClick={() => setConfirmDiscard(false)}
              >
                Keep editing
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="rounded-xl font-medium text-xs"
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

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, AlertCircle, AlertTriangle, User, Phone, MapPin, Loader2, ChevronDown, CheckCircle2, Mail, Building2 } from 'lucide-react';
import {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  CustomerStatus,
} from '../types';
import { customerApi } from '../api/customerApi';
import { CustomerPhotoUploader } from './CustomerPhotoUploader';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

interface CustomerFormModalProps {
  customer?: Customer | null;
  onClose: () => void;
  onSubmit: (data: CreateCustomerInput | UpdateCustomerInput) => Promise<void>;
  isSubmitting: boolean;
}

export function CustomerFormModal({
  customer,
  onClose,
  onSubmit,
  isSubmitting,
}: CustomerFormModalProps) {
  const isEdit = Boolean(customer);
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const isSubmittingRef = useRef(isSubmitting);
  const onCloseRef = useRef(onClose);
  isSubmittingRef.current = isSubmitting;
  onCloseRef.current = onClose;

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('India');
  const [photoUrl, setPhotoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<CustomerStatus>('ACTIVE');

  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const calculateAgeInfo = (dob: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 0) return null;
    return {
      age,
      isSenior: age >= 60,
      isMinor: age < 18,
    };
  };

  const ageInfo = calculateAgeInfo(dateOfBirth);

  const handlePhoneInput = (val: string, setter: (cleaned: string) => void) => {
    let raw = val.replace(/[^\d+]/g, '');
    if (raw.startsWith('+91')) {
      raw = raw.slice(3);
    } else if (raw.startsWith('91') && raw.length > 10) {
      raw = raw.slice(2);
    } else if (raw.startsWith('0') && raw.length > 10) {
      raw = raw.slice(1);
    }
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 15);
    setter(digitsOnly);
  };

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => titleRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[data-customer-photo-preview="true"]')) return;
      if (event.key === 'Escape' && !isSubmittingRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !isSubmittingRef.current) {
        event.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, []); // Modal lifecycle: install once, then restore focus and page scrolling on unmount.

  useEffect(() => {
    if (customer) {
      setFullName(customer.fullName || '');
      setPhone(customer.phone || '');
      setAlternatePhone(customer.alternatePhone || '');
      setEmail(customer.email || '');
      setDateOfBirth(customer.dateOfBirth || '');
      setGender(customer.gender || 'MALE');
      setAddress(customer.address || '');
      // Sanitize legacy imported values where Vault location was saved as City/State
      const sanitizedCity = customer.city === 'Main Vault' ? '' : (customer.city || '');
      const sanitizedState = customer.state === 'Operational' ? '' : (customer.state || '');
      setCity(sanitizedCity);
      setState(sanitizedState);
      setPostalCode(customer.postalCode || '');
      setCountry(customer.country || 'India');
      setPhotoUrl(customer.photoUrl || '');
      setNotes(customer.notes || '');
      setStatus(customer.status || 'ACTIVE');
    }
  }, [customer]);

  // Duplicate Check on Phone blur
  const handlePhoneBlur = async () => {
    const digitCount = phone.replace(/\D/g, '').length;
    if (!phone || digitCount < 10 || digitCount > 15) return;

    try {
      setIsCheckingDuplicate(true);
      const result = await customerApi.checkDuplicate({
        phone: phone.trim(),
        email: email.trim() || undefined,
        excludeCustomerId: customer?._id,
      });

      if (result.hasDuplicate && result.duplicates.length > 0) {
        const dup = result.duplicates[0];
        setDuplicateWarning(
          `Possible existing customer found: ${dup.fullName} (${dup.customerCode}) with phone ${dup.phone}.`
        );
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      setDuplicateWarning('Duplicate check is temporarily unavailable. You can still review and submit this record.');
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errors: Record<string, string> = {};
    const phoneDigits = phone.replace(/\D/g, '').length;
    const alternateDigits = alternatePhone.replace(/\D/g, '').length;
    if (fullName.trim().length < 2) {
      errors.fullName = 'Full Name must be at least 2 characters.';
    } else if (fullName.trim().length > 100) {
      errors.fullName = 'Full Name cannot exceed 100 characters.';
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const cleanAlt = alternatePhone.replace(/\D/g, '');

    if (phoneDigits !== 10) {
      errors.phone = 'Enter a valid 10-digit mobile number.';
    } else if (!/^[6-9]/.test(cleanPhone)) {
      errors.phone = 'Indian mobile number should begin with 6, 7, 8, or 9.';
    }

    if (alternatePhone) {
      if (alternateDigits !== 10) {
        errors.alternatePhone = 'Enter a valid 10-digit mobile number or leave blank.';
      } else if (!/^[6-9]/.test(cleanAlt)) {
        errors.alternatePhone = 'Mobile number should begin with 6, 7, 8, or 9.';
      } else if (cleanPhone === cleanAlt) {
        errors.alternatePhone = 'Alternate phone must differ from the primary phone.';
      }
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid email address (e.g. name@example.com).';
    }

    if (postalCode && !/^[1-9]\d{5}$/.test(postalCode)) {
      errors.postalCode = 'Indian PIN must be 6 digits and cannot begin with 0.';
    }

    if (dateOfBirth) {
      const today = new Date().toISOString().slice(0, 10);
      if (dateOfBirth > today) {
        errors.dateOfBirth = 'Date of birth cannot be in the future.';
      } else if (dateOfBirth < '1900-01-01') {
        errors.dateOfBirth = 'Enter a valid date of birth after year 1900.';
      }
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError(`Please correct ${Object.keys(errors).length} highlighted field${Object.keys(errors).length > 1 ? 's' : ''}.`);
      window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }

    try {
      if (isEdit && customer) {
        await onSubmit({
          fullName: fullName.trim(),
          phone: phone.trim(),
          alternatePhone: alternatePhone.trim() || undefined,
          email: email.trim() || undefined,
          dateOfBirth: dateOfBirth || undefined,
          gender,
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),
          photoUrl: photoUrl.trim() || undefined,
          notes: notes.trim(),
          status,
          expectedUpdatedAt: customer.updatedAt,
        });
      } else {
        await onSubmit({
          fullName: fullName.trim(),
          phone: phone.trim(),
          alternatePhone: alternatePhone.trim() || undefined,
          email: email.trim() || undefined,
          dateOfBirth: dateOfBirth || undefined,
          gender,
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          postalCode: postalCode.trim(),
          country: country.trim(),
          photoUrl: photoUrl.trim() || undefined,
          notes: notes.trim(),
          status,
        });
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || 'Failed to save customer profile.'
      );
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in-0 duration-150">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-form-title"
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 sm:py-4.5 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center shadow-2xs">
              <UserPlus className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <h2 ref={titleRef} tabIndex={-1} id="customer-form-title" className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight outline-none">
                {isEdit ? `Edit Customer: ${customer?.fullName}` : 'Register New Customer'}
              </h2>
              <p className="text-xs text-slate-500 font-normal mt-0.5">
                {isEdit
                  ? 'Update contact details, address, and profile specifications'
                  : 'Add customer profile to directory before locker allotment and KYC verification'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customer form"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Modal Form */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300">
            {error && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 font-normal">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {duplicateWarning && (
              <div role="status" className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 font-normal">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span className="leading-relaxed">{duplicateWarning}</span>
              </div>
            )}

            {/* Profile Photo Uploader */}
            <CustomerPhotoUploader
              photoUrl={photoUrl}
              onChange={(url) => setPhotoUrl(url)}
            />

            {/* Step 1: Customer Identification & Demographics */}
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-700 text-white text-[11px] font-bold shadow-2xs">1</span>
                  <h3 className="font-bold text-slate-900 text-xs tracking-wide">
                    Personal Details & Demographics
                  </h3>
                </div>
                <span className="text-[10.5px] text-slate-400 font-normal">Fields marked <span className="text-rose-500">*</span> are mandatory</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label htmlFor="customer-full-name" className="font-semibold text-slate-800 text-xs block">
                    Full Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="customer-full-name"
                    autoFocus={false}
                    autoComplete="name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar Sharma"
                    required
                    aria-invalid={Boolean(fieldErrors.fullName)}
                    aria-describedby={fieldErrors.fullName ? 'customer-full-name-error' : undefined}
                    className="h-11 px-4 text-xs sm:text-[13px] bg-white border-slate-300 font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs font-sans transition-all hover:border-slate-400"
                  />
                  {fieldErrors.fullName && <p id="customer-full-name-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.fullName}</p>}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="customer-status" className="font-semibold text-slate-800 text-xs block">Account Status</label>
                  <div className="relative">
                    <select
                      id="customer-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                      className="w-full h-11 pl-4 pr-10 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs sm:text-[13px] focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 appearance-none cursor-pointer shadow-2xs font-sans transition-all hover:border-slate-400"
                    >
                      <option value="ACTIVE">ACTIVE - Operational Account</option>
                      <option value="INACTIVE">INACTIVE - Suspended / Dormant</option>
                      <option value="BLOCKED">BLOCKED - Access Restricted</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-800 text-xs block">Gender Category</label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80">
                    {[
                      { value: 'MALE', label: 'Male', icon: <User className="w-3.5 h-3.5 text-slate-500" /> },
                      { value: 'FEMALE', label: 'Female', icon: <User className="w-3.5 h-3.5 text-slate-500" /> },
                      { value: 'OTHER', label: 'Other / Entity', icon: <Building2 className="w-3.5 h-3.5 text-slate-500" /> },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGender(opt.value as any)}
                        className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                          gender === opt.value
                            ? 'bg-white text-emerald-900 shadow-xs ring-1 ring-slate-200/90 font-bold'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        {opt.icon}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="customer-dob" className="font-semibold text-slate-800 text-xs block">Date of Birth</label>
                    {ageInfo && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold border ${
                        ageInfo.isMinor
                          ? 'bg-amber-50 text-amber-800 border-amber-200/80'
                          : ageInfo.isSenior
                          ? 'bg-purple-50 text-purple-700 border-purple-200/80'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                      }`}>
                        {ageInfo.isMinor && '⚠️ Minor • '}{ageInfo.isSenior && '🎖️ Senior • '}{ageInfo.age} yrs
                      </span>
                    )}
                  </div>
                  <Input
                    id="customer-dob"
                    type="date"
                    value={dateOfBirth}
                    max={new Date().toISOString().slice(0, 10)}
                    autoComplete="bday"
                    aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                    aria-describedby={fieldErrors.dateOfBirth ? 'customer-dob-error' : undefined}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="h-11 px-3.5 text-xs sm:text-[13px] bg-white border-slate-300 font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs font-sans transition-all hover:border-slate-400"
                  />
                  {fieldErrors.dateOfBirth && <p id="customer-dob-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.dateOfBirth}</p>}
                </div>
              </div>
            </div>

            {/* Step 2: Contact & Communications */}
            <div className="space-y-3.5 pt-1">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-700 text-white text-[11px] font-bold shadow-2xs">2</span>
                <h3 className="font-bold text-slate-900 text-xs tracking-wide">
                  Contact & Communications
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Primary Mobile Phone */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="customer-phone" className="font-semibold text-slate-800 text-xs block">
                      Primary Mobile Phone <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {phone.replace(/\D/g, '').length === 10 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      <span className={`text-[10px] font-mono ${phone.replace(/\D/g, '').length === 10 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        {phone.replace(/\D/g, '').length}/10
                      </span>
                    </div>
                  </div>
                  <div className={`flex items-center h-11 w-full rounded-xl border bg-white shadow-2xs transition-all ${
                    fieldErrors.phone
                      ? 'border-rose-400 ring-2 ring-rose-500/20'
                      : 'border-slate-300 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20 hover:border-slate-400'
                  }`}>
                    <div className="flex items-center gap-1.5 px-3 h-full bg-slate-50 border-r border-slate-200 rounded-l-xl shrink-0 select-none">
                      <svg className="w-4 h-3 rounded-2xs shrink-0 shadow-2xs" viewBox="0 0 640 480" aria-hidden="true">
                        <path fill="#f93" d="M0 0h640v160H0z"/>
                        <path fill="#fff" d="M0 160h640v160H0z"/>
                        <path fill="#128807" d="M0 320h640v160H0z"/>
                        <circle cx="320" cy="240" r="40" fill="#008"/>
                      </svg>
                      <span className="text-xs font-semibold text-slate-700 font-mono">+91</span>
                    </div>
                    <input
                      id="customer-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => handlePhoneInput(e.target.value, setPhone)}
                      onBlur={handlePhoneBlur}
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={15}
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={fieldErrors.phone ? 'customer-phone-error' : undefined}
                      placeholder="98765 43210"
                      required
                      className="flex-1 min-w-0 h-full px-3 text-xs sm:text-[13px] font-sans font-medium text-slate-900 placeholder:text-slate-400 bg-transparent border-none outline-none focus:ring-0"
                    />
                  </div>
                  {fieldErrors.phone && <p id="customer-phone-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.phone}</p>}
                  {isCheckingDuplicate && <p className="inline-flex items-center gap-1 text-[10px] text-emerald-800" role="status"><Loader2 className="h-3 w-3 animate-spin" /> Checking existing records…</p>}
                </div>

                {/* Alternate Phone */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="customer-alt-phone" className="font-semibold text-slate-800 text-xs block">Alternate Phone (Optional)</label>
                    {alternatePhone.length > 0 && (
                      <span className={`text-[10px] font-mono ${alternatePhone.replace(/\D/g, '').length === 10 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                        {alternatePhone.replace(/\D/g, '').length}/10
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center h-11 w-full rounded-xl border bg-white shadow-2xs transition-all ${
                    fieldErrors.alternatePhone
                      ? 'border-rose-400 ring-2 ring-rose-500/20'
                      : 'border-slate-300 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20 hover:border-slate-400'
                  }`}>
                    <div className="flex items-center gap-1.5 px-3 h-full bg-slate-50 border-r border-slate-200 rounded-l-xl shrink-0 select-none">
                      <svg className="w-4 h-3 rounded-2xs shrink-0 shadow-2xs" viewBox="0 0 640 480" aria-hidden="true">
                        <path fill="#f93" d="M0 0h640v160H0z"/>
                        <path fill="#fff" d="M0 160h640v160H0z"/>
                        <path fill="#128807" d="M0 320h640v160H0z"/>
                        <circle cx="320" cy="240" r="40" fill="#008"/>
                      </svg>
                      <span className="text-xs font-semibold text-slate-700 font-mono">+91</span>
                    </div>
                    <input
                      id="customer-alt-phone"
                      type="tel"
                      value={alternatePhone}
                      onChange={(e) => handlePhoneInput(e.target.value, setAlternatePhone)}
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={15}
                      aria-invalid={Boolean(fieldErrors.alternatePhone)}
                      aria-describedby={fieldErrors.alternatePhone ? 'customer-alt-phone-error' : undefined}
                      placeholder="98765 00000"
                      className="flex-1 min-w-0 h-full px-3 text-xs sm:text-[13px] font-sans font-medium text-slate-900 placeholder:text-slate-400 bg-transparent border-none outline-none focus:ring-0"
                    />
                  </div>
                  {fieldErrors.alternatePhone && <p id="customer-alt-phone-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.alternatePhone}</p>}
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label htmlFor="customer-email" className="font-semibold text-slate-800 text-xs block">Email Address (Optional)</label>
                <div className={`flex items-center h-11 w-full rounded-xl border bg-white shadow-2xs transition-all ${
                  fieldErrors.email
                    ? 'border-rose-400 ring-2 ring-rose-500/20'
                    : 'border-slate-300 focus-within:border-emerald-700 focus-within:ring-2 focus-within:ring-emerald-700/20 hover:border-slate-400'
                }`}>
                  <div className="flex items-center justify-center pl-3.5 pr-2 h-full text-slate-400 shrink-0 select-none">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="customer-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? 'customer-email-error' : undefined}
                    placeholder="e.g. customer@gmail.com"
                    className="flex-1 min-w-0 h-full pr-3 text-xs sm:text-[13px] font-sans font-medium text-slate-900 placeholder:text-slate-400 bg-transparent border-none outline-none focus:ring-0"
                  />
                </div>
                {fieldErrors.email && <p id="customer-email-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.email}</p>}
              </div>
            </div>

            {/* Step 3: Registered Postal Address */}
            <div className="space-y-3.5 pt-1">
              <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
                <span className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-700 text-white text-[11px] font-bold shadow-2xs">3</span>
                <h3 className="font-bold text-slate-900 text-xs tracking-wide">
                  Registered Postal Address
                </h3>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="customer-address" className="font-semibold text-slate-800 text-xs block">Street / Flat Address</label>
                <Input
                  id="customer-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                  placeholder="e.g. Flat 402, Royal Residency, M.G. Road"
                  className="h-11 px-4 text-xs sm:text-[13px] bg-white border-slate-300 font-sans font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs transition-all hover:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="space-y-1.5">
                  <label htmlFor="customer-city" className="font-semibold text-slate-800 text-xs block">City / District</label>
                  <Input
                    id="customer-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoComplete="address-level2"
                    placeholder="e.g. Mumbai"
                    className="h-11 px-4 text-xs sm:text-[13px] bg-white border-slate-300 font-sans font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs transition-all hover:border-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="customer-state" className="font-semibold text-slate-800 text-xs block">State</label>
                  <Input
                    id="customer-state"
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    autoComplete="address-level1"
                    placeholder="e.g. Maharashtra"
                    className="h-11 px-4 text-xs sm:text-[13px] bg-white border-slate-300 font-sans font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs transition-all hover:border-slate-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="customer-postal-code" className="font-semibold text-slate-800 text-xs block">Postal PIN</label>
                    {postalCode.length > 0 && (
                      <div className="flex items-center gap-1">
                        {postalCode.length === 6 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        <span className={`text-[10px] font-mono ${postalCode.length === 6 ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                          {postalCode.length}/6 PIN
                        </span>
                      </div>
                    )}
                  </div>
                  <Input
                    id="customer-postal-code"
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
                    aria-invalid={Boolean(fieldErrors.postalCode)}
                    aria-describedby={fieldErrors.postalCode ? 'customer-postal-code-error' : undefined}
                    placeholder="e.g. 400001"
                    className="h-11 px-4 text-xs sm:text-[13px] bg-white border-slate-300 font-sans font-medium text-slate-900 tabular-nums rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs transition-all hover:border-slate-400"
                  />
                  {fieldErrors.postalCode && <p id="customer-postal-code-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.postalCode}</p>}
                </div>
              </div>
            </div>

            {/* Step 4: Operational Remarks */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-700 text-white text-[11px] font-bold shadow-2xs">4</span>
                  <label htmlFor="customer-notes" className="font-bold text-slate-900 text-xs tracking-wide">
                    Staff Operational Remarks
                  </label>
                </div>
                <span className="text-[10.5px] text-slate-400 font-normal">{notes.length}/500</span>
              </div>
              <textarea
                id="customer-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes regarding nominee, joint operators, locker allocation instructions, or identification references"
                rows={2}
                maxLength={500}
                className="w-full p-3.5 text-xs sm:text-[13px] bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs transition-all hover:border-slate-400 font-normal"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 sm:px-6 sm:py-3.5 bg-white border-t border-slate-100 flex items-center justify-between gap-2.5 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-normal">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[10px] font-medium">Ctrl</kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[10px] font-medium">Enter</kbd>
              <span>to save</span>
            </div>
            <div className="flex items-center gap-2.5 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9.5 px-4 cursor-pointer hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs min-w-[140px] rounded-xl text-xs h-9.5 px-4 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border disabled:border-slate-200 disabled:shadow-none disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? 'Saving…'
                  : isEdit
                  ? 'Save Changes'
                  : 'Register Customer'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

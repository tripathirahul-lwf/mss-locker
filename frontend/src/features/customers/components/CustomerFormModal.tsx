import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, AlertCircle, AlertTriangle, User, Phone, MapPin, Loader2, ChevronDown } from 'lucide-react';
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
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('OTHER');
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
      setFullName(customer.fullName);
      setPhone(customer.phone);
      setAlternatePhone(customer.alternatePhone || '');
      setEmail(customer.email || '');
      setDateOfBirth(customer.dateOfBirth || '');
      setGender(customer.gender || 'OTHER');
      setAddress(customer.address || '');
      setCity(customer.city || '');
      setState(customer.state || '');
      setPostalCode(customer.postalCode || '');
      setCountry(customer.country || 'India');
      setPhotoUrl(customer.photoUrl || '');
      setNotes(customer.notes || '');
      setStatus(customer.status);
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
    if (fullName.trim().length < 2) errors.fullName = 'Enter at least 2 characters.';
    if (phoneDigits < 10 || phoneDigits > 15) errors.phone = 'Enter a valid phone number with 10 to 15 digits.';
    if (alternatePhone && (alternateDigits < 10 || alternateDigits > 15)) errors.alternatePhone = 'Enter 10 to 15 digits or leave this blank.';
    if (phone && alternatePhone && phone.replace(/\D/g, '') === alternatePhone.replace(/\D/g, '')) errors.alternatePhone = 'Alternate phone must differ from the primary phone.';
    if (postalCode && !/^\d{6}$/.test(postalCode)) errors.postalCode = 'Indian PIN must contain exactly 6 digits.';
    if (dateOfBirth && dateOfBirth > new Date().toISOString().slice(0, 10)) errors.dateOfBirth = 'Date of birth cannot be in the future.';
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
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
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
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/90 shadow-2xs">
              <CustomerPhotoUploader
                photoUrl={photoUrl}
                onChange={(url) => setPhotoUrl(url)}
              />
            </div>

            {/* Basic Information */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[10.5px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-800" />
                <span>Personal Identification</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="customer-full-name" className="font-medium text-slate-700 text-xs block">
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
                    className="h-10 text-xs bg-white border-slate-300 font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs font-sans"
                  />
                  {fieldErrors.fullName && <p id="customer-full-name-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.fullName}</p>}
                </div>

                <div className="space-y-1">
                  <label htmlFor="customer-gender" className="font-medium text-slate-700 text-xs block">Gender</label>
                  <div className="relative">
                    <select
                      id="customer-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value as any)}
                      className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 appearance-none cursor-pointer shadow-2xs font-sans"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other / Corporate Entity</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="customer-dob" className="font-medium text-slate-700 text-xs block">Date of Birth</label>
                  <Input
                    id="customer-dob"
                    type="date"
                    value={dateOfBirth}
                    max={new Date().toISOString().slice(0, 10)}
                    autoComplete="bday"
                    aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                    aria-describedby={fieldErrors.dateOfBirth ? 'customer-dob-error' : undefined}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="h-10 text-xs bg-white border-slate-300 font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs font-sans"
                  />
                  {fieldErrors.dateOfBirth && <p id="customer-dob-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.dateOfBirth}</p>}
                </div>

                <div className="space-y-1">
                  <label htmlFor="customer-status" className="font-medium text-slate-700 text-xs block">Account Status</label>
                  <div className="relative">
                    <select
                      id="customer-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as CustomerStatus)}
                      className="w-full h-10 pl-3.5 pr-9 bg-white border border-slate-300 rounded-xl font-medium text-slate-900 text-xs focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 appearance-none cursor-pointer shadow-2xs font-sans"
                    >
                      <option value="ACTIVE">ACTIVE - Operational</option>
                      <option value="INACTIVE">INACTIVE - Inactive record</option>
                      <option value="BLOCKED">BLOCKED - Access restricted</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-3 pt-2">
              <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[10.5px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-800" />
                <span>Contact Information</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label htmlFor="customer-phone" className="font-medium text-slate-700 text-xs block">
                    Primary Mobile Phone <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    id="customer-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onBlur={handlePhoneBlur}
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={20}
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={fieldErrors.phone ? 'customer-phone-error' : 'customer-phone-help'}
                    placeholder="e.g. 9876543210"
                    required
                    className="h-10 text-xs bg-white border-slate-300 font-sans font-medium text-slate-900 tabular-nums rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
                  />
                  <p id="customer-phone-help" className="text-[10.5px] text-slate-400 font-normal">10–15 digits; spaces and + accepted.</p>
                  {fieldErrors.phone && <p id="customer-phone-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.phone}</p>}
                  {isCheckingDuplicate && <p className="inline-flex items-center gap-1 text-[10px] text-emerald-800" role="status"><Loader2 className="h-3 w-3 animate-spin" /> Checking existing records…</p>}
                </div>

                <div className="space-y-1">
                  <label htmlFor="customer-alt-phone" className="font-medium text-slate-700 text-xs block">Alternate Phone</label>
                  <Input
                    id="customer-alt-phone"
                    type="tel"
                    value={alternatePhone}
                    onChange={(e) => setAlternatePhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel-national"
                    maxLength={20}
                    aria-invalid={Boolean(fieldErrors.alternatePhone)}
                    aria-describedby={fieldErrors.alternatePhone ? 'customer-alt-phone-error' : undefined}
                    placeholder="e.g. 9876500000"
                    className="h-10 text-xs bg-white border-slate-300 font-sans font-medium text-slate-900 tabular-nums rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
                  />
                  {fieldErrors.alternatePhone && <p id="customer-alt-phone-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.alternatePhone}</p>}
                </div>

                <div className="space-y-1">
                  <label htmlFor="customer-email" className="font-medium text-slate-700 text-xs block">Email Address</label>
                  <Input
                    id="customer-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="e.g. customer@gmail.com"
                    className="h-10 text-xs bg-white border-slate-300 font-sans font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
                  />
                </div>
              </div>
            </div>

            {/* Residential Address */}
            <div className="space-y-3 pt-2">
              <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[10.5px] pb-1 border-b border-slate-100 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-800" />
                <span>Postal Address</span>
              </h3>

              <div className="space-y-1">
                <label htmlFor="customer-address" className="font-medium text-slate-700 text-xs block">Street / Flat Address</label>
                <Input
                  id="customer-address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  autoComplete="street-address"
                  placeholder="e.g. Flat 402, Royal Residency, M.G. Road"
                  className="h-10 text-xs bg-white border-slate-300 font-sans font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <label htmlFor="customer-city" className="font-medium text-slate-700 text-xs block">City / District</label>
                  <Input
                    id="customer-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    autoComplete="address-level2"
                    placeholder="e.g. Mumbai"
                    className="h-10 text-xs bg-white border-slate-300 font-sans font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="customer-state" className="font-medium text-slate-700 text-xs block">State</label>
                  <Input
                    id="customer-state"
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    autoComplete="address-level1"
                    placeholder="e.g. Maharashtra"
                    className="h-10 text-xs bg-white border-slate-300 font-sans font-medium text-slate-900 rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="customer-postal-code" className="font-medium text-slate-700 text-xs block">Postal PIN</label>
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
                    className="h-10 text-xs bg-white border-slate-300 font-sans font-medium text-slate-900 tabular-nums rounded-xl focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
                  />
                  {fieldErrors.postalCode && <p id="customer-postal-code-error" className="text-[11px] font-medium text-rose-600">{fieldErrors.postalCode}</p>}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between gap-3"><label htmlFor="customer-notes" className="font-medium text-slate-700 text-xs block">Staff Operational Remarks</label><span className="text-[10px] text-slate-400 font-normal">{notes.length}/500</span></div>
              <textarea
                id="customer-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes regarding nominee, joint operators, or identification guidelines"
                rows={2}
                maxLength={500}
                className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 shadow-2xs"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3.5 sm:px-6 sm:py-3.5 bg-white border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
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
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

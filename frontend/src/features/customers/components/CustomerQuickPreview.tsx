import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  Calendar,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { Customer } from '../types';
import { CustomerStatusBadge } from './CustomerStatusBadge';
import { KycStatusBadge } from './KycStatusBadge';
import { formatPhone } from '../utils/phoneFormatter';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Link } from 'react-router-dom';

interface CustomerQuickPreviewProps {
  customer: Customer | null;
  onClose: () => void;
  onEdit?: (customer: Customer) => void;
}

export function CustomerQuickPreview({
  customer,
  onClose,
  onEdit,
}: CustomerQuickPreviewProps) {
  if (!customer) return null;

  const drawerContent = (
    <div
      className="fixed inset-0 z-[100] w-screen h-screen flex items-center justify-end bg-slate-900/50 backdrop-blur-xs select-none animate-in fade-in-0 duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-white shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:px-5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center shadow-2xs">
              <User className="w-4.5 h-4.5 text-emerald-800" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Walk-in Customer Quick Lookup
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close lookup drawer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Profile Card Header */}
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
            {customer.photoUrl ? (
              <img
                src={customer.photoUrl}
                alt={customer.fullName}
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center font-semibold text-base shrink-0 font-sans tracking-wide shadow-2xs">
                {customer.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-slate-900 leading-tight">
                {customer.fullName}
              </h2>
              <span className="font-sans text-[11.5px] font-medium bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200 text-slate-600 inline-block tabular-nums">
                {customer.customerCode}
              </span>
              <div className="pt-0.5 flex flex-wrap gap-1.5">
                <CustomerStatusBadge status={customer.status} />
                <KycStatusBadge status={customer.kycStatus} />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-2 p-4 rounded-xl border border-slate-200/80 bg-white">
            <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10.5px] pb-1 border-b border-slate-100">
              Verified Contact
            </h4>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-normal">
                  <Phone className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Primary Phone</span>
                </span>
                <span className="font-sans font-medium text-slate-900 text-sm tracking-tight tabular-nums">
                  {formatPhone(customer.phone)}
                </span>
              </div>

              {customer.alternatePhone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-normal">Alternate Phone</span>
                  <span className="font-sans font-medium text-slate-700 text-xs tracking-tight tabular-nums">
                    {formatPhone(customer.alternatePhone)}
                  </span>
                </div>
              )}

              {customer.email && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5 font-normal">
                    <Mail className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Email</span>
                  </span>
                  <span className="text-slate-800 font-medium truncate max-w-[200px] text-xs">
                    {customer.email}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Address & Demographics */}
          <div className="space-y-2 p-4 rounded-xl border border-slate-200/80 bg-white">
            <h4 className="font-semibold text-slate-800 uppercase tracking-wider text-[10.5px] pb-1 border-b border-slate-100">
              Address & Identity
            </h4>

            <div className="space-y-2 pt-1">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-800 shrink-0 mt-0.5" />
                <p className="text-slate-700 leading-relaxed font-normal">
                  {customer.address
                    ? `${customer.address}, ${customer.city || ''} ${customer.state || ''} ${customer.postalCode || ''}`
                    : 'No address registered'}
                </p>
              </div>

              {customer.dateOfBirth && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-600 font-normal">
                    DOB: <strong className="font-semibold text-slate-800">{customer.dateOfBirth}</strong> ({customer.gender})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 text-xs">
              <span className="font-semibold text-slate-700 block mb-0.5">Counter Notes:</span>
              <p className="text-slate-600 leading-relaxed font-normal">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-3.5 sm:px-5 sm:py-3.5 bg-white border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl border-slate-300 text-slate-700 font-medium text-xs h-9.5 px-4 hover:bg-slate-50 cursor-pointer">
            Close
          </Button>

          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onEdit(customer);
                }}
                className="flex items-center gap-1.5 rounded-xl border-slate-300 font-medium text-slate-700 text-xs h-9.5 px-3.5 hover:bg-slate-50 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
            )}

            <Link to={`/customers/${customer._id}`} onClick={onClose}>
              <Button
                size="sm"
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium shadow-xs flex items-center gap-1.5 rounded-xl px-3.5 text-xs h-9.5 cursor-pointer"
              >
                <span>Full Profile & KYC</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}

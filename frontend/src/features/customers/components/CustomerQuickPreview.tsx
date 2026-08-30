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
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200/80">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Walk-in Customer Quick Lookup
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Profile Card Header */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            {customer.photoUrl ? (
              <img
                src={customer.photoUrl}
                alt={customer.fullName}
                className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-xs">
                {customer.fullName.slice(0, 2).toUpperCase()}
              </div>
            )}

            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-slate-900 leading-tight">
                {customer.fullName}
              </h2>
              <span className="font-mono text-xs font-bold bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-700 inline-block">
                {customer.customerCode}
              </span>
              <div className="pt-1 flex flex-wrap gap-1.5">
                <CustomerStatusBadge status={customer.status} />
                <KycStatusBadge status={customer.kycStatus} />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-2.5 p-4 rounded-2xl border border-slate-200 bg-white">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100">
              Verified Contact
            </h4>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span>Primary Phone</span>
                </span>
                <span className="font-mono font-extrabold text-slate-900 text-sm">
                  {formatPhone(customer.phone)}
                </span>
              </div>

              {customer.alternatePhone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Alternate Phone</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {formatPhone(customer.alternatePhone)}
                  </span>
                </div>
              )}

              {customer.email && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>Email</span>
                  </span>
                  <span className="text-slate-800 font-semibold truncate max-w-[200px]">
                    {customer.email}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Address & Demographics */}
          <div className="space-y-2.5 p-4 rounded-2xl border border-slate-200 bg-white">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100">
              Address & Identity
            </h4>

            <div className="space-y-2 pt-1">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-slate-700 leading-relaxed font-medium">
                  {customer.address
                    ? `${customer.address}, ${customer.city || ''} ${customer.state || ''} ${customer.postalCode || ''}`
                    : 'No address registered'}
                </p>
              </div>

              {customer.dateOfBirth && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-600">
                    DOB: <strong>{customer.dateOfBirth}</strong> ({customer.gender})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {customer.notes && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 block mb-1">Counter Notes:</span>
              <p className="text-slate-600 leading-relaxed">{customer.notes}</p>
            </div>
          )}
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">
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
                className="flex items-center gap-1.5 rounded-xl font-semibold text-slate-700"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
            )}

            <Link to={`/customers/${customer._id}`} onClick={onClose}>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 flex items-center gap-1.5 rounded-xl px-3.5"
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

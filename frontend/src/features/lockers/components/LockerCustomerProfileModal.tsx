import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, User } from 'lucide-react';
import { customerApi } from '../../customers/api/customerApi';
import { CustomerFormModal } from '../../customers/components/CustomerFormModal';
import { UpdateCustomerInput } from '../../customers/types';
import { usePermission } from '../../../hooks/usePermission';
import { Button } from '../../../components/ui/button';

export function LockerCustomerProfileModal({ customerId, onClose, onKyc, onInvoices }: { customerId: string; onClose: () => void; onKyc: () => void; onInvoices: () => void }) {
  const queryClient = useQueryClient();
  const canView = usePermission('customers.view');
  const canEdit = usePermission('customers.update');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const { data: customer, isPending, isError, refetch } = useQuery({ queryKey: ['customer-profile', customerId], queryFn: () => customerApi.getCustomerById(customerId), enabled: canView });
  useEffect(() => {
    if (editing) return;
    const previous = document.activeElement as HTMLElement | null;
    const handler = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      if (dialogs[dialogs.length - 1] !== dialog.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === 'Tab') {
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || []);
        if (!controls.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    const frame = requestAnimationFrame(() => dialog.current?.focus());
    window.addEventListener('keydown', handler, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', handler, true); if (previous?.isConnected) previous.focus(); };
  }, [editing, onClose]);
  if (editing && customer) return <CustomerFormModal customer={customer} isSubmitting={saving} onClose={() => { if (!saving) setEditing(false); }} onSubmit={async data => {
    setSaving(true);
    try {
      await customerApi.updateCustomer(customerId, data as UpdateCustomerInput);
      await Promise.all(['customer-profile', 'customer', 'customers', 'locker-allocations', 'lockers'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      setEditing(false);
    } finally { setSaving(false); }
  }} />;
  const fields = customer ? [['Customer code', customer.customerCode], ['Phone', customer.phone], ['Alternate phone', customer.alternatePhone], ['Email', customer.email], ['Date of birth', customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString('en-IN') : ''], ['Gender', customer.gender], ['Address', customer.address], ['City', customer.city], ['State', customer.state], ['Postal code', customer.postalCode], ['Country', customer.country], ['Status', customer.status], ['KYC status (recorded)', customer.kycStatus], ['Notes', customer.notes]] : [];
  return createPortal(<div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5">
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Customer Profile" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 p-4"><div className="flex items-center gap-2"><User className="h-5 w-5 text-emerald-800" /><div><h2 className="font-bold text-slate-900">Customer Profile</h2><p className="text-sm text-slate-600">{customer?.fullName}</p></div></div><button aria-label="Close customer profile" onClick={onClose}><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!canView ? <p>Customer profile access is restricted.</p> : isPending ? <p role="status">Loading customer...</p> : isError ? <p role="alert">Could not load customer. <button onClick={() => refetch()}>Retry</button></p> : <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><dt className="text-xs text-slate-600">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-900">{value || 'Not recorded'}</dd></div>)}</dl>}
      </div>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 bg-slate-50 p-4"><Button variant="outline" onClick={onClose}>Close</Button><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onInvoices}>Invoices</Button><Button variant="outline" onClick={onKyc}>KYC documents</Button>{customer && canView && canEdit && <Button onClick={() => setEditing(true)}>Edit customer</Button>}</div></footer>
    </div>
  </div>, document.body);
}

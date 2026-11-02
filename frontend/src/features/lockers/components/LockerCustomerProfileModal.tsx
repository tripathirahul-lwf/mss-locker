import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import { useEffect,useRef,useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery,useQueryClient } from '@tanstack/react-query';
import { X,User } from 'lucide-react';
import { customerApi } from '../../customers/api/customerApi';
import { CustomerFormModal } from '../../customers/components/CustomerFormModal';
import { UpdateCustomerInput } from '../../customers/types';
import { usePermission } from '../../../hooks/usePermission';
import { Button } from '../../../components/ui/button';

export function LockerCustomerProfileModal({ customerId, onClose, onKyc, onInvoices, layer = 120 }: { customerId: string; onClose: () => void; onKyc?: () => void; onInvoices: () => void; layer?: number }) {
  const queryClient = useQueryClient();
  const canView = usePermission('customers.view');
  const canViewKyc = usePermission('customers.kyc.view');
  const canViewInvoices = usePermission('renewals.view');
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const canEdit = usePermission('customers.update');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const { data: customer, isPending, isError, refetch } = useQuery({ queryKey: ['customer-profile', customerId], queryFn: () => customerApi.getCustomerById(customerId), enabled: canView && Boolean(customerId), staleTime: 0 });
  useEffect(() => {
    if (editing) return;
    const previous = document.activeElement as HTMLElement | null;
     const releaseScroll = lockBodyScroll();
    const handler = (event: KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      if (dialogs[dialogs.length - 1] !== dialog.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') || []);
        if (!controls.length) {event.preventDefault();return;}
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
      }
    };
    const frame = requestAnimationFrame(() => dialog.current?.focus());
    window.addEventListener('keydown', handler, true);
    return () => { cancelAnimationFrame(frame); releaseScroll(); window.removeEventListener('keydown', handler, true); if (previous?.isConnected) previous.focus(); };
  }, [editing]);
  if (editing && customer && canView && canEdit && !isError) return <CustomerFormModal layer={layer + 10} customer={customer} isSubmitting={saving} onClose={() => { if (!saving) setEditing(false); }} onSubmit={async data => {
    setSaving(true);
    try {
      await customerApi.updateCustomer(customerId, data as UpdateCustomerInput);
      await Promise.all(['customer-profile', 'customer', 'customers', 'locker-allocations', 'lockers'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      setEditing(false);
    } finally { setSaving(false); }
  }} />;
  const fields = customer ? [['Customer code', customer.customerCode], ['Phone', customer.phone], ['Alternate phone', customer.alternatePhone], ['Email', customer.email], ['Date of birth', customer.dateOfBirth && Number.isFinite(Date.parse(customer.dateOfBirth)) ? new Date(customer.dateOfBirth).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'}) : ''], ['Gender', customer.gender ? customer.gender.charAt(0)+customer.gender.slice(1).toLowerCase() : ''], ['Address', customer.address], ['City', customer.city], ['State', customer.state], ['Postal code', customer.postalCode], ['Country', customer.country], ['Status', customer.status ? customer.status.charAt(0)+customer.status.slice(1).toLowerCase() : ''], ['KYC status (recorded)', customer.kycStatus], ['Notes', customer.notes]] : [];
  return createPortal(<div style={{ zIndex: layer }} className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Customer Profile" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-8"><div className="flex items-center gap-2"><User className="h-5 w-5 text-emerald-800" /><div><h2 className="text-xl sm:text-2xl font-bold text-slate-950">Customer Profile</h2><p className="text-sm text-slate-600">{canView && !isError ? customer?.fullName : ''}</p></div></div><button type="button" className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="Close customer profile" onClick={onClose}><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
        {!canView ? <p>Customer profile access is restricted.</p> : isPending ? <p role="status">Loading customer...</p> : isError ? <p role="alert">Could not load customer. <button onClick={() => refetch()}>Retry</button></p> : <><p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Profile fields and KYC status show recorded data. Imported placeholders may need correction; recorded verification does not confirm that current digital documents are available.</p><dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0 rounded-2xl bg-slate-100 p-4"><dt className="text-sm text-slate-600">{label}</dt><dd className="mt-1 break-words text-base font-semibold text-slate-900">{value || 'Not recorded'}</dd></div>)}</dl></>}
      </div>
      <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-8"><Button variant="outline" onClick={onClose}>Close</Button><div className="flex flex-wrap gap-2">{canView && canViewInvoices && customer && !isError && <Button variant="outline" onClick={onInvoices}>Invoices</Button>}{onKyc && canView && canViewKyc && customer && !isError && <Button variant="outline" onClick={onKyc}>KYC documents</Button>}{customer && !isError && canView && canEdit && <Button className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => setEditing(true)}>Edit customer</Button>}</div></footer>
    </div>
  </div>, document.body);
}

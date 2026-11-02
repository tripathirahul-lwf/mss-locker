import { useEffect,useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { LockerKycPanel,LockerKycPanelProps } from './LockerKycPanel';
interface Props extends LockerKycPanelProps { busy: boolean; layer?: number; onClose: () => void }
export function LockerKycModal({ busy, onClose, layer = 110, ...panel }: Props) {
  const root = useRef<HTMLDivElement>(null), live = useRef({ busy, onClose }); live.current = { busy, onClose };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => root.current?.focus());
    const handler = (event: KeyboardEvent) => {
      if (Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).at(-1) !== root.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!live.current.busy) live.current.onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]') || []).filter(control => control.getClientRects().length);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current || !root.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current || !root.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler, true);
    // The underlying locker dossier owns the body scroll lock, including initial KYC opens.
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handler, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<div style={{zIndex:layer}} className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6">
    <div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="locker-kyc-popup-title" className="flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl outline-none">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-5 sm:px-7"><div><h2 id="locker-kyc-popup-title" className="text-xl font-extrabold text-slate-950 sm:text-2xl">KYC &amp; ID documents</h2><p className="mt-1 text-sm text-slate-600">{panel.customerName || 'Customer'}{panel.customerCode ? ` - ${panel.customerCode}` : ''}</p></div><button type="button" aria-label="Close KYC popup" disabled={busy} onClick={onClose} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7"><LockerKycPanel {...panel} confirmationLayer={layer+10} /></div>
      <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button></footer>
    </div>
  </div>, document.body);
}

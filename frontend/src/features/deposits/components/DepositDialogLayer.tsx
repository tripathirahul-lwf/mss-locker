import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import { ReactNode,useEffect,useRef } from 'react';
import { createPortal } from 'react-dom';
export function DepositDialogLayer({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null), live = useRef({ busy, onClose }); live.current = { busy, onClose };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const releaseScroll = lockBodyScroll(); root.current?.focus();
    const handler = (event: KeyboardEvent) => {
      if (Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]')).at(-1) !== root.current) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!live.current.busy) live.current.onClose(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)') || []).filter(el => el.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handler, true);
    return () => { document.removeEventListener('keydown', handler, true); releaseScroll(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[140] outline-none"><fieldset disabled={busy} className="contents">{children}</fieldset></div>, document.body);
}

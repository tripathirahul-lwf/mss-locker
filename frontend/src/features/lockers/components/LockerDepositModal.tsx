import { lockBodyScroll } from '../../../utils/bodyScrollLock';
import { ReactNode,useEffect,useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
export function LockerDepositModal({children,onClose,busy}:{children:ReactNode;onClose:()=>void;busy:boolean}) {
 const root=useRef<HTMLDivElement>(null),live=useRef({onClose,busy});live.current={onClose,busy};
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;const releaseScroll = lockBodyScroll();root.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(Array.from(document.querySelectorAll('[role="dialog"],[role="alertdialog"]')).at(-1)!==root.current)return;
   if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(!live.current.busy)live.current.onClose();}
   if(e.key!=='Tab')return;
   const items=Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')||[]).filter(el=>el.getClientRects().length),first=items[0],last=items.at(-1);
   if(!first){e.preventDefault();return;}
   if(e.shiftKey&&(document.activeElement===first||document.activeElement===root.current)){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===root.current)){e.preventDefault();first.focus();}
  };document.addEventListener('keydown',key,true);
  return()=>{document.removeEventListener('keydown',key,true);releaseScroll();if(previous?.isConnected)previous.focus();};
 },[]);
 return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6"><div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Deposit & Refunds" className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl outline-none"><header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-8"><h2 className="text-xl font-bold text-slate-950 sm:text-2xl">Deposit &amp; Refunds</h2><button type="button" aria-label="Close deposit popup" disabled={busy} onClick={onClose} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"><X className="h-5 w-5"/></button></header><div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">{children}</div><footer className="border-t border-slate-100 bg-slate-50 px-5 py-4 sm:px-8"><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button></footer></div></div>;
}

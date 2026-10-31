import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { closureApi } from '../../closures/api/closureApi';
import { CloseLockerModal } from './CloseLockerModal';
import { ClosureDetailModal } from '../../closures/components/ClosureDetailModal';
import { ClosureStatementModal } from '../../closures/components/ClosureStatementModal';
import { LockerClosure } from '../../closures/types';
import { Button } from '../../../components/ui/button';

export function LockerClosureFlow({ lockerId, allocationId, onClose, onPayments, onDeposits, onCompleted }: { lockerId: string; allocationId: string; onClose: () => void; onPayments: (id?: string) => void; onDeposits: () => void; onCompleted: () => void }) {
  const { user, permissions, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [statement, setStatement] = useState<LockerClosure | null>(null);
  const refreshing = useRef(false);

  const canView = hasPermission('closures.view');
  const query = useQuery({ queryKey: ['locker-closures', lockerId, allocationId], queryFn: async () => {
    const result = await closureApi.getClosures({ lockerId, allocationId, limit: 100 });
    const found = result.closures.find(item => (typeof item.allocationId === 'string' ? item.allocationId : item.allocationId?._id) === allocationId && !['CANCELLED', 'REJECTED'].includes(item.status));
    return found ? closureApi.getClosureById(found._id) : null;
  }, enabled: canView, staleTime: 0, refetchOnMount: 'always' });
  const refresh = async () => {
    refreshing.current = true;
    try {
      const result = await query.refetch();
      await Promise.all(['locker-allocations', 'lockers', 'locker-stats', 'deposit-summary', 'locker-invoices', 'closed-locker-records', 'closure-stats', 'closures'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      if (result.data?.status === 'COMPLETED') onCompleted();
    } finally { refreshing.current = false; }
  };
  if (canView && (query.isFetching || query.isError)) return <ClosureLoadingDialog failed={query.isError} retry={() => void query.refetch()} onClose={onClose} />;
  if (statement) return <ClosureStatementModal isOpen closure={statement} onClose={() => setStatement(null)} />;
  if (query.data) return <ClosureDetailModal isOpen closure={query.data} currentUserId={user?.id} userPermissions={permissions} onClose={() => { if (!refreshing.current) onClose(); }} onRefresh={() => { void refresh(); }} onPrint={setStatement} onNavigateToPayments={onPayments} onNavigateToDeposits={onDeposits} />;
  return <CloseLockerModal allocationId={allocationId} onClose={onClose} onDeposits={onDeposits} onPayments={onPayments} onSuccess={() => { void refresh(); }} />;
}

function ClosureLoadingDialog({ failed, retry, onClose }: { failed: boolean; retry: () => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null), live = useRef(onClose); live.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null; root.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); live.current(); }
      if (e.key === 'Tab') {
        const controls = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button') || []);
        if (e.shiftKey && (document.activeElement === controls[0] || document.activeElement === root.current)) { e.preventDefault(); controls.at(-1)?.focus(); }
        else if (!e.shiftKey && (document.activeElement === controls.at(-1) || document.activeElement === root.current)) { e.preventDefault(); controls[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', handler, true);
    return () => { document.removeEventListener('keydown', handler, true); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4"><div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Locker closure" className="space-y-4 rounded-2xl bg-white p-6"><p role={failed ? 'alert' : 'status'}>{failed ? 'Could not load locker closure.' : 'Loading locker closure...'}</p>{failed && <Button onClick={retry}>Retry</Button>}<Button onClick={onClose}>Close</Button></div></div>, document.body);
}

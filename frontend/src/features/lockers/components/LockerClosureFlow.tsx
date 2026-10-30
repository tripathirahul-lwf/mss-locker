import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../context/AuthContext';
import { closureApi } from '../../closures/api/closureApi';
import { NewClosureWizard } from '../../closures/components/NewClosureWizard';
import { ClosureDetailModal } from '../../closures/components/ClosureDetailModal';
import { ClosureStatementModal } from '../../closures/components/ClosureStatementModal';
import { LockerClosure } from '../../closures/types';
import { Button } from '../../../components/ui/button';

export function LockerClosureFlow({ lockerId, allocationId, onClose, onPayments, onDeposits, onCompleted }: { lockerId: string; allocationId: string; onClose: () => void; onPayments: (id?: string) => void; onDeposits: () => void; onCompleted: () => void }) {
  const { user, permissions, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [statement, setStatement] = useState<LockerClosure | null>(null);
  const refreshing = useRef(false);
  const created = useRef(false);
  const canView = hasPermission('closures.view');
  const query = useQuery({ queryKey: ['locker-closures', lockerId, allocationId], queryFn: async () => {
    const result = await closureApi.getClosures({ lockerId, limit: 100 });
    return result.closures.find(item => (typeof item.allocationId === 'string' ? item.allocationId : item.allocationId?._id) === allocationId && !['CANCELLED', 'REJECTED'].includes(item.status)) || null;
  }, enabled: canView, staleTime: 0, refetchOnMount: 'always' });
  const refresh = async () => {
    refreshing.current = true;
    try {
      const result = await query.refetch();
      await Promise.all(['locker-allocations', 'lockers', 'locker-stats', 'deposit-summary', 'locker-invoices'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      if (result.data?.status === 'COMPLETED') onCompleted();
    } finally { refreshing.current = false; }
  };
  if (canView && (query.isFetching || query.isError)) return createPortal(<div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/60 p-4"><div role="dialog" aria-modal="true" aria-label="Locker closure" className="space-y-4 rounded-2xl bg-white p-6"><p role={query.isError ? 'alert' : 'status'}>{query.isError ? 'Could not load locker closure.' : 'Loading locker closure...'}</p>{query.isError && <Button onClick={() => query.refetch()}>Retry</Button>}<Button onClick={onClose}>Close</Button></div></div>, document.body);
  if (statement) return <ClosureStatementModal isOpen closure={statement} onClose={() => setStatement(null)} />;
  if (query.data) return <ClosureDetailModal isOpen closure={query.data} currentUserId={user?.id} userPermissions={permissions} onClose={() => { if (!refreshing.current) onClose(); }} onRefresh={() => { void refresh(); }} onPrint={setStatement} onNavigateToPayments={onPayments} onNavigateToDeposits={onDeposits} />;
  return <NewClosureWizard isOpen lockTarget initialLockerId={lockerId} initialAllocationId={allocationId} onClose={() => { if (created.current) { created.current = false; return; } onClose(); }} onSuccess={() => { if (!canView) { onClose(); return; } created.current = true; void refresh(); }} />;
}

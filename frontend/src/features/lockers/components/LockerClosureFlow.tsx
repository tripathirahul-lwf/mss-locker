import { useQueryClient } from '@tanstack/react-query';
import { CloseLockerModal } from './CloseLockerModal';

export function LockerClosureFlow({ allocationId, onClose, onPayments, onDeposits, onCompleted }: { lockerId: string; allocationId: string; onClose: () => void; onPayments: (id?: string) => void; onDeposits: () => void; onCompleted: () => void }) {
  const queryClient = useQueryClient();
  return <CloseLockerModal allocationId={allocationId} onClose={onClose} onDeposits={onDeposits} onPayments={onPayments} onSuccess={() => {
    void Promise.all(['locker-allocations', 'allocation', 'lockers', 'locker-stats', 'deposit-summary', 'locker-invoices', 'locker-payments', 'locker-refunds', 'closed-locker-records', 'closure-stats', 'closures', 'locker-closures', 'customers'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    onCompleted();
  }} />;
}

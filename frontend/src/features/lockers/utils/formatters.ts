import { Locker } from '../types';

/**
 * Format numeric currency amount in Indian Rupee format cleanly.
 * Example: 45000 -> ₹45,000
 */
export function formatINR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '₹ 0';
  }
  return `₹ ${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Centralized frontend helper for locker allocation readiness.
 */
export function isLockerAvailable(
  locker: Pick<Locker, 'status' | 'operationalStatus' | 'isActive'>
): boolean {
  return (
    locker.status === 'VACANT' &&
    locker.operationalStatus === 'ACTIVE' &&
    locker.isActive === true
  );
}

export type DepositTransactionType =
  | 'DEPOSIT_RECEIVED'
  | 'DEPOSIT_ADJUSTMENT_ADD'
  | 'DEPOSIT_ADJUSTMENT_DEDUCT'
  | 'REFUND_ISSUED'
  | 'REFUND_REVERSAL'
  | 'LEGACY_IMPORT';

export type DepositTransactionStatus = 'COMPLETED' | 'PENDING' | 'CANCELLED' | 'FAILED';

export type RefundStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'CANCELLED';

export type DepositStatus =
  | 'NOT_COLLECTED'
  | 'PARTIAL'
  | 'FULLY_COLLECTED'
  | 'OVER_COLLECTED';

export const DEPOSIT_TRANSACTION_TYPES: {
  value: DepositTransactionType;
  label: string;
  isCredit: boolean;
}[] = [
  { value: 'DEPOSIT_RECEIVED', label: 'Deposit Received', isCredit: true },
  { value: 'DEPOSIT_ADJUSTMENT_ADD', label: 'Deposit Add Adjustment', isCredit: true },
  { value: 'DEPOSIT_ADJUSTMENT_DEDUCT', label: 'Damage/Penalty Deduction', isCredit: false },
  { value: 'REFUND_ISSUED', label: 'Refund Disbursed', isCredit: false },
  { value: 'REFUND_REVERSAL', label: 'Refund Reversal', isCredit: true },
  { value: 'LEGACY_IMPORT', label: 'Legacy Opening Deposit', isCredit: true },
];

export const REFUND_STATUSES: {
  value: RefundStatus;
  label: string;
  variant: 'default' | 'outline' | 'secondary' | 'destructive' | 'success' | 'warning';
}[] = [
  { value: 'DRAFT', label: 'Draft', variant: 'outline' },
  { value: 'PENDING_APPROVAL', label: 'Pending Approval', variant: 'warning' },
  { value: 'APPROVED', label: 'Approved for Payment', variant: 'secondary' },
  { value: 'REJECTED', label: 'Rejected', variant: 'destructive' },
  { value: 'PAID', label: 'Disbursed / Paid', variant: 'success' },
  { value: 'CANCELLED', label: 'Cancelled', variant: 'destructive' },
];

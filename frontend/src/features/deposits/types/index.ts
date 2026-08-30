import { PaymentMethod } from '../../payments/types';

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

export interface DepositSummary {
  allocationId: string;
  allocationCode: string;
  lockerNumber: string;
  customerName: string;
  requiredDeposit: number;
  totalDepositReceived: number;
  totalAddAdjustments: number;
  totalDeductAdjustments: number;
  totalRefunded: number;
  netDepositHeld: number;
  pendingRefundAmount: number;
  availableRefundableBalance: number;
  outstandingDeposit: number;
  depositStatus: DepositStatus;
}

export interface DepositTransaction {
  _id: string;
  depositTransactionNumber: string;
  customerId: {
    _id: string;
    fullName: string;
    customerCode: string;
    phone: string;
    email?: string;
    address?: string;
  };
  allocationId: {
    _id: string;
    allocationCode: string;
    startDate: string;
    billingCycle?: string;
    depositSnapshot?: number;
    securityDeposit?: number;
  };
  lockerId: {
    _id: string;
    lockerNumber: string;
    size: string;
    rackNumber?: string;
    section?: string;
    floor?: string;
  };
  transactionType: DepositTransactionType;
  amount: number;
  paymentId?: {
    _id: string;
    paymentNumber: string;
    receiptNumber: string;
    paymentDate: string;
    paymentMethod: PaymentMethod;
    amount: number;
  };
  paymentMethod?: PaymentMethod;
  transactionReference?: string;
  transactionDate: string;
  status: DepositTransactionStatus;
  source: string;
  notes?: string;
  recordedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  cancelledAt?: string;
  cancelledBy?: {
    _id: string;
    name: string;
    email: string;
  };
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequest {
  _id: string;
  refundNumber: string;
  customerId: {
    _id: string;
    fullName: string;
    customerCode: string;
    phone: string;
    email?: string;
    address?: string;
  };
  allocationId: {
    _id: string;
    allocationCode: string;
    startDate: string;
    billingCycle?: string;
    depositSnapshot?: number;
    securityDeposit?: number;
  };
  lockerId: {
    _id: string;
    lockerNumber: string;
    size: string;
    rackNumber?: string;
  };
  requestedAmount: number;
  approvedAmount?: number;
  reason: string;
  status: RefundStatus;
  requestedBy: {
    _id: string;
    name: string;
    email: string;
  };
  requestedAt: string;
  approvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  approvedAt?: string;
  rejectedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  rejectedAt?: string;
  rejectionReason?: string;
  paidAt?: string;
  paidBy?: {
    _id: string;
    name: string;
    email: string;
  };
  refundPaymentMethod?: PaymentMethod;
  transactionReference?: string;
  notes?: string;
  cancelledAt?: string;
  cancelledBy?: {
    _id: string;
    name: string;
  };
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepositStats {
  totalDepositsHeld: number;
  collectedToday: number;
  collectedThisMonth: number;
  refundedToday: number;
  refundedThisMonth: number;
  pendingRefundCount: number;
  pendingRefundAmount: number;
}

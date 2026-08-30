import { Schema, model, Document, Types } from 'mongoose';
import {
  DepositTransactionType,
  DepositTransactionStatus,
} from '../constants/deposit.constants';
import { PaymentMethod, PaymentSource } from '../constants/payment.constants';

export interface IDepositTransaction extends Document {
  _id: Types.ObjectId;
  depositTransactionNumber: string;

  customerId: Types.ObjectId;
  allocationId: Types.ObjectId;
  lockerId: Types.ObjectId;

  transactionType: DepositTransactionType;
  amount: number;

  paymentId?: Types.ObjectId;
  paymentMethod?: PaymentMethod;
  transactionReference?: string;

  transactionDate: Date;
  status: DepositTransactionStatus;

  source: PaymentSource;
  notes?: string;

  recordedBy?: Types.ObjectId;

  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const depositTransactionSchema = new Schema<IDepositTransaction>(
  {
    depositTransactionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    allocationId: {
      type: Schema.Types.ObjectId,
      ref: 'LockerAllocation',
      required: true,
      index: true,
    },
    lockerId: {
      type: Schema.Types.ObjectId,
      ref: 'Locker',
      required: true,
      index: true,
    },
    transactionType: {
      type: String,
      enum: [
        'DEPOSIT_RECEIVED',
        'DEPOSIT_ADJUSTMENT_ADD',
        'DEPOSIT_ADJUSTMENT_DEDUCT',
        'REFUND_ISSUED',
        'REFUND_REVERSAL',
        'LEGACY_IMPORT',
      ],
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Transaction amount must be greater than 0'],
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'],
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'CANCELLED', 'FAILED'],
      default: 'COMPLETED',
      index: true,
    },
    source: {
      type: String,
      enum: ['COUNTER', 'MANUAL_ENTRY', 'LEGACY_IMPORT', 'SYSTEM'],
      default: 'COUNTER',
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Performance & ledger query indexes
depositTransactionSchema.index({ allocationId: 1, status: 1 });
depositTransactionSchema.index({ customerId: 1, transactionDate: -1 });
depositTransactionSchema.index({ lockerId: 1, transactionDate: -1 });
depositTransactionSchema.index({ transactionType: 1, status: 1 });

export const DepositTransaction = model<IDepositTransaction>(
  'DepositTransaction',
  depositTransactionSchema
);

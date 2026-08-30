import { Schema, model, Document, Types } from 'mongoose';
import { RefundStatus } from '../constants/deposit.constants';
import { PaymentMethod } from '../constants/payment.constants';

export interface IRefundRequest extends Document {
  _id: Types.ObjectId;
  refundNumber: string;

  customerId: Types.ObjectId;
  allocationId: Types.ObjectId;
  lockerId: Types.ObjectId;

  requestedAmount: number;
  approvedAmount?: number;

  reason: string;
  status: RefundStatus;

  requestedBy: Types.ObjectId;
  requestedAt: Date;

  approvedBy?: Types.ObjectId;
  approvedAt?: Date;

  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;

  paidAt?: Date;
  paidBy?: Types.ObjectId;
  refundPaymentMethod?: PaymentMethod;
  transactionReference?: string;

  notes?: string;

  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const refundRequestSchema = new Schema<IRefundRequest>(
  {
    refundNumber: {
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
    requestedAmount: {
      type: Number,
      required: true,
      min: [0.01, 'Requested refund amount must be greater than 0'],
    },
    approvedAmount: {
      type: Number,
      min: [0, 'Approved refund amount cannot be negative'],
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'PAID',
        'CANCELLED',
      ],
      default: 'PENDING_APPROVAL',
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    paidAt: {
      type: Date,
    },
    paidBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    refundPaymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'],
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
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

// Performance indexes
refundRequestSchema.index({ allocationId: 1, status: 1 });
refundRequestSchema.index({ customerId: 1, createdAt: -1 });
refundRequestSchema.index({ status: 1, requestedAt: -1 });

export const RefundRequest = model<IRefundRequest>(
  'RefundRequest',
  refundRequestSchema
);

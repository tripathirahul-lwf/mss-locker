import { Schema, model, Document, Types } from 'mongoose';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentSource,
  PaymentPurpose,
} from '../constants/payment.constants';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  paymentNumber: string;
  receiptNumber: string;
  idempotencyKey?: string;

  customerId: Types.ObjectId;
  allocationId: Types.ObjectId;
  lockerId: Types.ObjectId;
  invoiceId?: Types.ObjectId;

  paymentPurpose: PaymentPurpose;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;

  // Method specific reference details (no full card details stored)
  billNumber?: string;
  transactionReference?: string;
  bankReference?: string;
  upiReference?: string;
  chequeNumber?: string;
  bankName?: string;
  chequeDate?: Date;

  proofUrl?: string;
  proofDocumentName?: string;

  paymentDate: Date;
  receivedAt: Date;

  source: PaymentSource;
  legacyReference?: string;
  notes?: string;

  recordedBy?: Types.ObjectId;

  // Cancellation metadata
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      sparse: true,
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
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'LockerInvoice',
      index: true,
    },
    paymentPurpose: {
      type: String,
      enum: ['INVOICE_PAYMENT', 'SECURITY_DEPOSIT', 'REFUND', 'OTHER'],
      default: 'INVOICE_PAYMENT',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Payment amount must be greater than 0'],
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER'],
      required: true,
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'FAILED', 'CANCELLED'],
      default: 'COMPLETED',
      index: true,
    },
    billNumber: {
      type: String,
      trim: true,
      index: true,
    },
    transactionReference: {
      type: String,
      trim: true,
    },
    bankReference: {
      type: String,
      trim: true,
    },
    upiReference: {
      type: String,
      trim: true,
    },
    chequeNumber: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    chequeDate: {
      type: Date,
    },
    proofUrl: {
      type: String,
      trim: true,
    },
    proofDocumentName: {
      type: String,
      trim: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    source: {
      type: String,
      enum: ['COUNTER', 'MANUAL_ENTRY', 'LEGACY_IMPORT', 'SYSTEM'],
      default: 'COUNTER',
    },
    legacyReference: {
      type: String,
      trim: true,
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

// Performance indexes
paymentSchema.index({ invoiceId: 1, paymentStatus: 1 });
paymentSchema.index({ customerId: 1, paymentDate: -1 });
paymentSchema.index({ lockerId: 1, paymentDate: -1 });
paymentSchema.index({ paymentDate: -1, paymentStatus: 1 });

export const Payment = model<IPayment>('Payment', paymentSchema);

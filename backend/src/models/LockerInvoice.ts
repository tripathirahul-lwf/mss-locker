import { Schema, model, Document, Types } from 'mongoose';
import {
  InvoiceType,
  InvoiceStatus,
  PaymentStatus,
  DueStatus,
  BillingCycle,
  InvoiceSource,
} from '../constants/billing.constants';

export interface ILockerInvoice extends Document {
  _id: Types.ObjectId;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  allocationId: Types.ObjectId;
  customerId: Types.ObjectId;
  lockerId: Types.ObjectId;

  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  issueDate: Date;
  dueDate: Date;
  billingCycle: BillingCycle;

  // Financial Snapshots
  baseRent: number;
  lateFee: number;
  discount: number;
  otherCharges: number;
  taxAmount: number;
  subtotal: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;

  // Lifecycle & Due State
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  dueStatus: DueStatus;
  source: InvoiceSource;

  // Metadata
  legacyReference?: string;
  legacyInvoiceNumber?: string;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;

  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lockerInvoiceSchema = new Schema<ILockerInvoice>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    invoiceType: {
      type: String,
      enum: ['NEW_ALLOCATION', 'RENEWAL', 'ADJUSTMENT', 'LEGACY_IMPORT'],
      required: true,
      index: true,
    },
    allocationId: {
      type: Schema.Types.ObjectId,
      ref: 'LockerAllocation',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    lockerId: {
      type: Schema.Types.ObjectId,
      ref: 'Locker',
      required: true,
      index: true,
    },
    billingPeriodStart: {
      type: Date,
      required: true,
      index: true,
    },
    billingPeriodEnd: {
      type: Date,
      required: true,
      index: true,
    },
    issueDate: {
      type: Date,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    billingCycle: {
      type: String,
      enum: ['ANNUAL', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'CUSTOM'],
      default: 'ANNUAL',
    },
    baseRent: {
      type: Number,
      required: true,
      min: 0,
    },
    lateFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    otherCharges: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PAID', 'CANCELLED'],
      default: 'ISSUED',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
      default: 'UNPAID',
      index: true,
    },
    dueStatus: {
      type: String,
      enum: ['UPCOMING', 'DUE_TODAY', 'OVERDUE'],
      default: 'UPCOMING',
      index: true,
    },
    source: {
      type: String,
      enum: ['SYSTEM', 'MANUAL', 'LEGACY_IMPORT'],
      default: 'SYSTEM',
    },
    legacyReference: {
      type: String,
      trim: true,
    },
    legacyInvoiceNumber: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast operational queries and duplicate renewal protection
lockerInvoiceSchema.index(
  { allocationId: 1, billingPeriodStart: 1, billingPeriodEnd: 1, invoiceType: 1 },
  { unique: false }
);
lockerInvoiceSchema.index({ customerId: 1, paymentStatus: 1, dueDate: 1 });
lockerInvoiceSchema.index({ lockerId: 1, status: 1 });
lockerInvoiceSchema.index({ paymentStatus: 1, dueStatus: 1, dueDate: 1 });

export const LockerInvoice = model<ILockerInvoice>('LockerInvoice', lockerInvoiceSchema);

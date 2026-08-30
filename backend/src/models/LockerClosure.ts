import { Schema, model, Document, Types } from 'mongoose';
import {
  ClosureType,
  CLOSURE_TYPES,
  ClosureStatus,
  CLOSURE_STATUSES,
  LockerCondition,
  LOCKER_CONDITIONS,
} from '../constants/closure.constants';

export interface IPhysicalChecklist {
  lockerEmptied: boolean;
  lockerInspected: boolean;
  lockerCondition: LockerCondition;
  customerKeyReturned: boolean;
  masterKeyCheckCompleted: boolean;
  documentsReturned: boolean;
  physicalAccessRevoked: boolean;
  damageNotes?: string;
  keyReplacementRequired?: boolean;
}

export interface IClosureFinancialSnapshot {
  totalInvoices: number;
  totalBilled: number;
  totalPaid: number;
  outstandingAtClosure: number;
  depositRequired: number;
  depositCollected: number;
  depositDeductions: number;
  depositRefunded: number;
  depositBalanceAtClosure: number;
  snapshotCapturedAt: Date;
}

export interface ILockerClosure extends Document {
  _id: Types.ObjectId;
  closureNumber: string;

  allocationId: Types.ObjectId;
  customerId: Types.ObjectId;
  lockerId: Types.ObjectId;

  closureType: ClosureType;
  closureReason: string;

  status: ClosureStatus;

  requestedClosureDate: Date;
  actualClosureDate?: Date;

  financialSnapshot?: IClosureFinancialSnapshot;
  physicalChecklist: IPhysicalChecklist;

  settlementNotes?: string;
  notes?: string;

  // Maker-Checker audit fields
  requestedBy: Types.ObjectId;
  requestedAt: Date;

  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;

  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  approvalNotes?: string;

  completedBy?: Types.ObjectId;
  completedAt?: Date;
  completionNotes?: string;

  rejectedBy?: Types.ObjectId;
  rejectedAt?: Date;
  rejectionReason?: string;

  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancellationReason?: string;

  // Override flags
  overrideFinancial?: boolean;
  overrideReason?: string;
  overriddenBy?: Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const physicalChecklistSchema = new Schema<IPhysicalChecklist>(
  {
    lockerEmptied: { type: Boolean, default: false },
    lockerInspected: { type: Boolean, default: false },
    lockerCondition: {
      type: String,
      enum: Object.values(LOCKER_CONDITIONS),
      default: LOCKER_CONDITIONS.GOOD,
    },
    customerKeyReturned: { type: Boolean, default: false },
    masterKeyCheckCompleted: { type: Boolean, default: false },
    documentsReturned: { type: Boolean, default: false },
    physicalAccessRevoked: { type: Boolean, default: false },
    damageNotes: { type: String, trim: true, default: '' },
    keyReplacementRequired: { type: Boolean, default: false },
  },
  { _id: false }
);

const closureFinancialSnapshotSchema = new Schema<IClosureFinancialSnapshot>(
  {
    totalInvoices: { type: Number, default: 0 },
    totalBilled: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    outstandingAtClosure: { type: Number, default: 0 },
    depositRequired: { type: Number, default: 0 },
    depositCollected: { type: Number, default: 0 },
    depositDeductions: { type: Number, default: 0 },
    depositRefunded: { type: Number, default: 0 },
    depositBalanceAtClosure: { type: Number, default: 0 },
    snapshotCapturedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const lockerClosureSchema = new Schema<ILockerClosure>(
  {
    closureNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
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
    closureType: {
      type: String,
      enum: Object.values(CLOSURE_TYPES),
      default: CLOSURE_TYPES.NORMAL,
      index: true,
    },
    closureReason: {
      type: String,
      required: true,
      trim: true,
      maxlength: [1000, 'Closure reason cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: Object.values(CLOSURE_STATUSES),
      default: CLOSURE_STATUSES.DRAFT,
      index: true,
    },
    requestedClosureDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    actualClosureDate: {
      type: Date,
    },
    financialSnapshot: {
      type: closureFinancialSnapshotSchema,
    },
    physicalChecklist: {
      type: physicalChecklistSchema,
      default: () => ({}),
    },
    settlementNotes: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
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
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      trim: true,
      default: '',
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    approvalNotes: {
      type: String,
      trim: true,
      default: '',
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: {
      type: Date,
    },
    completionNotes: {
      type: String,
      trim: true,
      default: '',
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
      default: '',
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    overrideFinancial: {
      type: Boolean,
      default: false,
    },
    overrideReason: {
      type: String,
      trim: true,
      default: '',
    },
    overriddenBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// High-performance operational compound indexes
lockerClosureSchema.index({ allocationId: 1, status: 1 });
lockerClosureSchema.index({ customerId: 1, status: 1 });
lockerClosureSchema.index({ lockerId: 1, status: 1 });
lockerClosureSchema.index({ status: 1, requestedAt: -1 });
lockerClosureSchema.index({ createdAt: -1 });

export const LockerClosure = model<ILockerClosure>(
  'LockerClosure',
  lockerClosureSchema
);

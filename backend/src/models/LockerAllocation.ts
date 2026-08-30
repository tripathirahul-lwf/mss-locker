import { Schema, model, Document, Types } from 'mongoose';
import {
  AllocationStatus,
  ALLOCATION_STATUS,
  AllocationType,
  ALLOCATION_TYPE,
  BillingCycle,
  BILLING_CYCLE,
} from '../constants/allocation.constants';

export interface ILockerAllocation extends Document {
  _id: Types.ObjectId;
  allocationCode: string;
  customerId: Types.ObjectId;
  lockerId: Types.ObjectId;
  startDate: Date;
  endDate?: Date;
  billingCycle: BillingCycle;
  annualRent: number;
  securityDeposit: number;
  rentSnapshot: number;
  depositSnapshot: number;
  status: AllocationStatus;
  allocationType: AllocationType;
  reservationExpiresAt?: Date;
  paidThroughDate?: Date;
  nextRenewalDueDate?: Date;
  lastRenewedAt?: Date;
  remarks?: string;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  activatedAt?: Date;
  activatedBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  closedAt?: Date;
  closedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lockerAllocationSchema = new Schema<ILockerAllocation>(
  {
    allocationCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer ID is required'],
      index: true,
    },
    lockerId: {
      type: Schema.Types.ObjectId,
      ref: 'Locker',
      required: [true, 'Locker ID is required'],
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Agreement start date is required'],
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    billingCycle: {
      type: String,
      enum: Object.values(BILLING_CYCLE),
      default: BILLING_CYCLE.ANNUAL,
    },
    annualRent: {
      type: Number,
      required: [true, 'Annual rent tariff is required'],
      min: [0, 'Annual rent cannot be negative'],
    },
    securityDeposit: {
      type: Number,
      required: [true, 'Security caution deposit is required'],
      min: [0, 'Security deposit cannot be negative'],
    },
    rentSnapshot: {
      type: Number,
      required: [true, 'Rent financial snapshot is required'],
      min: 0,
    },
    depositSnapshot: {
      type: Number,
      required: [true, 'Deposit financial snapshot is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(ALLOCATION_STATUS),
      default: ALLOCATION_STATUS.ACTIVE,
      index: true,
    },
    allocationType: {
      type: String,
      enum: Object.values(ALLOCATION_TYPE),
      default: ALLOCATION_TYPE.NEW,
    },
    reservationExpiresAt: {
      type: Date,
    },
    paidThroughDate: {
      type: Date,
      index: true,
    },
    nextRenewalDueDate: {
      type: Date,
      index: true,
    },
    lastRenewedAt: {
      type: Date,
    },
    remarks: {
      type: String,
      default: '',
      trim: true,
      maxlength: [1000, 'Remarks cannot exceed 1000 characters'],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    activatedAt: {
      type: Date,
    },
    activatedBy: {
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
    closedAt: {
      type: Date,
    },
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Compound performance indexes
lockerAllocationSchema.index({ lockerId: 1, status: 1 });
lockerAllocationSchema.index({ customerId: 1, status: 1 });
lockerAllocationSchema.index({ status: 1, startDate: -1 });
lockerAllocationSchema.index({ createdAt: -1 });

export const LockerAllocation = model<ILockerAllocation>(
  'LockerAllocation',
  lockerAllocationSchema
);

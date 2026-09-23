import { Schema, model, Document, Types } from 'mongoose';
import { LockerStatus, OperationalStatus } from '../constants/locker.constants';

export interface ILocker extends Document {
  _id: Types.ObjectId;
  lockerNumber: string;
  lockerCode: string;
  size: string;
  rackNumber: string;
  section?: string;
  floor?: string;
  position?: string;
  masterKeyReference?: string;
  annualRent: number;
  securityDeposit: number;
  status: LockerStatus;
  operationalStatus: OperationalStatus;
  remarks?: string;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lockerSchema = new Schema<ILocker>(
  {
    lockerNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    lockerCode: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    size: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    rackNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    section: {
      type: String,
      trim: true,
      default: '',
    },
    floor: {
      type: String,
      trim: true,
      default: 'Ground Floor',
    },
    position: {
      type: String,
      trim: true,
      default: '',
    },
    masterKeyReference: {
      type: String,
      trim: true,
      default: '',
    },
    annualRent: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    securityDeposit: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    status: {
      type: String,
      enum: ['VACANT', 'RESERVED', 'OCCUPIED', 'BLOCKED'],
      default: 'VACANT',
      index: true,
    },
    operationalStatus: {
      type: String,
      enum: ['ACTIVE', 'MAINTENANCE', 'DAMAGED', 'DECOMMISSIONED'],
      default: 'ACTIVE',
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

// Compound indexes for fast operational queries and allocation searches
lockerSchema.index({ status: 1, size: 1 });
lockerSchema.index({ rackNumber: 1, status: 1 });
lockerSchema.index({ isActive: 1, status: 1, operationalStatus: 1 });
lockerSchema.index({ lockerNumber: 1 }, { collation: { locale: 'en', numericOrdering: true } });

export const Locker = model<ILocker>('Locker', lockerSchema);

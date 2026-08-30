import { Schema, model, Document, Types } from 'mongoose';
import { CustomerStatus, KycStatus } from '../constants/customer.constants';

export interface ICustomer extends Document {
  _id: Types.ObjectId;
  customerCode: string;
  fullName: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  photoUrl?: string;
  kycStatus: KycStatus;
  kycVerifiedAt?: Date;
  kycVerifiedBy?: Types.ObjectId;
  notes?: string;
  status: CustomerStatus;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    customerCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    firstName: {
      type: String,
      trim: true,
      default: '',
    },
    middleName: {
      type: String,
      trim: true,
      default: '',
    },
    lastName: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    dateOfBirth: {
      type: String,
      trim: true,
      default: '',
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHER'],
      default: 'OTHER',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    state: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    postalCode: {
      type: String,
      trim: true,
      default: '',
    },
    country: {
      type: String,
      trim: true,
      default: 'India',
    },
    photoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    kycStatus: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'VERIFIED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    kycVerifiedAt: {
      type: Date,
    },
    kycVerifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
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

customerSchema.index({ status: 1, kycStatus: 1 });
customerSchema.index({ createdAt: -1 });

export const Customer = model<ICustomer>('Customer', customerSchema);

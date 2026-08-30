import { Schema, model, Document, Types } from 'mongoose';
import {
  KycDocumentType,
  KycVerificationStatus,
} from '../constants/customer.constants';

export interface ICustomerKycDocument extends Document {
  _id: Types.ObjectId;
  customerId: Types.ObjectId;
  documentType: KycDocumentType;
  documentNumber: string;
  documentUrl: string;
  documentName?: string;
  mimeType?: string;
  fileSize?: number;
  verificationStatus: KycVerificationStatus;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  rejectionReason?: string;
  expiryDate?: Date;
  remarks?: string;
  isPrimary: boolean;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerKycDocumentSchema = new Schema<ICustomerKycDocument>(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      enum: ['AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'OTHER'],
      required: true,
    },
    documentNumber: {
      type: String,
      required: true,
      trim: true,
    },
    documentUrl: {
      type: String,
      required: true,
      trim: true,
    },
    documentName: {
      type: String,
      trim: true,
      default: '',
    },
    mimeType: {
      type: String,
      trim: true,
      default: 'image/jpeg',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    verifiedAt: {
      type: Date,
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    expiryDate: {
      type: Date,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    isPrimary: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

customerKycDocumentSchema.index({ customerId: 1, documentType: 1 });
customerKycDocumentSchema.index({ documentUrl: 1 }, { unique: true });

export const CustomerKycDocument = model<ICustomerKycDocument>(
  'CustomerKycDocument',
  customerKycDocumentSchema
);

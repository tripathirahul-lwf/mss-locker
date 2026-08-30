import { Schema, model, Document, Types } from 'mongoose';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'ROLE_CREATED'
  | 'ROLE_UPDATED'
  | 'PERMISSIONS_OVERRIDDEN'
  | 'LOCKER_CREATED'
  | 'LOCKER_UPDATED'
  | 'LOCKER_STATUS_CHANGED'
  | 'LOCKER_OPERATIONAL_STATUS_CHANGED'
  | 'LOCKER_DEACTIVATED'
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_STATUS_CHANGED'
  | 'CUSTOMER_DEACTIVATED'
  | 'KYC_DOCUMENT_ADDED'
  | 'KYC_DOCUMENT_UPDATED'
  | 'KYC_DOCUMENT_REMOVED'
  | 'KYC_VERIFIED'
  | 'KYC_REJECTED'
  | 'ALLOCATION_CREATED'
  | 'LOCKER_RESERVED'
  | 'RESERVATION_ACTIVATED'
  | 'RESERVATION_CANCELLED'
  | 'ALLOCATION_UPDATED'
  | 'INVOICE_GENERATED'
  | 'INVOICE_PDF_EXPORTED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_CANCELLED'
  | 'DEPOSIT_RECEIVED'
  | 'DEPOSIT_ADJUSTED'
  | 'DEPOSIT_TRANSACTION_CANCELLED'
  | 'REFUND_REQUEST_CREATED'
  | 'REFUND_SUBMITTED'
  | 'REFUND_APPROVED'
  | 'REFUND_REJECTED'
  | 'REFUND_PAID'
  | 'REFUND_CANCELLED'
  | 'SETTINGS_UPDATED'
  | 'TARIFF_REVISED';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actorUserId?: Types.ObjectId;
  actorUsername?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  module?: string;
  performedBy?: Types.ObjectId;
  details?: Record<string, unknown>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorUsername: {
      type: String,
      default: 'SYSTEM',
      trim: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      default: 'SYSTEM',
      index: true,
    },
    entityId: {
      type: String,
    },
    description: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    module: { type: String, index: true, trim: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);

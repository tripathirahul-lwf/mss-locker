import { Schema, model, Types } from 'mongoose';

export interface ISystemSetting {
  key: 'GLOBAL'; businessName: string; branchName: string; address: string; gstin: string;
  invoicePrefix: string; receiptPrefix: string; renewalReminderDays: number; offlineCacheHours: number;
  updatedBy?: Types.ObjectId; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<ISystemSetting>({
  key: { type: String, enum: ['GLOBAL'], unique: true, default: 'GLOBAL' },
  businessName: { type: String, trim: true, maxlength: 120, default: 'MSS Locker' },
  branchName: { type: String, trim: true, maxlength: 120, default: '' }, address: { type: String, trim: true, maxlength: 500, default: '' },
  gstin: { type: String, uppercase: true, trim: true, maxlength: 15, default: '' }, invoicePrefix: { type: String, uppercase: true, trim: true, maxlength: 12, default: 'INV' },
  receiptPrefix: { type: String, uppercase: true, trim: true, maxlength: 12, default: 'RCP' }, renewalReminderDays: { type: Number, min: 1, max: 365, default: 30 },
  offlineCacheHours: { type: Number, min: 1, max: 168, default: 24 }, updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
export const SystemSetting = model<ISystemSetting>('SystemSetting', schema);

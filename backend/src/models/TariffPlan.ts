import { Schema, model, Types } from 'mongoose';
export interface ITariffPlan { size: string; annualRent: number; securityDeposit: number; effectiveFrom: Date; effectiveTo?: Date; version: number; isActive: boolean; notes?: string; createdBy?: Types.ObjectId; createdAt: Date; updatedAt: Date }
const schema = new Schema<ITariffPlan>({
  size: { type: String, required: true, uppercase: true, trim: true, index: true }, annualRent: { type: Number, required: true, min: 0 }, securityDeposit: { type: Number, required: true, min: 0 },
  effectiveFrom: { type: Date, required: true, index: true }, effectiveTo: Date, version: { type: Number, required: true, min: 1 }, isActive: { type: Boolean, default: true, index: true }, notes: { type: String, trim: true, maxlength: 500 }, createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
schema.index({ size: 1, version: 1 }, { unique: true });
schema.index({ size: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
export const TariffPlan = model<ITariffPlan>('TariffPlan', schema);

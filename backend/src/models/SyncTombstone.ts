import { Schema, model } from 'mongoose';

export type SyncScope = 'lockers' | 'customers' | 'allocations' | 'renewalSummaries' | 'payments';

interface ISyncTombstone {
  scope: SyncScope;
  recordId: string;
  deletedAt: Date;
  reason?: string;
}

const schema = new Schema<ISyncTombstone>({
  scope: { type: String, required: true, enum: ['lockers', 'customers', 'allocations', 'renewalSummaries', 'payments'], index: true },
  recordId: { type: String, required: true },
  deletedAt: { type: Date, required: true, default: Date.now, index: true },
  reason: { type: String, trim: true },
}, { timestamps: false });

schema.index({ scope: 1, recordId: 1 }, { unique: true });
schema.index({ scope: 1, deletedAt: 1, _id: 1 });

export const SyncTombstone = model<ISyncTombstone>('SyncTombstone', schema);

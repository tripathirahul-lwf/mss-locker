import { Schema, model } from 'mongoose';

interface ISequence { key: string; value: number }

const sequenceSchema = new Schema<ISequence>({
  key: { type: String, required: true, unique: true },
  value: { type: Number, required: true, min: 0, default: 0 },
});

export const Sequence = model<ISequence>('Sequence', sequenceSchema);

import { Schema,model } from 'mongoose';
const schema = new Schema({ requestId: { type: String, unique: true, required: true }, fingerprint: { type: String, required: true }, actorId: { type: String, required: true }, allocationId: { type: Schema.Types.ObjectId, ref: 'LockerAllocation', required: true } }, { timestamps: true });
export const AllotmentRequest = model('AllotmentRequest', schema);

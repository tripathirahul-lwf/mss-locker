import { Schema,model } from 'mongoose';
const schema = new Schema({ requestId: { type: String, unique: true, required: true }, fingerprint: { type: String, required: true }, actorId: { type: String, required: true }, allocationId: { type: Schema.Types.ObjectId, ref: 'LockerAllocation', required: true }, invoiceId: { type: Schema.Types.ObjectId, ref: 'LockerInvoice', required: true }, paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true } }, { timestamps: true });
export const RenewalCollectionRequest = model('RenewalCollectionRequest', schema);

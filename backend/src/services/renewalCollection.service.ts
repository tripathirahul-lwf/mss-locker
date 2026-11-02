import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { RenewalCollectionInput,renewalCollectionSchema } from '../validators/renewalCollection.validator';
import { RenewalCollectionRequest } from '../models/RenewalCollectionRequest';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { Payment } from '../models/Payment';
import { renewalService } from './renewal.service';
import { paymentService } from './payment.service';
import { generatePaymentNumber } from '../utils/paymentCalculator';
import { StorageService } from './storage.service';
import { AuditLog } from '../models/AuditLog';
const fail = (message:string, statusCode=409) => Object.assign(new Error(message),{statusCode});
export class RenewalCollectionService {
  static async complete(input:RenewalCollectionInput, actorId:string, username:string) {
    input=renewalCollectionSchema.parse(input);
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    await RenewalCollectionRequest.init();
    const result = async (request:any) => {
      const invoice=await LockerInvoice.findById(request.invoiceId),payment=await Payment.findById(request.paymentId);
      if(!invoice || !payment || invoice.status==='CANCELLED' || invoice.invoiceType!=='RENEWAL' || invoice.paymentStatus!=='PAID' || invoice.balanceAmount!==0 || invoice.totalAmount!==input.amount || Math.abs(invoice.paidAmount-invoice.totalAmount)>.001 || !Number.isFinite(invoice.paidAmount) || payment.paymentStatus!=='COMPLETED' || payment.paymentPurpose!=='INVOICE_PAYMENT' || payment.amount!==input.amount || String(invoice.allocationId)!==String(request.allocationId) || String(payment.allocationId)!==String(request.allocationId) || String(payment.invoiceId)!==String(invoice._id) || String(payment.customerId)!==String(invoice.customerId) || String(payment.lockerId)!==String(invoice.lockerId)) throw fail('The original renewal collection was changed or reversed. Review its ledger before collecting again.');
      return {invoice,payment,allocation:await LockerAllocation.findById(request.allocationId)};
    };
    const replay = (request:any) => { if(request.actorId !== actorId || request.fingerprint !== fingerprint) throw fail('This renewal request was already used for different details.'); return request; };
    const previous = await RenewalCollectionRequest.findOne({requestId:input.requestId});
    if(previous) return result(replay(previous));
    if(input.receipt) StorageService.assertPrivateDocumentUrl(input.receipt.fileUrl);
    let completed:any;
    await mongoose.connection.transaction(async session => {
      const allocation = await LockerAllocation.findOneAndUpdate({_id:input.allocationId},{$inc:{__v:1}},{new:true,timestamps:false});
      const saved = await RenewalCollectionRequest.findOne({requestId:input.requestId});
      if(saved) {completed=replay(saved);return;}
      if(!allocation || allocation.status !== 'ACTIVE') throw fail('This agreement is no longer active. Reload the locker.');
      const current = allocation.nextRenewalDueDate || (allocation.paidThroughDate ? new Date(allocation.paidThroughDate.getTime()+86400000) : undefined);
      if(!current || current.toISOString().slice(0,10) !== input.expectedRenewalDate) throw fail('Renewal date changed. Reload this locker before collecting payment.');
      if(input.receiptDate < allocation.startDate.toISOString().slice(0,10)) throw fail('Receipt date cannot be before the opening date.',400);
      if(await Payment.exists({receiptNumber:input.receiptNumber})) throw fail('Receipt number already exists. Use a unique receipt number.');
      const baseRent = Math.round(input.amount/1.18*100)/100;
      const taxAmount = Math.round((input.amount-baseRent)*100)/100;
      const invoice = await renewalService.generateRenewalInvoice({allocationId:input.allocationId,startDate:input.expectedRenewalDate,nextRenewalDueDate:input.nextRenewalDueDate,billingCycle:input.billingCycle,baseRent,taxAmount,userId:actorId},session);
      const [payment] = await Payment.create([{paymentNumber:await generatePaymentNumber(),receiptNumber:input.receiptNumber,customerId:invoice.customerId,lockerId:invoice.lockerId,allocationId:allocation._id,invoiceId:invoice._id,paymentPurpose:'INVOICE_PAYMENT',amount:input.amount,paymentMethod:'CASH',paymentStatus:'COMPLETED',paymentDate:new Date(input.receiptDate),source:'MANUAL_ENTRY',recordedBy:actorId,idempotencyKey:`renewal:${input.requestId}`,proofUrl:input.receipt?.fileUrl,proofDocumentName:input.receipt?.fileName}],{session});
      const reconciled=await paymentService.recalculateInvoicePaymentSummary(invoice._id,session);
      if(reconciled.balanceAmount!==0 || reconciled.paymentStatus!=='PAID') throw fail('Renewal collection did not fully settle the bill. No changes were saved.');
      await LockerInvoice.updateOne({_id:invoice._id},{$set:{status:'PAID'}},{session});
      await LockerAllocation.updateOne({_id:allocation._id},{$set:{billingCycle:invoice.billingCycle,lastRenewedAt:new Date()}},{session});
      await AuditLog.create([{actorUserId:actorId,actorUsername:username,action:'PAYMENT_RECORDED',entityType:'LockerInvoice',entityId:String(invoice._id),description:`Renewed locker and recorded cash receipt ${input.receiptNumber}`,metadata:{amount:input.amount,receiptNumber:input.receiptNumber}}],{session});
      [completed] = await RenewalCollectionRequest.create([{requestId:input.requestId,fingerprint,actorId,allocationId:allocation._id,invoiceId:invoice._id,paymentId:payment._id}],{session});
    });
    return result(completed);
  }
}

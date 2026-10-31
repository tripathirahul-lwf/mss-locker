import { generatePaymentNumber } from '../utils/paymentCalculator';
import { generateDepositNumber } from '../utils/depositCalculator';
import mongoose, { Types } from 'mongoose';
import { createHash } from 'crypto';
import { AllotmentInput } from '../validators/allotment.validator';
import { AllotmentRequest } from '../models/AllotmentRequest';
import { LockerAllocation } from '../models/LockerAllocation';
import { Locker } from '../models/Locker';
import { Customer } from '../models/Customer';
import { CustomerKycDocument } from '../models/CustomerKycDocument';
import { LockerInvoice } from '../models/LockerInvoice';
import { Payment } from '../models/Payment';
import { DepositTransaction } from '../models/DepositTransaction';
import { Sequence } from '../models/Sequence';
import { AuditLog } from '../models/AuditLog';
import { LockerAllocationService, AllocationActor } from './allocation.service';
import { StorageService } from './storage.service';
import { normalizePhone } from '../utils/phone';
const fail = (message: string, statusCode = 409) => Object.assign(new Error(message), { statusCode });
export class AllotmentService {
  static async complete(input: AllotmentInput, actor: AllocationActor) {
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const actorId = actor.userId || 'SYSTEM';
    const result = async (allocationId: unknown) => ({ allocation: await LockerAllocation.findById(allocationId).populate('customerId').populate('lockerId'), payments: await Payment.find({ allocationId, idempotencyKey: { $in: [`${input.requestId}:rent`, `${input.requestId}:deposit`] } }).populate('customerId', 'fullName customerCode phone').populate('lockerId', 'lockerNumber size rackNumber').populate('invoiceId').populate('allocationId', 'allocationCode startDate billingCycle').populate('recordedBy', 'name username'), invoice: await LockerInvoice.findOne({ allocationId, invoiceType: 'NEW_ALLOCATION' }) });
    const previous = await AllotmentRequest.findOne({ requestId: input.requestId });
    if (previous) {
      if (previous.actorId !== actorId || previous.fingerprint !== fingerprint) throw fail('This request token was already used for different details.');
      return result(previous.allocationId);
    }
    for (const asset of [input.receipt, input.photo, input.idDocument]) if (asset) StorageService.assertPrivateDocumentUrl(asset.fileUrl);
    let allocationId: Types.ObjectId | undefined;
    await mongoose.connection.transaction(async session => {
      const replay = await AllotmentRequest.findOne({ requestId: input.requestId }).session(session);
      if (replay) {
        if (replay.actorId !== actorId || replay.fingerprint !== fingerprint) throw fail('Request token conflict.');
        allocationId = replay.allocationId!; return;
      }
      const locker = await Locker.findOne({ _id: input.lockerId, status: 'VACANT', operationalStatus: 'ACTIVE', isActive: true }).session(session);
      if (!locker) throw fail('Locker is no longer available. Choose another vacant locker.');
      let customer = input.customerId ? await Customer.findById(input.customerId).session(session) : null;
      const next = async (key: string, prefix: string) => {
        const sequence = await Sequence.findOneAndUpdate({ key }, { $inc: { value: 1 } }, { upsert: true, new: true, session });
        return `${prefix}-${String(sequence.value).padStart(6,'0')}`;
      };
      if (input.customer) {
        const phone = normalizePhone(input.customer.phone);
        if (await Customer.exists({ phone }).session(session)) throw fail('A customer with this phone exists. Select that customer explicitly.');
        let customerCode = await next('customer', 'CUS');
        while (await Customer.exists({ customerCode }).session(session)) customerCode = await next('customer', 'CUS');
        [customer] = await Customer.create([{ ...input.customer, phone, customerCode, createdBy: actor.userId, status: 'ACTIVE', kycStatus: 'PENDING' }], { session });
      }
      if (!customer || !customer.isActive || customer.status !== 'ACTIVE') throw fail('Select an active customer.', 400);
      locker.masterKeyReference = input.keyNumber;
      await locker.save({ session });
      const allocation = await LockerAllocationService.createAllocationInSession({ customerId: String(customer._id), lockerId: input.lockerId, startDate: input.startDate, billingCycle: input.billingCycle, annualRent: input.annualRent, securityDeposit: input.securityDeposit, allocationType: 'NEW' }, actor, session, 50, input.annualBaseRent, input.nextRenewalDueDate);
      allocationId = allocation._id;
      const invoice = await LockerInvoice.findOne({ allocationId, invoiceType: 'NEW_ALLOCATION' }).session(session);
      if (!invoice) throw fail('Initial invoice could not be created.', 500);
      if (await Payment.exists({ receiptNumber: { $in: [input.receiptNumber, `${input.receiptNumber}-DEP`] } }).session(session)) throw fail('Receipt number already exists. Use a unique receipt number.');
      const paymentFields = { customerId: customer._id, allocationId, lockerId: locker._id, paymentMethod: 'CASH', paymentStatus: 'COMPLETED', paymentDate: new Date(input.receiptDate), source: 'MANUAL_ENTRY', recordedBy: actor.userId, proofUrl: input.receipt?.fileUrl, proofDocumentName: input.receipt?.fileName };
      const [rentPayment] = await Payment.create([{ ...paymentFields, paymentNumber: await generatePaymentNumber(), receiptNumber: input.receiptNumber, invoiceId: invoice._id, paymentPurpose: 'INVOICE_PAYMENT', amount: invoice.totalAmount, idempotencyKey: `${input.requestId}:rent` }], { session });
      invoice.paidAmount = invoice.totalAmount; invoice.balanceAmount = 0; invoice.paymentStatus = 'PAID'; invoice.status = 'PAID'; invoice.dueStatus = 'UPCOMING';
      await invoice.save({ session });
      await LockerAllocation.updateOne({ _id: allocationId }, { $set: { paidThroughDate: invoice.billingPeriodEnd } }, { session });
      if (input.securityDeposit > 0) {
        const [depositPayment] = await Payment.create([{ ...paymentFields, paymentNumber: await generatePaymentNumber(), receiptNumber: `${input.receiptNumber}-DEP`, paymentPurpose: 'SECURITY_DEPOSIT', amount: input.securityDeposit, idempotencyKey: `${input.requestId}:deposit` }], { session });
        await DepositTransaction.create([{ customerId: customer._id, allocationId, lockerId: locker._id, depositTransactionNumber: await generateDepositNumber(), transactionType: 'DEPOSIT_RECEIVED', amount: input.securityDeposit, paymentId: depositPayment._id, paymentMethod: 'CASH', transactionDate: new Date(input.receiptDate), status: 'COMPLETED', source: 'MANUAL_ENTRY', recordedBy: actor.userId }], { session });
      }
      if (input.photo) customer.photoUrl = input.photo.fileUrl;
      if (input.idDocument) {
        await CustomerKycDocument.create([{ customerId: customer._id, documentType: input.idDocument.documentType, documentNumber: input.idDocument.documentType === 'OTHER' ? input.idDocument.documentNumber : input.idDocument.documentNumber.replace(/\s/g, '').toUpperCase(), documentUrl: input.idDocument.fileUrl, documentName: input.idDocument.fileName, mimeType: input.idDocument.mimeType, fileSize: input.idDocument.size, isPrimary: !(await CustomerKycDocument.exists({ customerId: customer._id, isPrimary: true, isActive: true }).session(session)), verificationStatus: 'PENDING', createdBy: actor.userId }], { session });
        if (customer.kycStatus !== 'VERIFIED') customer.kycStatus = 'PARTIAL';
      }
      await customer.save({ session });
      await AuditLog.create([{ actorUserId: actor.userId, actorUsername: actor.username, action: 'PAYMENT_RECORDED', entityType: 'LockerAllocation', entityId: String(allocationId), description: 'Completed counter allotment with rent, KYC charge, deposit and attachments', metadata: { receiptNumber: rentPayment.receiptNumber, kycCharge: 50, securityDeposit: input.securityDeposit, invoiceTotal: invoice.totalAmount } }], { session });
      await AllotmentRequest.create([{ requestId: input.requestId, fingerprint, actorId, allocationId }], { session });
    });
    return result(allocationId);
  }
}

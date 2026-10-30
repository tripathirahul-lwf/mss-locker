import { UserService } from '../../src/services/user.service';
import { AuthService } from '../../src/services/auth.service';
import { hashPassword } from '../../src/utils/password';
import request from 'supertest';
import { AuditLog } from '../../src/models/AuditLog';
import { auditService } from '../../src/services/audit.service';
import { app } from '../../src/app';
import { Role } from '../../src/models/Role';
import { User } from '../../src/models/User';
import { Session } from '../../src/models/Session';
import { generateAccessToken, generateRefreshToken, hashRefreshToken } from '../../src/utils/jwt';
import { env } from '../../src/config/env';
import { CustomerKycService } from '../../src/services/customerKyc.service';
import { CustomerService } from '../../src/services/customer.service';
import { addKycDocumentSchema, updateKycDocumentSchema, verifyKycDocumentSchema, updateCustomerSchema } from '../../src/validators/customer.validator';
import { StorageService } from '../../src/services/storage.service';
import { RefundRequest } from '../../src/models/RefundRequest';
import { randomUUID } from 'crypto';
import { AllotmentService } from '../../src/services/allotment.service';
import { allotmentSchema } from '../../src/validators/allotment.validator';
import { AllotmentRequest } from '../../src/models/AllotmentRequest';
import { Payment } from '../../src/models/Payment';
import { DepositTransaction } from '../../src/models/DepositTransaction';
import { CustomerKycDocument } from '../../src/models/CustomerKycDocument';
import { depositService } from '../../src/services/deposit.service';
import { renewalService } from '../../src/services/renewal.service';
import { billingService } from '../../src/services/billing.service';
import { paymentService } from '../../src/services/payment.service';
import { refundService } from '../../src/services/refund.service';
import { lockerClosureService } from '../../src/services/locker-closure.service';
import { isAllowedOrigin } from '../../src/utils/origin';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Sequence } from '../../src/models/Sequence';
import { SyncTombstone } from '../../src/models/SyncTombstone';
import { syncService } from '../../src/services/sync.service';
import { Locker } from '../../src/models/Locker';
import { Customer } from '../../src/models/Customer';
import { LockerAllocation } from '../../src/models/LockerAllocation';
import { LockerService } from '../../src/services/locker.service';
import { lockerQuerySchema } from '../../src/validators/locker.validator';
import { calculateBillingPeriod } from '../../src/utils/billingCalculator';
import { LockerAllocationService } from '../../src/services/allocation.service';
import { LockerInvoice } from '../../src/models/LockerInvoice';
import { PERMISSIONS } from '../../src/constants/permissions';

let replicaSet: MongoMemoryReplSet;

describe('MongoDB transaction, concurrency and sync integration', () => {
  beforeAll(async () => {
    process.env.MONGOMS_DOWNLOAD_DIR = `${process.cwd()}/.cache/mongodb-binaries`;
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
    mongoose.set('transactionAsyncLocalStorage', true);
    await mongoose.connect(replicaSet.getUri(), { dbName: 'vault-ledger-integration' });
  }, 120_000);

  beforeEach(async () => {
    await mongoose.connection.db?.dropDatabase();
    await Sequence.syncIndexes();
    await Payment.syncIndexes();
    await AllotmentRequest.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await replicaSet?.stop();
  });


  async function tenancy(number: string, days: number, verified = false, size = 'A') {
    const locker = await Locker.create({ lockerNumber: number, lockerCode: `LCK-${number}`, size, rackNumber: 'R1', status: 'OCCUPIED', masterKeyReference: `KEY-${number}` });
    const customer = await Customer.create({ customerCode: `CUS-${number}`, fullName: `Tenant ${number}`, phone: '9876543210', kycStatus: verified ? 'VERIFIED' : 'PENDING' });
    const due = new Date(Date.now() + days * 86400000);
    await LockerAllocation.create({ allocationCode: `ALC-${number}`, lockerId: locker._id, customerId: customer._id, startDate: new Date('2025-01-01'), annualRent: 1180, securityDeposit: 2000, rentSnapshot: 1180, depositSnapshot: 2000, nextRenewalDueDate: due, paidThroughDate: new Date('2025-12-31'), billingCycle: 'ANNUAL' });
    return { locker, customer };
  }

  it('keeps 30-day boundaries, overdue and KYC filters consistent with dashboard counts', async () => {
    await tenancy('1', -1);
    await tenancy('2', 0, true);
    await tenancy('3', 30, true);
    await tenancy('4', 31, false, 'B');
    const list = (status: string) => LockerService.getLockers(lockerQuerySchema.parse({ status, isActive: 'true' }));
    expect((await list('OVERDUE')).lockers.map(l => l.lockerNumber)).toEqual(['1']);
    expect((await list('DUE_SOON')).lockers.map(l => l.lockerNumber)).toEqual(['2', '3']);
    expect((await list('KYC_PENDING')).pagination.total).toBe(2);
    expect((await list('KYC_DONE')).pagination.total).toBe(2);
    const stats = await LockerService.getLockerStats();
    expect([stats.dueSoon, stats.overdue, stats.kycPending, stats.kycDone]).toEqual([2, 1, 2, 2]);
    const filtered = await LockerService.getLockerStats({ size: 'B' });
    expect([filtered.total, filtered.renewalDue, filtered.kycPending]).toEqual([1, 0, 1]);
    expect((await LockerService.getLockerStats({ status: 'OVERDUE' })).total).toBe(1);
    const detail = await LockerService.getLockerById(String((await list('OVERDUE')).lockers[0]._id), false);
    expect(detail.isOverdue).toBe(true);
    expect(detail.masterKeyReference).toBeUndefined();
  });

  it('searches keys only with sensitive-field permission and intersects tenant search with due filters', async () => {
    await tenancy('1', -1);
    await tenancy('2', 10);
    expect((await LockerService.getLockers(lockerQuerySchema.parse({ search: 'KEY-1' }), false)).pagination.total).toBe(0);
    expect((await LockerService.getLockers(lockerQuerySchema.parse({ search: 'KEY-1' }), true)).pagination.total).toBe(1);
    expect((await LockerService.getLockers(lockerQuerySchema.parse({ search: 'Tenant 2', status: 'OVERDUE' }))).pagination.total).toBe(0);
  });

  it('creates a three-year invoice with three years rent and a single refundable deposit', async () => {
    const locker = await Locker.create({ lockerNumber: '10', lockerCode: 'LCK-10', size: 'A', rackNumber: 'R1', annualRent: 1180, securityDeposit: 2000 });
    const customer = await Customer.create({ customerCode: 'CUS-10', fullName: 'Test Tenant', phone: '9876543210' });
    const allocation = await LockerAllocationService.createAllocation({ customerId: String(customer._id), lockerId: String(locker._id), startDate: '2026-01-01', billingCycle: 'TRIENNIAL', allocationType: 'NEW' }, {});
    const invoice = await LockerInvoice.findOne({ allocationId: allocation._id });
    expect(invoice?.totalAmount).toBe(3540);
    expect(invoice?.taxAmount).toBe(540);
    expect(allocation.securityDeposit).toBe(2000);
    expect(allocation.nextRenewalDueDate?.toISOString().slice(0, 10)).toBe('2029-01-01');
    expect(calculateBillingPeriod(new Date('2026-01-01'), 'TRIENNIAL').nextDueDate.toISOString().slice(0, 10)).toBe('2029-01-01');
  });


  const actor = { userId: '000000000000000000000001', username: 'counter' };
  const checker = '000000000000000000000002';
  async function allotment(number = '20', deposit = 2000) {
    const locker = await Locker.create({ lockerNumber: number, lockerCode: `LCK-${number}`, size: 'A', rackNumber: 'R1', annualRent: 1180, securityDeposit: deposit });
    return allotmentSchema.parse({ requestId: randomUUID(), cashReceived: true, receiptDate: '2026-02-01', lockerId: String(locker._id), customer: { fullName: 'Counter Customer', phone: `987654${number.padStart(4,'0')}` }, keyNumber: `KEY-${number}`, startDate: '2026-01-01', billingCycle: 'TRIENNIAL', annualRent: 1180, annualBaseRent: 1000, securityDeposit: deposit, receiptNumber: `BOOK-${number}` });
  }

  it('atomically collects three-year rent, KYC charge and deposit, and replays a lost response safely', async () => {
    const input = await allotment();
    const first = await AllotmentService.complete(input, actor);
    expect(first.invoice?.totalAmount).toBe(3590);
    expect(first.invoice?.otherCharges).toBe(50);
    expect(first.invoice?.balanceAmount).toBe(0);
    expect(first.payments.every(payment => payment.paymentDate.toISOString().slice(0,10) === '2026-02-01')).toBe(true);
    expect((await DepositTransaction.findOne())?.transactionDate.toISOString().slice(0,10)).toBe('2026-02-01');
    expect(first.payments.reduce((sum,p) => sum+p.amount,0)).toBe(5590);
    expect((await depositService.getDepositSummary(String(first.allocation!._id))).netDepositHeld).toBe(2000);
    expect((await Locker.findById(input.lockerId))?.masterKeyReference).toBe('KEY-20');
    const retry = await AllotmentService.complete(input, actor);
    expect(String(retry.allocation?._id)).toBe(String(first.allocation?._id));
    expect(await Customer.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(2);
    await expect(AllotmentService.complete({ ...input, receiptNumber: 'DIFFERENT' }, actor)).rejects.toThrow('different details');
  });

  it('rolls back customer, key, agreement and invoice when the receipt is duplicated', async () => {
    const original = await allotment('21'); await AllotmentService.complete(original, actor);
    const duplicate = await allotment('22'); duplicate.receiptNumber = original.receiptNumber;
    await expect(AllotmentService.complete(duplicate, actor)).rejects.toThrow('Receipt number already exists');
    expect(await Customer.countDocuments()).toBe(1);
    expect(await LockerAllocation.countDocuments()).toBe(1);
    expect(await LockerInvoice.countDocuments()).toBe(1);
    const unchanged = await Locker.findById(duplicate.lockerId);
    expect(unchanged?.status).toBe('VACANT'); expect(unchanged?.masterKeyReference).toBe('');
  });

  it('admits exactly one concurrent allotment for a vacant locker', async () => {
    const input = await allotment('23');
    const competitor = { ...input, requestId: randomUUID(), receiptNumber: 'COMPETITOR', customer: { fullName: 'Second Customer', phone: '9876549999' } };
    const outcomes = await Promise.allSettled([AllotmentService.complete(input, actor), AllotmentService.complete(competitor, actor)]);
    expect(outcomes.filter(outcome => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(await LockerAllocation.countDocuments()).toBe(1); expect(await Customer.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(2);
  });

  it('saves optional KYC links as pending and handles zero rent and zero deposit without empty payments', async () => {
    const input = await allotment('24', 0); input.annualRent = 0; input.annualBaseRent = 0;
    input.photo = { fileUrl: '/uploads/kyc/fixture-photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg', size: 50 };
    input.idDocument = { fileUrl: '/uploads/kyc/fixture-id.pdf', fileName: 'id.pdf', mimeType: 'application/pdf', size: 50, documentType: 'PAN', documentNumber: 'ABCDE1234F' };
    const saved = await AllotmentService.complete(input, actor);
    expect(saved.invoice?.totalAmount).toBe(50); expect(saved.payments).toHaveLength(1);
    expect(await DepositTransaction.countDocuments()).toBe(0);
    expect((await Customer.findOne())?.kycStatus).toBe('PARTIAL');
    expect((await CustomerKycDocument.findOne())?.verificationStatus).toBe('PENDING');
  });

  it('rounds a fractional annual tariff consistently across a three-year term', async () => {
    const input = await allotment('25', 0); input.annualBaseRent = .01; input.annualRent = .01;
    const saved = await AllotmentService.complete(input, actor);
    expect(saved.invoice?.baseRent).toBe(.03); expect(saved.invoice?.taxAmount).toBe(.01);
    expect(saved.invoice?.totalAmount).toBe(50.04);
  });

  it('completes renewal, payment, maker-checker refund and closure while preserving history', async () => {
    const saved = await AllotmentService.complete(await allotment('26'), actor);
    const allocationId = String(saved.allocation!._id);
    const renewal = await renewalService.generateRenewalInvoice({ allocationId, billingCycle: 'TRIENNIAL', userId: actor.userId });
    expect(renewal.totalAmount).toBe(3540); expect(renewal.otherCharges).toBe(0);
    await paymentService.recordPayment({ invoiceId: String(renewal._id), amount: 3540, paymentMethod: 'CASH' }, actor.userId, randomUUID());
    expect((await LockerAllocation.findById(allocationId))?.nextRenewalDueDate?.toISOString().slice(0,10)).toBe('2032-01-01');
    const refund = await refundService.createRefundRequest({ allocationId, requestedAmount: 2000, reason: 'Return deposit on surrender' }, actor.userId);
    await expect(refundService.approveRefund(String(refund._id), 2000, undefined, actor.userId)).rejects.toThrow('Maker-Checker');
    await refundService.approveRefund(String(refund._id), 2000, undefined, checker);
    await refundService.payRefund(String(refund._id), { refundPaymentMethod: 'CASH' }, checker, randomUUID());
    const closure = await lockerClosureService.createClosure({ allocationId, closureReason: 'Customer surrender', physicalChecklist: { lockerEmptied: true, lockerInspected: true, customerKeyReturned: true, documentsReturned: true, physicalAccessRevoked: true, lockerCondition: 'GOOD' } }, actor.userId);
    await lockerClosureService.reviewClosure(String(closure._id), undefined, checker);
    await lockerClosureService.approveClosure(String(closure._id), undefined, checker);
    await lockerClosureService.completeClosure(String(closure._id), undefined, checker);
    expect((await Locker.findById(saved.allocation!.lockerId))?.status).toBe('VACANT');
    expect((await LockerAllocation.findById(allocationId))?.status).toBe('CLOSED');
    expect(await LockerInvoice.countDocuments({ allocationId })).toBe(2);
    expect((await depositService.getDepositSummary(allocationId)).netDepositHeld).toBe(0);
  });

  it('rejects arbitrary hosted origins and clamps leap-day billing dates', () => {
    expect(isAllowedOrigin('https://evil.vercel.app','https://vault.example','production')).toBe(false);
    expect(isAllowedOrigin('http://localhost:5173','https://vault.example','production')).toBe(false);
    expect(isAllowedOrigin('https://vault.example','https://vault.example','production')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173','https://vault.example','development')).toBe(true);
    expect(calculateBillingPeriod(new Date('2024-02-29'), 'ANNUAL').nextDueDate.toISOString().slice(0,10)).toBe('2025-02-28');
  });


  it('enforces combined-operation permissions, private-file login and revoked-cookie checks', async () => {
    const role = await Role.create({ name: 'Limited Operator', code: 'LIMITED', status: 'ACTIVE', permissions: [PERMISSIONS.ALLOCATIONS_CREATE, PERMISSIONS.CUSTOMERS_KYC_VIEW] });
    const user = await User.create({ name: 'Limited Operator', username: 'limited', email: 'limited@example.test', passwordHash: 'not-used-in-this-token-test', role: role._id, status: 'ACTIVE' });
    const payload = { userId: String(user._id), username: user.username, roleCode: role.code };
    const access = generateAccessToken(payload); const refresh = generateRefreshToken(payload);
    const session = await Session.create({ userId: user._id, refreshTokenHash: hashRefreshToken(refresh), expiresAt: new Date(Date.now()+60000) });
    await request(app).post('/api/allocations/complete').set('Authorization', `Bearer ${access}`).send({}).expect(403);
    await request(app).get('/api/upload/private/cloud/invalid').expect(401);
    await request(app).get('/api/auth/me').set('Cookie', `vault_refresh_token=${refresh}`).expect(200);
    session.revokedAt = new Date(); await session.save();
    await request(app).get('/api/auth/me').set('Cookie', `vault_refresh_token=${refresh}`).expect(401);
  });

  it('rejects cross-site and originless cookie mutations before executing business logic', async () => {
    await request(app).post('/api/allocations/complete').set('Origin','https://untrusted.vercel.app').send({}).expect(403);
    await request(app).post('/api/allocations/complete').set('Cookie','vault_refresh_token=untrusted').send({}).expect(403);
    const trusted = env.CLIENT_URL.split(',')[0].trim().replace(/\/$/,'');
    await request(app).post('/api/allocations/complete').set('Origin',trusted).send({}).expect(401);
  });


  it('issues only one renewal invoice when two operators renew the same period concurrently', async () => {
    const saved = await AllotmentService.complete(await allotment('27'), actor);
    const input = { allocationId: String(saved.allocation!._id), billingCycle: 'ANNUAL' as const, userId: actor.userId };
    const results = await Promise.allSettled([renewalService.generateRenewalInvoice(input), renewalService.generateRenewalInvoice(input)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await LockerInvoice.countDocuments({ allocationId: input.allocationId, invoiceType: 'RENEWAL' })).toBe(1);
  });


  it('rejects missing cash confirmation, malformed identity, invalid dates and fractional paise before writes', async () => {
    const valid = await allotment('28');
    expect(allotmentSchema.safeParse({ ...valid, cashReceived: false }).success).toBe(false);
    expect(allotmentSchema.safeParse({ ...valid, cashReceived: undefined }).success).toBe(false);
    expect(allotmentSchema.safeParse({ ...valid, startDate: '2026-02-30' }).success).toBe(false);
    expect(allotmentSchema.safeParse({ ...valid, receiptDate: '2099-01-01' }).success).toBe(false);
    expect(allotmentSchema.safeParse({ ...valid, securityDeposit: 1.123 }).success).toBe(false);
    const asset = { fileUrl: '/uploads/kyc/fixture.pdf', fileName: 'id.pdf', mimeType: 'application/pdf', size: 100 };
    expect(allotmentSchema.safeParse({ ...valid, photo: asset }).success).toBe(false);
    expect(allotmentSchema.safeParse({ ...valid, receipt: { ...asset, size: 0 } }).success).toBe(false);
    expect(allotmentSchema.safeParse({ ...valid, idDocument: { ...asset, documentType: 'PAN', documentNumber: 'WRONG' } }).success).toBe(false);
    expect(await Payment.countDocuments()).toBe(0);
  });


  it('keeps unpaid opening rent separate from renewal and never fabricates paid coverage on reads', async () => {
    const locker = await Locker.create({ lockerNumber: '29', lockerCode: 'LCK-29', size: 'A', rackNumber: 'R1', annualRent: 1180, securityDeposit: 2000 });
    const customer = await Customer.create({ customerCode: 'CUS-29', fullName: 'Opening Invoice Customer', phone: '9876540029' });
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()-10));
    const allocation = await LockerAllocationService.createAllocation({ customerId: String(customer._id), lockerId: String(locker._id), startDate: start.toISOString(), billingCycle: 'ANNUAL', allocationType: 'NEW' }, actor);
    const id = String(allocation._id);
    expect((await LockerAllocation.findById(id))?.paidThroughDate).toBeUndefined();
    const invoice = await LockerInvoice.findOne({ allocationId: id });
    expect(invoice?.invoiceType).toBe('NEW_ALLOCATION'); expect(invoice?.balanceAmount).toBe(1180);
    // Reproduce the stored legacy bug without repairing the persisted financial record.
    await LockerAllocation.updateOne({ _id: id }, { paidThroughDate: allocation.endDate });
    const before = await LockerAllocation.findById(id).lean();
    const displayed = (await LockerAllocationService.getLockerAllocations(String(locker._id))).currentAllocation;
    expect(displayed.paidThroughDate).toBeUndefined(); expect(displayed.paymentCoverageConfirmed).toBe(false);
    const after = await LockerAllocation.findById(id).lean();
    expect(after?.paidThroughDate).toEqual(before?.paidThroughDate);
    expect(after?.updatedAt).toEqual(before?.updatedAt);
    const stats = await LockerService.getLockerStats();
    expect(stats.overdue).toBe(0); expect(stats.renewalDue).toBe(0);
    expect((await depositService.getDepositSummary(id)).netDepositHeld).toBe(0);
    await expect(renewalService.generateRenewalInvoice({ allocationId: id, userId: actor.userId })).rejects.toThrow('opening invoice');
    await paymentService.recordPayment({ invoiceId: String(invoice!._id), amount: 1180, paymentMethod: 'CASH' }, actor.userId, randomUUID());
    const paid = (await LockerAllocationService.getLockerAllocations(String(locker._id))).currentAllocation;
    expect(paid.paymentCoverageConfirmed).toBe(true); expect(paid.paidThroughDate).toEqual(invoice?.billingPeriodEnd);
  });

  it('replays a full deposit collection safely and rejects key reuse or generic ledger cancellation', async () => {
    const result = await AllotmentService.complete(await allotment('31', 0), actor);
    const allocationId = String(result.allocation!._id);
    await LockerAllocation.updateOne({ _id: allocationId }, { $set: { securityDeposit: 2000, depositSnapshot: 2000 } });
    const key = randomUUID();
    const input = { allocationId, amount: 2000, paymentMethod: 'CASH' as const };
    const first = await depositService.collectDeposit(input, actor.userId, key);
    const retry = await depositService.collectDeposit(input, actor.userId, key);
    expect(String(retry.payment._id)).toBe(String(first.payment._id));
    await expect(depositService.collectDeposit({ ...input, amount: 1000 }, actor.userId, key)).rejects.toThrow('Idempotency');
    await expect(paymentService.cancelPayment(String(first.payment._id), 'Wrong receipt', checker)).rejects.toThrow('dedicated ledger');
    expect((await Payment.findById(first.payment._id))?.paymentStatus).toBe('COMPLETED');
    expect((await depositService.getDepositSummary(allocationId)).netDepositHeld).toBe(2000);
  });

  it('reserves a deposit only once when refund requests race', async () => {
    const result = await AllotmentService.complete(await allotment('32'), actor);
    const input = { allocationId: String(result.allocation!._id), requestedAmount: 2000, reason: 'Close account' };
    const results = await Promise.allSettled([refundService.createRefundRequest(input, actor.userId), refundService.createRefundRequest(input, actor.userId)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await depositService.getDepositSummary(input.allocationId)).pendingRefundAmount).toBe(2000);
  });

  it('serializes draft submissions and scopes refund payout retries to the original refund', async () => {
    const result = await AllotmentService.complete(await allotment('35'), actor);
    const input = { allocationId: String(result.allocation!._id), requestedAmount: 2000, reason: 'Close account', isDraft: true };
    const first = await refundService.createRefundRequest(input, actor.userId);
    const second = await refundService.createRefundRequest(input, actor.userId);
    const submissions = await Promise.allSettled([refundService.submitRefundRequest(String(first._id), actor.userId), refundService.submitRefundRequest(String(second._id), actor.userId)]);
    expect(submissions.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const submitted = submissions.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>;
    const id = String(submitted.value._id);
    await refundService.approveRefund(id, 2000, undefined, checker);
    const key = randomUUID();
    const paid = await refundService.payRefund(id, { refundPaymentMethod: 'CASH' }, checker, key);
    const retry = await refundService.payRefund(id, { refundPaymentMethod: 'CASH' }, checker, key);
    expect(String(retry.payment._id)).toBe(String(paid.payment._id));
    const otherId = id === String(first._id) ? String(second._id) : String(first._id);
    await expect(refundService.payRefund(otherId, { refundPaymentMethod: 'CASH' }, checker, key)).rejects.toThrow('Idempotency');
    await expect(paymentService.cancelPayment(String(paid.payment._id), 'Wrong receipt', checker)).rejects.toThrow('dedicated ledger');
    expect((await depositService.getDepositSummary(input.allocationId)).netDepositHeld).toBe(0);
  });

  it('rejects an invoice retry key reused with another amount', async () => {
    const result = await AllotmentService.complete(await allotment('33'), actor);
    const key = randomUUID();
    const invoice = await renewalService.generateRenewalInvoice({ allocationId: String(result.allocation!._id), billingCycle: 'TRIENNIAL', userId: actor.userId });
    const input = { invoiceId: String(invoice._id), amount: 3540, paymentMethod: 'CASH' as const };
    const first = await paymentService.recordPayment(input, actor.userId, key);
    expect(String((await paymentService.recordPayment(input, actor.userId, key))._id)).toBe(String(first._id));
    await expect(paymentService.recordPayment({ ...input, amount: 100 }, actor.userId, key)).rejects.toThrow('Idempotency');
  });

  it('rechecks financial settlement when completing an approved closure', async () => {
    const result = await AllotmentService.complete(await allotment('34', 0), actor);
    const allocationId = String(result.allocation!._id);
    const closure = await lockerClosureService.createClosure({ allocationId, closureReason: 'Close account', physicalChecklist: { lockerEmptied: true, lockerInspected: true, customerKeyReturned: true, documentsReturned: true, physicalAccessRevoked: true, lockerCondition: 'GOOD' } }, actor.userId);
    await lockerClosureService.reviewClosure(String(closure._id), undefined, checker);
    await lockerClosureService.approveClosure(String(closure._id), undefined, checker);
    await renewalService.generateRenewalInvoice({ allocationId, billingCycle: 'TRIENNIAL', userId: actor.userId });
    await expect(lockerClosureService.completeClosure(String(closure._id), undefined, checker)).rejects.toThrow('readiness changed');
    expect((await LockerAllocation.findById(allocationId))?.status).toBe('ACTIVE');
    expect((await Locker.findById(result.allocation!.lockerId))?.status).toBe('OCCUPIED');
  });

  it('preserves lease snapshots during catalogue edits and blocks occupancy bypasses', async () => {
    const result = await AllotmentService.complete(await allotment('36'), actor);
    const id = String((result.allocation!.lockerId as any)._id ?? result.allocation!.lockerId);
    const before = await Locker.findById(id);
    const updated = await LockerService.updateLocker(id, { lockerCode: 'changed-36', position: '', annualRent: 1200.5, securityDeposit: 2500, expectedUpdatedAt: before!.updatedAt.toISOString() }, actor.userId);
    expect(updated.lockerCode).toBe('CHANGED-36');
    expect(updated.position).toBe('');
    expect((await LockerAllocation.findById(result.allocation!._id))?.securityDeposit).toBe(2000);
    await expect(LockerService.updateLocker(id, { status: 'VACANT' }, actor.userId)).rejects.toThrow('Occupancy');
    await expect(LockerService.updateLocker(id, { annualRent: 1, expectedUpdatedAt: before!.updatedAt.toISOString() }, actor.userId)).rejects.toThrow('Conflict');
    expect((await Locker.findById(id))?.annualRent).toBe(1200.5);
    expect((await Locker.findById(id))?.status).toBe('OCCUPIED');
  });

  it('admits only one catalogue edit against the same revision', async () => {
    const input = await allotment('37');
    const before = await Locker.findById(input.lockerId);
    const expectedUpdatedAt = before!.updatedAt.toISOString();
    const results = await Promise.allSettled([LockerService.updateLocker(input.lockerId, { remarks: 'First change', expectedUpdatedAt }), LockerService.updateLocker(input.lockerId, { remarks: 'Second change', expectedUpdatedAt })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await expect(LockerService.updateLocker(input.lockerId, { status: 'OCCUPIED' })).rejects.toThrow('Occupancy');
  });

  async function apiOperator(permissions: string[]) {
    const suffix = randomUUID();
    const role = await Role.create({ name: 'Audit Operator', code: `AUDIT-${suffix}`, status: 'ACTIVE', permissions });
    const user = await User.create({ name: 'Audit Operator', username: `audit-${suffix}`, email: `${suffix}@example.test`, passwordHash: 'unused-token-test', role: role._id, status: 'ACTIVE' });
    return generateAccessToken({ userId: String(user._id), username: user.username, roleCode: role.code });
  }

  it('replays two simultaneous payment retries without collecting twice', async () => {
    const result = await AllotmentService.complete(await allotment('41'), actor);
    const invoice = await renewalService.generateRenewalInvoice({ allocationId: String(result.allocation!._id), billingCycle: 'TRIENNIAL', userId: actor.userId });
    const key = randomUUID();
    const input = { invoiceId: String(invoice._id), amount: 3540, paymentMethod: 'CASH' as const };
    const payments = await Promise.all([paymentService.recordPayment(input, actor.userId, key), paymentService.recordPayment(input, actor.userId, key)]);
    expect(String(payments[0]!._id)).toBe(String(payments[1]!._id));
    expect(await Payment.countDocuments({ invoiceId: invoice._id })).toBe(1);
  });

  it('rejects draft invoices and already-settled imported invoices without a second collection', async () => {
    const result = await AllotmentService.complete(await allotment('42'), actor);
    const invoice = await renewalService.generateRenewalInvoice({ allocationId: String(result.allocation!._id), billingCycle: 'TRIENNIAL', userId: actor.userId });
    const input = { invoiceId: String(invoice._id), amount: 3540, paymentMethod: 'CASH' as const };
    await LockerInvoice.updateOne({ _id: invoice._id }, { status: 'DRAFT' });
    await expect(paymentService.recordPayment(input, actor.userId)).rejects.toThrow('draft');
    await LockerInvoice.updateOne({ _id: invoice._id }, { status: 'ISSUED', paymentStatus: 'PAID', paidAmount: 3540, balanceAmount: 0 });
    await expect(paymentService.recordPayment(input, actor.userId)).rejects.toThrow('already fully paid');
    expect(await Payment.countDocuments({ invoiceId: invoice._id })).toBe(0);
  });

  it('protects pending refund reservations from deposit cancellation', async () => {
    const result = await AllotmentService.complete(await allotment('43'), actor);
    const allocationId = String(result.allocation!._id);
    await refundService.createRefundRequest({ allocationId, requestedAmount: 2000, reason: 'Return deposit' }, actor.userId);
    const tx = await DepositTransaction.findOne({ allocationId, transactionType: 'DEPOSIT_RECEIVED' });
    await expect(depositService.cancelDepositTransaction(String(tx!._id), 'Wrong collection', checker)).rejects.toThrow('subsequent refunds');
    expect((await depositService.getDepositSummary(allocationId)).pendingRefundAmount).toBe(2000);
    expect((await Payment.findById(tx!.paymentId))?.paymentStatus).toBe('COMPLETED');
  });

  it('serializes refund cancellation with payout and forbids orphaning paid refund ledgers', async () => {
    const result = await AllotmentService.complete(await allotment('44'), actor);
    const allocationId = String(result.allocation!._id);
    const refund = await refundService.createRefundRequest({ allocationId, requestedAmount: 2000, reason: 'Return deposit' }, actor.userId);
    await refundService.approveRefund(String(refund._id), 2000, undefined, checker);
    const results = await Promise.allSettled([refundService.payRefund(String(refund._id), { refundPaymentMethod: 'CASH' }, checker, randomUUID()), refundService.cancelRefund(String(refund._id), 'Customer changed request', actor.userId)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    const saved = await RefundRequest.findById(refund._id);
    const tx = await DepositTransaction.findOne({ allocationId, transactionType: 'REFUND_ISSUED' });
    if (saved!.status === 'PAID') {
      expect(tx).not.toBeNull();
      await expect(depositService.cancelDepositTransaction(String(tx!._id), 'Wrong payout', checker)).rejects.toThrow('dedicated refund reversal');
      expect((await depositService.getDepositSummary(allocationId)).netDepositHeld).toBe(0);
    } else {
      expect(saved!.status).toBe('CANCELLED');
      expect(tx).toBeNull();
      expect((await depositService.getDepositSummary(allocationId)).netDepositHeld).toBe(2000);
    }
  });

  it('rejects financial changes after a completed closure', async () => {
    const result = await AllotmentService.complete(await allotment('45', 0), actor);
    const allocationId = String(result.allocation!._id);
    const closure = await lockerClosureService.createClosure({ allocationId, closureReason: 'Customer closing locker', physicalChecklist: { lockerEmptied: true, lockerInspected: true, customerKeyReturned: true, documentsReturned: true, physicalAccessRevoked: true, lockerCondition: 'GOOD' } }, actor.userId);
    await lockerClosureService.reviewClosure(String(closure._id), undefined, checker);
    await lockerClosureService.approveClosure(String(closure._id), undefined, checker);
    await lockerClosureService.completeClosure(String(closure._id), undefined, checker);
    await expect(paymentService.cancelPayment(String(result.payments[0]._id), 'Reverse old payment', checker)).rejects.toThrow('after allotment closure');
    await expect(depositService.collectDeposit({ allocationId, amount: 100, paymentMethod: 'CASH', allowOverride: true, overrideReason: 'Additional collection' }, actor.userId)).rejects.toThrow('active allotment');
    await expect(depositService.adjustDeposit({ allocationId, amount: 100, transactionType: 'DEPOSIT_ADJUSTMENT_ADD', reason: 'Additional collection' }, actor.userId)).rejects.toThrow('active allotment');
  });

  it('hides locker keys on update and enforces customer-scoped KYC mutation routes', async () => {
    const result = await AllotmentService.complete(await allotment('46'), actor);
    const customerId = String((result.allocation!.customerId as any)._id ?? result.allocation!.customerId);
    const lockerId = String((result.allocation!.lockerId as any)._id ?? result.allocation!.lockerId);
    const other = await Customer.create({ customerCode: 'OTHER-CUSTOMER', fullName: 'Other Customer', phone: '9876500047' });
    const doc = await CustomerKycService.addKycDocument(customerId, addKycDocumentSchema.parse({ documentType: 'PAN', documentNumber: 'ABCDE1234F', documentUrl: '/uploads/kyc/audit-scope.png' }), actor.userId);
    const token = await apiOperator([PERMISSIONS.LOCKERS_UPDATE, PERMISSIONS.CUSTOMERS_KYC_MANAGE, PERMISSIONS.CUSTOMERS_KYC_VERIFY]);
    const patch = await request(app).patch(`/api/lockers/${lockerId}`).set('Authorization', `Bearer ${token}`).send({ remarks: 'Audit change' }).expect(200);
    expect(patch.body.data.masterKeyReference).toBeUndefined();
    await request(app).patch(`/api/lockers/${lockerId}`).set('Authorization', `Bearer ${token}`).send({ masterKeyReference: 'Unauthorized replacement' }).expect(403);
    for (const method of ['patch', 'delete', 'post'] as const) {
      const suffix = method === 'post' ? '/verify' : '';
      await request(app)[method](`/api/customers/${other._id}/kyc/${doc._id}${suffix}`).set('Authorization', `Bearer ${token}`).send({ status: 'VERIFIED', remarks: 'Wrong parent' }).expect(404);
    }
    const response = await request(app).patch(`/api/customers/${customerId}/kyc/${doc._id}`).set('Authorization', `Bearer ${token}`).send({ remarks: 'Correct parent' }).expect(200);
    expect(response.body.data.documentNumber).not.toBe('ABCDE1234F');
    expect((await Locker.findById(lockerId))?.masterKeyReference).toBe('KEY-46');
  });

  it('atomically edits customers, rejects invalid dates and protects active customer deactivation', async () => {
    const result = await AllotmentService.complete(await allotment('47'), actor);
    const customerId = String((result.allocation!.customerId as any)._id ?? result.allocation!.customerId);
    const before = await Customer.findById(customerId);
    const revision = before!.updatedAt.toISOString();
    const edits = await Promise.allSettled([CustomerService.updateCustomer(customerId, { notes: 'First', expectedUpdatedAt: revision }), CustomerService.updateCustomer(customerId, { notes: 'Second', expectedUpdatedAt: revision })]);
    expect(edits.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await expect(CustomerService.updateCustomer(customerId, { isActive: false })).rejects.toThrow('Close active allotments');
    expect(updateCustomerSchema.safeParse({ dateOfBirth: '2024-02-31' }).success).toBe(false);
    expect(updateCustomerSchema.safeParse({ expectedUpdatedAt: 'yesterday' }).success).toBe(false);
  });

  it('resets verification on KYC type changes, rejects inactive/expired verification and preserves shared attachments', async () => {
    const result = await AllotmentService.complete(await allotment('48'), actor);
    const customerId = String((result.allocation!.customerId as any)._id ?? result.allocation!.customerId);
    const url = '/uploads/kyc/audit-shared.png';
    const doc = await CustomerKycService.addKycDocument(customerId, addKycDocumentSchema.parse({ documentType: 'PAN', documentNumber: 'ABCDE1234F', documentUrl: url }), actor.userId);
    await CustomerKycService.verifyKycDocument(String(doc._id), verifyKycDocumentSchema.parse({ status: 'VERIFIED' }), checker);
    const changed = await CustomerKycService.updateKycDocument(String(doc._id), updateKycDocumentSchema.parse({ documentType: 'OTHER' }), actor.userId);
    expect(changed.verificationStatus).toBe('PENDING');
    expect(changed.verifiedAt).toBeUndefined();
    await Payment.updateOne({ _id: result.payments[0]._id }, { proofUrl: url });
    const removal = vi.spyOn(StorageService, 'deleteFile').mockResolvedValue(undefined);
    try { await CustomerKycService.deleteKycDocument(String(doc._id), actor.userId); expect(removal).not.toHaveBeenCalled(); }
    finally { removal.mockRestore(); }
    await expect(CustomerKycService.verifyKycDocument(String(doc._id), verifyKycDocumentSchema.parse({ status: 'VERIFIED' }), checker)).rejects.toThrow('not found');
    const expired = await CustomerKycService.addKycDocument(customerId, addKycDocumentSchema.parse({ documentType: 'PAN', documentNumber: 'ABCDE1234F', documentUrl: '/uploads/kyc/audit-expired.png', expiryDate: '2000-01-01' }), actor.userId);
    await expect(CustomerKycService.verifyKycDocument(String(expired._id), verifyKycDocumentSchema.parse({ status: 'VERIFIED' }), checker)).rejects.toThrow('expired');
  });

  it('rejects adjustment endpoint ledger-type injection and missing payment references', async () => {
    const result = await AllotmentService.complete(await allotment('49'), actor);
    const allocationId = String(result.allocation!._id);
    const token = await apiOperator([PERMISSIONS.DEPOSITS_ADJUST]);
    await request(app).post('/api/deposits/adjust').set('Authorization', `Bearer ${token}`).send({ allocationId, amount: 9000, transactionType: 'REFUND_ISSUED', reason: 'Bypass approval' }).expect(400);
    expect((await depositService.getDepositSummary(allocationId)).netDepositHeld).toBe(2000);
    await expect(depositService.collectDeposit({ allocationId, amount: 100, paymentMethod: 'UPI', allowOverride: true, overrideReason: 'Additional deposit' }, actor.userId)).rejects.toThrow('transaction reference');
    const refund = await refundService.createRefundRequest({ allocationId, requestedAmount: 100, reason: 'Return deposit' }, actor.userId);
    await refundService.approveRefund(String(refund._id), 100, undefined, checker);
    await expect(refundService.payRefund(String(refund._id), { refundPaymentMethod: 'BANK_TRANSFER' }, checker)).rejects.toThrow('transaction reference');
  });

  it('escapes stored customer text in invoices, receipts and closure statements', async () => {
    const result = await AllotmentService.complete(await allotment('50', 0), actor);
    const customerId = String((result.allocation!.customerId as any)._id ?? result.allocation!.customerId);
    const malicious = '<img src=x onerror=alert(1)>';
    await Customer.updateOne({ _id: customerId }, { fullName: malicious });
    const allocationId = String(result.allocation!._id);
    const closure = await lockerClosureService.createClosure({ allocationId, closureReason: 'Customer closure request' }, actor.userId);
    const pages = [await billingService.generateInvoiceHtml(String(result.invoice!._id)), await paymentService.generatePaymentReceiptHtml(String(result.payments[0]._id)), await lockerClosureService.generateClosureStatementHtml(String(closure._id))];
    for (const html of pages) {
      expect(html).not.toContain(malicious);
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    }
  });

  it('replays concurrent refund payout retries with one financial disbursement', async () => {
    const result = await AllotmentService.complete(await allotment('51'), actor);
    const allocationId = String(result.allocation!._id);
    const refund = await refundService.createRefundRequest({ allocationId, requestedAmount: 2000, reason: 'Return deposit' }, actor.userId);
    await refundService.approveRefund(String(refund._id), 2000, undefined, checker);
    const key = randomUUID();
    const payouts = await Promise.all([refundService.payRefund(String(refund._id), { refundPaymentMethod: 'CASH' }, checker, key), refundService.payRefund(String(refund._id), { refundPaymentMethod: 'CASH' }, checker, key)]);
    expect(String(payouts[0].payment._id)).toBe(String(payouts[1].payment._id));
    expect(await Payment.countDocuments({ allocationId, paymentPurpose: 'REFUND' })).toBe(1);
    expect((await depositService.getDepositSummary(allocationId)).netDepositHeld).toBe(0);
  });

  it('counts and filters the entire audit history consistently across formats and pages', async () => {
    const role = await Role.create({ name: 'Auditor', code: 'AUDITOR', permissions: [PERMISSIONS.AUDIT_VIEW] });
    const user = await User.create({ name: 'Audit Inspector', username: 'inspect-user', email: 'inspect@example.test', passwordHash: 'unused-token-test', role: role._id, status: 'ACTIVE' });
    const now = new Date(Date.now() - 1000);
    await AuditLog.insertMany([
      ...Array.from({ length: 30 }, (_, i) => ({ action: 'LOGIN_SUCCESS', entityType: 'AUTH', actorUserId: user._id, description: `Successful sign-in ${i}`, createdAt: now })),
      { action: 'PAYMENT_RECORDED', module: 'PAYMENTS', performedBy: user._id, details: { receiptNumber: 'RCP-AUDIT', password: 'ULTRA_PRIVATE', nested: { documentNumber: 'ULTRA_PRIVATE' } }, ipAddress: '203.0.113.8', entityId: 'literal-entity-[x].*', createdAt: now },
      { action: 'INVOICE_GENERATED', entityType: 'LockerInvoice', actorUserId: user._id, createdAt: now },
      { action: 'KYC_DOCUMENT_REMOVED', entityType: 'CUSTOMER_KYC', actorUserId: user._id, createdAt: now },
      { action: 'LOCKER_RESERVED', entityType: 'LOCKER', createdAt: now },
      { action: 'REFUND_APPROVED', entityType: 'RefundRequest', createdAt: now },
      { action: 'LOGIN_FAILED', entityType: 'AUTH', createdAt: now },
      { action: 'SETTINGS_UPDATED', entityType: 'SYSTEM', createdAt: now },
    ]);
    const first = await auditService.list({ page: 1, limit: 5 });
    const second = await auditService.list({ page: 2, limit: 5 });
    expect(first.summary).toEqual({ total: 37, successfulLogins: 30, failedAttempts: 1, mutations: 4 });
    expect(second.summary).toEqual(first.summary);
    expect(new Set([...first.logs, ...second.logs].map(log => String(log._id))).size).toBe(10);
    const payments = await auditService.list({ category: 'PAYMENT', limit: 100 });
    expect(payments.pagination.total).toBe(3);
    expect((await auditService.list({ module: 'PAYMENT' })).pagination.total).toBe(3);
    const legacy = payments.logs.find(log => log.action === 'PAYMENT_RECORDED');
    expect(legacy.performedBy.name).toBe('Audit Inspector');
    expect(legacy.metadata.receiptNumber).toBe('RCP-AUDIT');
    expect(JSON.stringify(legacy)).not.toContain('ULTRA_PRIVATE');
    expect((await auditService.list({ category: 'CUSTOMER', severity: 'WARNING' })).pagination.total).toBe(1);
    expect((await auditService.list({ search: 'Audit Inspector' })).pagination.total).toBe(33);
    expect((await auditService.list({ search: '203.0.113.8' })).pagination.total).toBe(1);
    expect((await auditService.list({ search: '[x].*' })).pagination.total).toBe(1);
    expect((await auditService.list({ mutationsOnly: true })).pagination.total).toBe(4);
  });

  it('validates audit queries and includes the full India-calendar end date', async () => {
    await AuditLog.insertMany([
      { action: 'LOGIN_SUCCESS', createdAt: new Date('2026-10-29T18:29:59.999Z') },
      { action: 'LOGIN_SUCCESS', createdAt: new Date('2026-10-29T18:30:00.000Z') },
      { action: 'LOGIN_SUCCESS', createdAt: new Date('2026-10-30T18:29:59.999Z') },
      { action: 'LOGIN_SUCCESS', createdAt: new Date('2026-10-30T18:30:00.000Z') },
    ]);
    expect((await auditService.list({ startDate: '2026-10-30', endDate: '2026-10-30' })).pagination.total).toBe(2);
    expect((await auditService.list({ startDate: '2026-10-30T04:00:00+05:30', endDate: '2026-10-30T00:00:00Z' })).pagination.total).toBe(0);
    const token = await apiOperator([PERMISSIONS.AUDIT_VIEW]);
    for (const query of [{ userId: 'wrong' }, { page: '1.2' }, { startDate: '2026-02-31' }, { startDate: '2026-10-31', endDate: '2026-10-30' }, { severity: 'untrusted' }]) await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${token}`).query(query).expect(400);
    await request(app).get('/api/audit-logs/export').query({ format: 'csv' }).expect(401);
    const denied = await apiOperator([PERMISSIONS.LOCKERS_VIEW]);
    await request(app).get('/api/audit-logs/export').set('Authorization', `Bearer ${denied}`).query({ format: 'csv' }).expect(403);
  });

  it('exports all matching audit records with safe CSV cells and redacted JSON', async () => {
    await AuditLog.insertMany(Array.from({ length: 31 }, (_, index) => ({ action: 'PAYMENT_RECORDED', module: 'PAYMENTS', description: '=HYPERLINK("example")', actorUsername: '+operator', details: { bankReference: 'REFERENCE', accessToken: 'ULTRA_PRIVATE' }, createdAt: new Date(Date.now() - 1000 - index) })));
    const token = await apiOperator([PERMISSIONS.AUDIT_VIEW]);
    const json = await request(app).get('/api/audit-logs/export').set('Authorization', `Bearer ${token}`).query({ format: 'json', category: 'PAYMENT', limit: 1, page: 2 }).expect(200);
    expect(json.body.logs).toHaveLength(31);
    expect(JSON.stringify(json.body)).not.toContain('ULTRA_PRIVATE');
    const csv = await request(app).get('/api/audit-logs/export').set('Authorization', `Bearer ${token}`).query({ format: 'csv', category: 'PAYMENT' }).expect(200);
    expect(csv.headers['content-disposition']).toContain('attachment;');
    expect(csv.text).toContain("'=HYPERLINK");
    expect(csv.text).toContain("'+operator");
    expect(csv.text.split('\r\n')).toHaveLength(32);
    expect(await AuditLog.countDocuments()).toBe(31);
    const aggregate = vi.spyOn(AuditLog, 'aggregate').mockResolvedValue(Array(10001).fill({}));
    try { await expect(auditService.export({})).rejects.toThrow('Narrow the filters'); }
    finally { aggregate.mockRestore(); }
  });

  it('rolls back every write when a transaction fails', async () => {
    await expect(mongoose.connection.transaction(async () => {
      await Sequence.create({ key: 'rolled-back', value: 1 });
      throw new Error('force rollback');
    })).rejects.toThrow('force rollback');

    expect(await Sequence.countDocuments({ key: 'rolled-back' })).toBe(0);
  });

  it('allocates unique monotonic sequence values under concurrency', async () => {
    const results = await Promise.all(Array.from({ length: 30 }, () =>
      Sequence.findOneAndUpdate(
        { key: 'receipt' },
        { $inc: { value: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).lean()
    ));

    const values = results.map((record) => record!.value).sort((a, b) => a - b);
    expect(values).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
  });

  it('delivers deletion tombstones once and advances their independent cursor', async () => {
    await SyncTombstone.create({ scope: 'lockers', recordId: 'deleted-locker-id' });

    const first = await syncService.getIncrementalSync(undefined, 20, [PERMISSIONS.LOCKERS_VIEW]);
    expect(first.allowedScopes).toEqual(['lockers']);
    expect(first.data.deleted.lockers).toEqual(['deleted-locker-id']);

    const second = await syncService.getIncrementalSync(first.nextCursor, 20, [PERMISSIONS.LOCKERS_VIEW]);
    expect(second.data.deleted.lockers).toEqual([]);
  });
  async function staffFixture() {
    await User.syncIndexes();
    const superRole = await Role.create({ name: 'Super Administrator', code: 'SUPER_ADMIN', permissions: [], status: 'ACTIVE' });
    const staffRole = await Role.create({ name: 'Counter Staff', code: 'COUNTER_STAFF', permissions: [PERMISSIONS.USERS_VIEW], status: 'ACTIVE' });
    const admin = await User.create({ name: 'Staff Admin', username: 'staff-admin', email: 'staff-admin@example.test', passwordHash: await hashPassword('StaffAdmin123!'), role: superRole._id });
    const target = await User.create({ name: 'Staff Target', username: 'staff-target', email: 'staff-target@example.test', passwordHash: await hashPassword('StaffTarget123!'), role: staffRole._id });
    const adminToken = generateAccessToken({ userId: String(admin._id), username: admin.username, roleCode: 'SUPER_ADMIN' });
    return { admin, target, adminToken, staffRole, superRole };
  }

  it('staff summaries cover all matching pages and unknown roles never remove the filter', async () => {
    const { staffRole, adminToken } = await staffFixture();
    await User.insertMany(Array.from({ length: 18 }, (_, i) => ({ name: `Staff Fixture ${i}`, username: `staff-fixture-${i}`, email: `staff-fixture-${i}@example.test`, passwordHash: 'unused', role: staffRole._id, status: i < 14 ? 'ACTIVE' : i < 16 ? 'LOCKED' : 'INACTIVE' })));
    const first = await UserService.getUsers({ search: 'Staff Fixture', limit: 5 });
    const second = await UserService.getUsers({ search: 'Staff Fixture', limit: 5, page: 2 });
    expect(first.summary).toEqual({ total: 18, active: 14, restricted: 4, administrative: 0 });
    expect(second.summary).toEqual(first.summary);
    expect(first.users.map(u => u.id).some(id => second.users.some(u => u.id === id))).toBe(false);
    expect((await UserService.getUsers({ role: 'DOES_NOT_EXIST' })).pagination.total).toBe(0);
    expect((await UserService.getUsers({ status: 'RESTRICTED' })).pagination.total).toBe(4);
    expect((await UserService.getUsers({ role: 'ADMINISTRATIVE' })).pagination.total).toBe(1);
    expect((await UserService.getUsers({ search: '.*' })).pagination.total).toBe(0);
    expect((await UserService.getUsers({ search: '@staff-admin' })).pagination.total).toBe(1);
    expect((await request(app).get('/api/users?limit=0').set('Authorization', `Bearer ${adminToken}`)).status).toBe(400);
    expect((await request(app).get('/api/users/not-an-id').set('Authorization', `Bearer ${adminToken}`)).status).toBe(400);
  });

  it('staff mutation permissions cannot escalate via roles, overrides or status-only requests', async () => {
    const { admin, target, superRole, staffRole } = await staffFixture();
    const permissions = [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_UPDATE, PERMISSIONS.USERS_RESET_PASSWORD];
    const managerRole = await Role.create({ name: 'Limited Manager', code: 'LIMITED_MANAGER', permissions });
    const manager = await User.create({ name: 'Limited Manager', username: 'limited-manager', email: 'limited@example.test', passwordHash: 'unused', role: managerRole._id });
    const token = generateAccessToken({ userId: String(manager._id), username: manager.username, roleCode: managerRole.code });
    const patch = (id: string, body: object) => request(app).patch(`/api/users/${id}`).set('Authorization', `Bearer ${token}`).send(body);
    expect((await patch(String(target._id), { permissionsOverride: { grant: [PERMISSIONS.USERS_DEACTIVATE] } })).status).toBe(403);
    expect((await patch(String(target._id), { roleId: String(superRole._id) })).status).toBe(403);
    expect((await patch(String(target._id), { status: 'INACTIVE' })).status).toBe(403);
    expect((await patch(String(target._id), { name: 'Allowed Edit', status: 'INACTIVE' })).status).toBe(403);
    expect((await patch(String(admin._id), { name: 'Forbidden Edit' })).status).toBe(403);
    expect((await patch(String(target._id), { name: 'Allowed Edit' })).status).toBe(200);
    const roles = await request(app).get('/api/users/assignable-roles').set('Authorization', `Bearer ${token}`);
    expect(roles.status).toBe(200); expect(roles.body.data.roles.map((r: any) => r.id)).toContain(String(staffRole._id));
    expect(roles.body.data.roles.map((r: any) => r.id)).not.toContain(String(superRole._id));
    const readonly = await apiOperator([PERMISSIONS.USERS_VIEW]);
    expect((await request(app).post('/api/users').set('Authorization', `Bearer ${readonly}`).send({})).status).toBe(403);
    expect((await request(app).post(`/api/users/${target._id}/reset-password`).set('Authorization', `Bearer ${readonly}`).send({ newPassword: 'Changed123!' })).status).toBe(403);
  });

  it('staff password resets revoke bearer and refresh tokens without unlocking a manually locked account', async () => {
    const { admin, target, adminToken } = await staffFixture();
    const login = await AuthService.login({ identifier: target.username, password: 'StaffTarget123!' });
    expect((await request(app).get('/api/users').set('Authorization', `Bearer ${login.accessToken}`)).status).toBe(200);
    const reset = await request(app).post(`/api/users/${target._id}/reset-password`).set('Authorization', `Bearer ${adminToken}`).send({ newPassword: 'Changed123!' });
    expect(reset.status).toBe(200);
    expect((await request(app).get('/api/users').set('Authorization', `Bearer ${login.accessToken}`)).status).toBe(401);
    await expect(AuthService.refresh(login.refreshToken)).rejects.toThrow();
    await expect(AuthService.login({ identifier: target.username, password: 'StaffTarget123!' })).rejects.toThrow();
    const newLogin = await AuthService.login({ identifier: target.username, password: 'Changed123!' });
    await request(app).patch(`/api/users/${target._id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'LOCKED' }).expect(200);
    await expect(AuthService.login({ identifier: target.username, password: 'Changed123!' })).rejects.toThrow('locked');
    await UserService.resetPassword(String(target._id), 'LockedPass123!', String(admin._id), admin.username, true);
    expect((await User.findById(target._id))?.status).toBe('LOCKED');
    await request(app).patch(`/api/users/${target._id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'ACTIVE' }).expect(200);
    expect((await request(app).get('/api/users').set('Authorization', `Bearer ${newLogin.accessToken}`)).status).toBe(401);
    expect((await AuthService.login({ identifier: target.username, password: 'LockedPass123!' })).user.id).toBe(String(target._id));
  });

  it('staff self-protection, normalization, inactive role checks and password byte limits are enforced', async () => {
    const { admin, target, adminToken, staffRole } = await staffFixture();
    const patch = (body: object) => request(app).patch(`/api/users/${admin._id}`).set('Authorization', `Bearer ${adminToken}`).send(body);
    expect((await patch({ status: 'INACTIVE' })).status).toBe(403);
    expect((await patch({ roleId: String(staffRole._id) })).status).toBe(403);
    expect((await patch({ permissionsOverride: { grant: [] } })).status).toBe(403);
    const create = (body: object) => request(app).post('/api/users').set('Authorization', `Bearer ${adminToken}`).send(body);
    const body = { name: '  New Staff  ', username: '  NEW.STAFF  ', email: ' NEW@example.test ', roleId: String(staffRole._id), password: 'NewStaff123!' };
    expect((await create(body)).status).toBe(201);
    const saved = await User.findOne({ username: 'new.staff' }); expect(saved?.name).toBe('New Staff');
    expect((await create(body)).status).toBe(409);
    expect((await create({ ...body, name: '  ', username: 'second' })).status).toBe(400);
    expect((await create({ ...body, username: 'second', phone: 'abcdefghij' })).status).toBe(400);
    expect((await create({ ...body, password: `Aa1${'x'.repeat(70)}` })).status).toBe(400);
    await Role.updateOne({ _id: staffRole._id }, { status: 'INACTIVE' });
    expect((await create({ ...body, username: 'second', email: 'second@example.test' })).status).toBe(400);
    await expect(AuthService.login({ identifier: target.username, password: 'StaffTarget123!' })).rejects.toThrow('role');
  });

  it('staff account and session changes roll back together when session revocation fails', async () => {
    const { admin, target } = await staffFixture();
    const update = vi.spyOn(Session, 'updateMany').mockRejectedValueOnce(new Error('Simulated session write failure'));
    try { await expect(UserService.updateUser({ userId: String(target._id), status: 'INACTIVE', actorUserId: String(admin._id), actorUsername: admin.username, isActorSuperAdmin: true })).rejects.toThrow('Simulated'); }
    finally { update.mockRestore(); }
    const saved = await User.findById(target._id); expect(saved?.status).toBe('ACTIVE'); expect(saved?.tokenVersion).toBe(0);
  });

  it('concurrent administrators cannot disable one another and leave no active super administrator', async () => {
    const { admin, superRole } = await staffFixture();
    const second = await User.create({ name: 'Second Admin', username: 'second-admin', email: 'second-admin@example.test', passwordHash: 'unused', role: superRole._id });
    const results = await Promise.allSettled([
      UserService.updateUser({ userId: String(second._id), status: 'INACTIVE', actorUserId: String(admin._id), actorUsername: admin.username, isActorSuperAdmin: true }),
      UserService.updateUser({ userId: String(admin._id), status: 'INACTIVE', actorUserId: String(second._id), actorUsername: second.username, isActorSuperAdmin: true }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await User.countDocuments({ role: superRole._id, status: 'ACTIVE' })).toBe(1);
  });

});

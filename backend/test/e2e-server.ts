// Isolated browser-test fixture: no configured database or Cloudinary writes.
import mongoose from 'mongoose';
import path from 'path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
async function main() {
  process.chdir(path.resolve(__dirname, '..'));
  process.env.NODE_ENV = 'test';
  process.env.CLIENT_URL = 'http://127.0.0.1:25173';
  process.env.JWT_ACCESS_SECRET = 'isolated_browser_test_access_secret_123';
  process.env.JWT_REFRESH_SECRET = 'isolated_browser_test_refresh_secret_123';
  process.env.MONGOMS_DOWNLOAD_DIR = path.resolve('.cache/mongodb-binaries');
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = replica.getUri();
  await mongoose.connect(replica.getUri()); mongoose.set('transactionAsyncLocalStorage', true);
  const { Role } = await import('../src/models/Role'); const { User } = await import('../src/models/User');
  const { Locker } = await import('../src/models/Locker'); const { ALL_PERMISSIONS } = await import('../src/constants/permissions');
  const { hashPassword } = await import('../src/utils/password'); const { StorageService } = await import('../src/services/storage.service');
  // Deterministic storage boundary; upload validation middleware still runs.
  StorageService.uploadFile = async input => ({ fileUrl: `/uploads/kyc/browser-fixture-${crypto.randomUUID()}.png`, fileKey: 'fixture', fileName: input.originalName, mimeType: input.mimeType, size: input.buffer.length, originalSize: input.buffer.length, compressionSavedBytes: 0, storageProvider: 'cloudinary' });
  const role = await Role.create({ name: 'Test Admin', code: 'SUPER_ADMIN', permissions: ALL_PERMISSIONS, status: 'ACTIVE' });
  const auditOperator = await User.create({ name: 'Test Admin', username: 'browser-test', email: 'browser@example.test', passwordHash: await hashPassword('BrowserTest123!'), role: role._id, status: 'ACTIVE' });
  const staffViewRole = await Role.create({ name: 'Staff Viewer', code: 'STAFF_VIEWER', permissions: ['users.view', 'dashboard.view', 'lockers.view'], status: 'ACTIVE' });
  await User.create({ name: 'Browser Staff Viewer', username: 'staff-viewer', email: 'viewer@example.test', passwordHash: await hashPassword('ViewerTest123!'), role: staffViewRole._id });
  await User.insertMany(Array.from({ length: 18 }, (_, i) => ({ name: `UI Staff Fixture ${i}`, username: `ui-staff-fixture-${i}`, email: `ui-staff-${i}@example.test`, passwordHash: 'unused', role: staffViewRole._id, status: i < 14 ? 'ACTIVE' : i < 16 ? 'LOCKED' : 'INACTIVE' })));
  for (let i=1;i<=8;i++) await Locker.create({ lockerNumber: String(i), lockerCode: `TEST-${i}`, size: i%2 ? 'A' : 'B', rackNumber: 'R1', annualRent: 1180, securityDeposit: 2000 });

  const { AuditLog } = await import('../src/models/AuditLog');
  const auditNow = Date.now() - 1000;
  await AuditLog.insertMany([
    ...Array.from({ length: 30 }, (_, index) => ({ action: 'LOGIN_SUCCESS', entityType: 'AUTH', actorUserId: auditOperator._id, description: `AUDIT-FIXTURE sign-in ${index}`, createdAt: new Date(auditNow - index * 1000) })),
    { action: 'REFUND_APPROVED', entityType: 'RefundRequest', actorUserId: auditOperator._id, description: 'AUDIT-FIXTURE refund approved', metadata: { refundNumber: 'AUDIT-REFUND-42', amount: 1000 }, createdAt: new Date(auditNow - 31000) },
    { action: 'KYC_DOCUMENT_REMOVED', entityType: 'CUSTOMER_KYC', actorUserId: auditOperator._id, description: 'AUDIT-FIXTURE KYC removed', createdAt: new Date(auditNow - 32000) },
    { action: 'PAYMENT_RECORDED', module: 'PAYMENTS', performedBy: auditOperator._id, description: 'AUDIT-FIXTURE payment', details: { receiptNumber: 'AUDIT-RCP-42', password: 'fixture-private-secret' }, createdAt: new Date(auditNow - 33000) },
  ]);
  const { Customer } = await import('../src/models/Customer');
  const { LockerAllocationService } = await import('../src/services/allocation.service');
  const oldLocker = await Locker.create({ lockerNumber: '123', lockerCode: 'TEST-123', size: 'A', rackNumber: 'Rack 517', annualRent: 1180, securityDeposit: 2000 });
  const oldCustomer = await Customer.create({ customerCode: 'HISTORY-123', fullName: 'Opening Due Customer', phone: '9876511123' });
  const start = new Date(); start.setUTCDate(start.getUTCDate()-10); start.setUTCHours(0,0,0,0);
  await LockerAllocationService.createAllocation({ customerId: String(oldCustomer._id), lockerId: String(oldLocker._id), startDate: start.toISOString(), billingCycle: 'ANNUAL', allocationType: 'NEW' }, {});
  const referenceLocker = await Locker.create({ lockerNumber: '77', lockerCode: 'TEST-77', size: 'A', rackNumber: 'Rack 7', annualRent: 3540, securityDeposit: 6000 });
  const { AllotmentService } = await import('../src/services/allotment.service');
  const { allotmentSchema } = await import('../src/validators/allotment.validator');
  const referenceAllotment = await AllotmentService.complete(allotmentSchema.parse({ requestId: crypto.randomUUID(), cashReceived: true, receiptDate: new Date().toISOString().slice(0, 10), lockerId: String(referenceLocker._id), customer: { fullName: 'Reference Customer', phone: '9823507801' }, keyNumber: 'K-1007', startDate: new Date().toISOString().slice(0, 10), billingCycle: 'ANNUAL', annualRent: 3540, annualBaseRent: 3000, securityDeposit: 6000, receiptNumber: 'REFERENCE-77' }), { userId: String(auditOperator._id), username: auditOperator.username });
  const { CustomerKycDocument } = await import('../src/models/CustomerKycDocument');
  await CustomerKycDocument.create({ customerId: (await Customer.findOne({ fullName: 'Reference Customer' }))!._id, documentType: 'AADHAAR', documentNumber: '704724216043', documentUrl: '/uploads/kyc/browser-fixture-reference.png', documentName: 'reference-id.png', mimeType: 'image/png', isPrimary: true, isActive: true, verificationStatus: 'PENDING' });
  const { app } = await import('../src/app');
  const server = app.listen(25099, '127.0.0.1', () => console.log('Browser test API ready'));
  const stop = async () => { server.close(); await mongoose.disconnect(); await replica.stop(); process.exit(0); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch(error => { console.error(error.message); process.exit(1); });

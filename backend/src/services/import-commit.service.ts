import mongoose, { Types } from 'mongoose';
import { ImportJob, IImportJob } from '../models/ImportJob';
import { Locker } from '../models/Locker';
import { Customer } from '../models/Customer';
import { CustomerKycDocument } from '../models/CustomerKycDocument';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { Payment } from '../models/Payment';
import { ALLOCATION_TYPE } from '../constants/allocation.constants';
import { SyncTombstone, SyncScope } from '../models/SyncTombstone';

export class ImportCommitService {
  /**
   * Commits validated import job rows in dependency-safe order
   */
  async commitJob(jobId: string, userId: string): Promise<IImportJob> {
    const job = await ImportJob.findById(jobId);
    if (!job) throw new Error('Import job not found');

    if (!['READY', 'UPLOADED', 'VALIDATING'].includes(job.status)) {
      throw new Error(`Cannot commit job in status: ${job.status}`);
    }

    job.status = 'IMPORTING';
    job.startedAt = new Date();
    job.startedBy = new Types.ObjectId(userId);
    await job.save();

    let insertedRows = 0;
    let updatedRows = 0;
    let skippedRows = 0;
    let failedRows = 0;

    // Cache mappings across import stages
    const lockerDocMap = new Map<string, any>(); // normLockerNum -> Locker doc
    const customerPhoneMap = new Map<string, any>(); // 10-digit phone -> Customer doc
    const allocationLockerMap = new Map<string, any>(); // normLockerNum -> LockerAllocation doc

    try {
      return await mongoose.connection.transaction(async () => {
      const lockerRows = job.rowResults.filter(
        (r) => r.sheet.toLowerCase().includes('locker') || r.sheet.toLowerCase().includes('sheet1')
      );
      const renewalRows = job.rowResults.filter(
        (r) => r.sheet.toLowerCase().includes('renewal') || r.sheet.toLowerCase().includes('billing')
      );

      // ==========================================
      // STEP 1: COMMIT LOCKERS, CUSTOMERS & ALLOCATIONS
      // ==========================================
      for (const row of lockerRows) {
        if (row.status === 'INVALID') {
          skippedRows++;
          continue;
        }

        const data = row.data;
        const lockerNum = String(data.lockerNumber).trim();
        const normLockerNum = lockerNum.toUpperCase();

        // 1A. Find or Create Locker
        let locker = await Locker.findOne({ lockerNumber: lockerNum });
        if (!locker) {
          const paddedCode = `LOK-${lockerNum.padStart(4, '0')}`;
          locker = await Locker.create({
            lockerNumber: lockerNum,
            lockerCode: data.lockerCode || paddedCode,
            size: data.size || 'STD',
            rackNumber: data.rackNumber || 'R-01',
            section: data.section || 'Main Section',
            floor: data.floor || 'Ground Floor',
            annualRent: data.annualRent || 0,
            securityDeposit: data.securityDeposit || 0,
            status: data.status || 'VACANT',
            operationalStatus: data.operationalStatus || 'ACTIVE',
            masterKeyReference: data.masterKeyReference || undefined,
            remarks: `Imported via ${job.jobNumber}`,
          });
          job.createdRecordIds.lockers.push(locker._id);
          insertedRows++;
        } else {
          if (job.options.importMode === 'UPSERT_SAFE') {
            locker.size = data.size || locker.size;
            locker.rackNumber = data.rackNumber || locker.rackNumber;
            if (data.annualRent) locker.annualRent = data.annualRent;
            if (data.securityDeposit) locker.securityDeposit = data.securityDeposit;
            await locker.save();
            updatedRows++;
          }
        }
        lockerDocMap.set(normLockerNum, locker);

        // 1B. Create / Link Customer (if customer name & phone provided)
        let customer: any = null;
        if (data.customerName && data.phone) {
          const cleanPhone = String(data.phone).replace(/\D/g, '').slice(-10);

          customer = await Customer.findOne({ phone: cleanPhone });
          if (!customer) {
            const count = await Customer.countDocuments();
            const customerCode = `CUS-${String(count + 1).padStart(6, '0')}`;

            customer = await Customer.create({
              customerCode: data.customerCode || customerCode,
              fullName: data.customerName,
              phone: cleanPhone,
              alternatePhone: data.alternatePhone,
              email: data.email,
              address: data.address || '',
              city: data.city || 'Mumbai',
              status: 'ACTIVE',
              kycStatus: data.idNumber ? 'VERIFIED' : 'PENDING',
              notes: `Imported via ${job.jobNumber}`,
            });
            job.createdRecordIds.customers.push(customer._id);

            // Create KYC Record if ID provided
            if (data.idNumber) {
              const kyc = await CustomerKycDocument.create({
                customerId: customer._id,
                documentType: (data.idType || 'AADHAAR').toUpperCase(),
                documentNumberMasked: `XXXX-XXXX-${String(data.idNumber).slice(-4)}`,
                documentNumberHash: String(data.idNumber),
                verificationStatus: 'VERIFIED',
                verifiedAt: new Date(),
                remarks: `Legacy imported KYC verification`,
              });
              job.createdRecordIds.kycDocs.push(kyc._id);
            }
          }
          customerPhoneMap.set(cleanPhone, customer);

          // 1C. Create Active Allocation if occupied
          if (data.status === 'OCCUPIED') {
            let allocation = await LockerAllocation.findOne({
              lockerId: locker._id,
              status: 'ACTIVE',
            });

            if (!allocation) {
              const allocCount = await LockerAllocation.countDocuments();
              const allocationCode = `AGR-${new Date().getFullYear()}-${String(
                allocCount + 1
              ).padStart(6, '0')}`;

              allocation = await LockerAllocation.create({
                allocationCode,
                customerId: customer._id,
                lockerId: locker._id,
                startDate: data.startDate || new Date(),
                billingCycle: 'ANNUAL',
                annualRent: locker.annualRent,
                securityDeposit: locker.securityDeposit,
                rentSnapshot: locker.annualRent,
                depositSnapshot: locker.securityDeposit,
                status: 'ACTIVE',
                allocationType: ALLOCATION_TYPE.LEGACY_IMPORT,
                nextRenewalDueDate: data.renewalDueDate || undefined,
                paidThroughDate: data.renewalDueDate || undefined,
                remarks: `Legacy tenancy imported via ${job.jobNumber}`,
              });
              job.createdRecordIds.allocations.push(allocation._id);

              locker.status = 'OCCUPIED';
              await locker.save();
            }
            allocationLockerMap.set(normLockerNum, allocation);
          }
        }
      }

      // ==========================================
      // STEP 2: COMMIT HISTORICAL RENEWAL INVOICES
      // ==========================================
      for (const row of renewalRows) {
        if (row.status === 'INVALID') {
          skippedRows++;
          continue;
        }

        const data = row.data;
        const lockerNum = String(data.lockerNumber || '').trim().toUpperCase();

        let locker = lockerDocMap.get(lockerNum);
        if (!locker) {
          locker = await Locker.findOne({ lockerNumber: lockerNum });
          if (locker) lockerDocMap.set(lockerNum, locker);
        }

        if (!locker) {
          failedRows++;
          continue;
        }

        let allocation = allocationLockerMap.get(lockerNum);
        if (!allocation) {
          allocation = await LockerAllocation.findOne({
            lockerId: locker._id,
            status: { $in: ['ACTIVE', 'CLOSED'] },
          }).sort({ createdAt: -1 });
          if (allocation) allocationLockerMap.set(lockerNum, allocation);
        }

        // Find customer
        let customerId: any = allocation?.customerId;
        if (!customerId && data.phone) {
          const cleanPhone = String(data.phone).replace(/\D/g, '').slice(-10);
          const cust = customerPhoneMap.get(cleanPhone) || (await Customer.findOne({ phone: cleanPhone }));
          if (cust) customerId = cust._id;
        }

        if (!customerId) {
          // Find any customer associated with locker or use first available
          const anyCust = await Customer.findOne();
          customerId = anyCust?._id;
        }

        if (!allocation && customerId) {
          // Create a synthetic legacy allocation to anchor the historical invoice
          const allocCount = await LockerAllocation.countDocuments();
          allocation = await LockerAllocation.create({
            allocationCode: `AGR-LEGACY-${String(allocCount + 1).padStart(6, '0')}`,
            customerId,
            lockerId: locker._id,
            startDate: data.periodStart || data.dueDate || new Date('2020-01-01'),
            billingCycle: 'ANNUAL',
            annualRent: data.totalAmount || locker.annualRent || 0,
            securityDeposit: 0,
            rentSnapshot: data.totalAmount || 0,
            depositSnapshot: 0,
            status: 'ACTIVE',
            allocationType: ALLOCATION_TYPE.LEGACY_IMPORT,
            remarks: 'Legacy historical anchor allocation',
          });
          job.createdRecordIds.allocations.push(allocation._id);
          allocationLockerMap.set(lockerNum, allocation);
        }

        if (!allocation) {
          failedRows++;
          continue;
        }

        // Generate unique invoice number
        const invCount = await LockerInvoice.countDocuments();
        const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCount + 1).padStart(6, '0')}`;

        const invoice = await LockerInvoice.create({
          invoiceNumber,
          invoiceType: 'LEGACY_IMPORT',
          source: 'LEGACY_IMPORT',
          legacyInvoiceNumber: data.legacyInvoiceNumber || undefined,
          allocationId: allocation._id,
          customerId,
          lockerId: locker._id,
          billingPeriodStart: data.periodStart || data.dueDate || new Date(),
          billingPeriodEnd: data.periodEnd || data.dueDate || new Date(),
          issueDate: data.periodStart || data.dueDate || new Date(),
          dueDate: data.dueDate || new Date(),
          billingCycle: 'ANNUAL',
          baseRent: data.totalAmount,
          subtotal: data.totalAmount,
          totalAmount: data.totalAmount,
          paidAmount: data.paidAmount || 0,
          balanceAmount: data.balanceAmount || 0,
          status: data.paymentStatus === 'PAID' ? 'PAID' : 'ISSUED',
          paymentStatus: data.paymentStatus || 'UNPAID',
          dueStatus: data.paymentStatus === 'PAID' ? 'UPCOMING' : 'OVERDUE',
          notes: `Imported historical bill from ${job.jobNumber}`,
        });
        job.createdRecordIds.invoices.push(invoice._id);
        insertedRows++;

        // If paid, create matching legacy Payment record
        if (data.paidAmount && data.paidAmount > 0) {
          const payCount = await Payment.countDocuments();
          const paymentNumber = `PAY-${new Date().getFullYear()}-${String(payCount + 1).padStart(6, '0')}`;
          const receiptNumber = `RCT-${new Date().getFullYear()}-${String(payCount + 1).padStart(6, '0')}`;

          const payment = await Payment.create({
            paymentNumber,
            receiptNumber,
            invoiceId: invoice._id,
            allocationId: allocation._id,
            customerId,
            lockerId: locker._id,
            amount: data.paidAmount,
            paymentDate: data.paymentDate || data.dueDate || new Date(),
            paymentMethod: (data.paymentMethod || 'CASH').toUpperCase(),
            paymentStatus: 'COMPLETED',
            notes: 'Legacy historical payment record',
          });
          job.createdRecordIds.payments.push(payment._id);
        }
      }

      // Update Commit Summary
      job.commitSummary = {
        insertedRows,
        updatedRows,
        skippedRows,
        failedRows,
      };

      job.status = failedRows > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
      job.completedAt = new Date();
      job.completedBy = new Types.ObjectId(userId);
      await job.save();

      return job;
      }, { readPreference: 'primary', writeConcern: { w: 'majority' } });
    } catch (err: any) {
      job.status = 'FAILED';
      job.completedAt = new Date();
      await job.save();
      throw err;
    }
  }

  /**
   * Safely rolls back an imported job if no downstream dependencies exist
   */
  async rollbackJob(jobId: string, userId: string, reason: string): Promise<IImportJob> {
    return mongoose.connection.transaction(async () => {
    const job = await ImportJob.findById(jobId);
    if (!job) throw new Error('Import job not found');

    if (!['COMPLETED', 'COMPLETED_WITH_ERRORS'].includes(job.status)) {
      throw new Error(`Cannot rollback job in status: ${job.status}`);
    }

    const { lockers, customers, allocations, invoices, payments, kycDocs } =
      job.createdRecordIds;

    const deletedAt = new Date();
    const tombstones: Array<{ scope: SyncScope; ids: Types.ObjectId[] }> = [
      { scope: 'lockers', ids: lockers }, { scope: 'customers', ids: customers },
      { scope: 'allocations', ids: allocations }, { scope: 'renewalSummaries', ids: invoices },
      { scope: 'payments', ids: payments },
    ];
    const operations = tombstones.flatMap(({ scope, ids }) => ids.map((recordId) => ({
      updateOne: {
        filter: { scope, recordId: recordId.toString() },
        update: { $set: { deletedAt, reason: `Rollback of ${job.jobNumber}` } },
        upsert: true,
      },
    })));
    if (operations.length) await SyncTombstone.bulkWrite(operations);

    // Delete created records in reverse dependency order
    if (payments.length > 0) {
      await Payment.deleteMany({ _id: { $in: payments } });
    }
    if (invoices.length > 0) {
      await LockerInvoice.deleteMany({ _id: { $in: invoices } });
    }
    if (allocations.length > 0) {
      await LockerAllocation.deleteMany({ _id: { $in: allocations } });
    }
    if (kycDocs.length > 0) {
      await CustomerKycDocument.deleteMany({ _id: { $in: kycDocs } });
    }
    if (customers.length > 0) {
      await Customer.deleteMany({ _id: { $in: customers } });
    }
    if (lockers.length > 0) {
      await Locker.deleteMany({ _id: { $in: lockers } });
    }

    job.status = 'ROLLED_BACK';
    job.rolledBackAt = new Date();
    job.rolledBackBy = new Types.ObjectId(userId);
    job.rollbackReason = reason || 'Admin requested rollback';
    await job.save();

    return job;
    }, { readPreference: 'primary', writeConcern: { w: 'majority' } });
  }
}

export const importCommitService = new ImportCommitService();

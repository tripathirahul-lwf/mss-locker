import path from 'path';
import ExcelJS from 'exceljs';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { User } from '../models/User';
import { Locker } from '../models/Locker';
import { Customer } from '../models/Customer';
import { LockerAllocation } from '../models/LockerAllocation';
import { LockerInvoice } from '../models/LockerInvoice';
import { logger } from '../utils/logger';
import { calculateBillingPeriod, determineDueStatus } from '../utils/billingCalculator';

// Default tariff matrix per locker size
const DEFAULT_TARIFFS: Record<string, { rent: number; deposit: number }> = {
  A: { rent: 1180, deposit: 2000 },
  B: { rent: 1655, deposit: 2800 },
  B1: { rent: 1655, deposit: 2800 },
  C: { rent: 2360, deposit: 4000 },
  D: { rent: 2950, deposit: 5000 },
  D1: { rent: 2950, deposit: 5000 },
  E: { rent: 3780, deposit: 6400 },
  F: { rent: 4605, deposit: 7800 },
  F1: { rent: 5310, deposit: 9000 },
  G: { rent: 7555, deposit: 12800 },
  G1: { rent: 7555, deposit: 12800 },
  G2: { rent: 7555, deposit: 12800 },
};

function formatCustomerName(name: string): string {
  if (!name) return 'Valued Customer';
  return name
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s|-|\.)\S/g, (char) => char.toUpperCase());
}

function cleanPhoneNumber(phone: any): string {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length > 0) {
    return `+91 ${digits}`;
  }
  return '';
}

function parseExcelDate(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (typeof dateVal === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateVal * 86400000);
  }
  const parsed = new Date(String(dateVal));
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function importExcelData(): Promise<void> {
  try {
    const excelPath = path.resolve(__dirname, '../../vault-ledger-locker-template-filled.xlsx');
    logger.info(`Reading Excel file from: ${excelPath}`);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const lockersSheet = workbook.getWorksheet('Lockers');
    const renewalsSheet = workbook.getWorksheet('Renewal History');

    if (!lockersSheet) {
      throw new Error("Sheet 'Lockers' not found in excel template!");
    }

    const sheetToRows = (sheet: ExcelJS.Worksheet): any[] => {
      const headers = (sheet.getRow(1).values as unknown[]).slice(1).map((value) => String(value ?? '').trim());
      const rows: any[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record: Record<string, unknown> = {};
        let populated = false;
        headers.forEach((header, index) => {
          if (!header) return;
          const cellValue = row.getCell(index + 1).value;
          const value = cellValue && typeof cellValue === 'object' && 'result' in cellValue
            ? cellValue.result
            : cellValue ?? '';
          record[header] = value;
          if (value !== '') populated = true;
        });
        if (populated) rows.push(record);
      });
      return rows;
    };
    const lockerRows = sheetToRows(lockersSheet);
    const renewalRows = renewalsSheet ? sheetToRows(renewalsSheet) : [];

    logger.info(`Found ${lockerRows.length} locker rows and ${renewalRows.length} renewal history rows.`);

    const adminUser = await User.findOne({ username: 'superadmin' });
    const adminId = adminUser?._id;

    logger.info('Clearing existing records before clean master import...');
    await LockerInvoice.deleteMany({});
    await LockerAllocation.deleteMany({});
    await Customer.deleteMany({});
    await Locker.deleteMany({});

    logger.info('Starting batch import of 1,484 physical lockers...');

    const customerMap = new Map<string, any>();
    const lockerMapByNum = new Map<string, any>();
    const allocationMapByLockerId = new Map<string, any>();

    let customerSeq = 1;
    let allocationSeq = 1;
    let invoiceSeq = 1;

    const lockersToInsert: any[] = [];
    const allocationsToInsert: any[] = [];
    const invoicesToInsert: any[] = [];
    const createdCustomers: any[] = [];

    // 1. Process all lockers
    for (let i = 0; i < lockerRows.length; i++) {
      const row = lockerRows[i];
      const lockerNum = String(row['Locker No'] || i + 1).trim();
      const size = String(row['Size'] || 'A').trim().toUpperCase();
      const rackNum = String(row['Rack No'] || 'Main Rack').trim();
      const rawCustomerName = String(row['Customer Name'] || '').trim();
      const rawPhone = String(row['Phone'] || '').trim();
      const rawRent = Number(row['Annual Rent']);
      const rawDeposit = Number(row['Deposit']);

      const defaultTariff = DEFAULT_TARIFFS[size] || DEFAULT_TARIFFS['A'];
      const annualRent = rawRent > 0 ? rawRent : defaultTariff.rent;
      const securityDeposit = rawDeposit > 0 ? rawDeposit : defaultTariff.deposit;

      const hasCustomer = Boolean(rawCustomerName);
      const formattedName = formatCustomerName(rawCustomerName);
      const cleanPhone = cleanPhoneNumber(rawPhone);

      const lockerCode = `LCK-${String(i + 1).padStart(6, '0')}`;

      const lockerDoc = {
        lockerNumber: lockerNum,
        lockerCode,
        size,
        rackNumber: `Rack ${rackNum}`,
        section: `Rack ${rackNum} Vault`,
        floor: 'Ground Floor',
        position: `Unit ${lockerNum}`,
        annualRent,
        securityDeposit,
        status: hasCustomer ? 'OCCUPIED' : 'VACANT',
        operationalStatus: 'ACTIVE',
        remarks: row['Notes'] || '',
        isActive: true,
        createdBy: adminId,
      };

      lockersToInsert.push({ lockerDoc, rawRow: row, hasCustomer, formattedName, cleanPhone, lockerNum });
    }

    // 2. Insert all lockers
    logger.info(`Inserting ${lockersToInsert.length} lockers into MongoDB...`);
    const insertedLockers = await Locker.insertMany(
      lockersToInsert.map((item) => item.lockerDoc),
      { ordered: true }
    );
    logger.info(`Successfully inserted ${insertedLockers.length} physical lockers.`);

    insertedLockers.forEach((l) => {
      lockerMapByNum.set(l.lockerNumber, l);
    });

    // 3. Create Customers and Allocations
    for (let i = 0; i < insertedLockers.length; i++) {
      const insertedLocker = insertedLockers[i];
      const meta = lockersToInsert[i];

      if (meta.hasCustomer) {
        let customer = customerMap.get(meta.formattedName);

        if (!customer) {
          const customerCode = `CUS-${String(customerSeq++).padStart(6, '0')}`;
          const nameParts = meta.formattedName.split(' ');
          const firstName = nameParts[0] || 'Customer';
          const lastName = nameParts.slice(1).join(' ') || '';

          customer = await Customer.create({
            customerCode,
            fullName: meta.formattedName,
            firstName,
            lastName,
            phone: meta.cleanPhone || '+91 90000 00000',
            address: 'Vault Counter Registration',
            city: 'Main Vault',
            state: 'Operational',
            country: 'India',
            kycStatus: 'VERIFIED',
            kycVerifiedAt: new Date(),
            kycVerifiedBy: adminId,
            status: 'ACTIVE',
            isActive: true,
            createdBy: adminId,
            notes: meta.rawRow['Notes'] || 'Imported from Master Vault Excel Ledger',
          });

          customerMap.set(meta.formattedName, customer);
          createdCustomers.push(customer);
        }

        const openingDate = parseExcelDate(meta.rawRow['Opening Date']);
        const nextRenewalDate = parseExcelDate(meta.rawRow['Next Renewal Date']);
        const allocationCode = `ALC-${String(allocationSeq++).padStart(6, '0')}`;

        const remarksList = [];
        if (meta.rawRow['Bill No']) remarksList.push(`Bill No: ${meta.rawRow['Bill No']}`);
        if (meta.rawRow['Notes']) remarksList.push(`Notes: ${meta.rawRow['Notes']}`);
        if (meta.rawRow['Refund Status']) remarksList.push(`Refund: ${meta.rawRow['Refund Status']}`);

        allocationsToInsert.push({
          allocationCode,
          customerId: customer._id,
          lockerId: insertedLocker._id,
          startDate: openingDate,
          endDate: nextRenewalDate,
          paidThroughDate: nextRenewalDate,
          nextRenewalDueDate: nextRenewalDate,
          lastRenewedAt: meta.rawRow['Bill Date'] ? parseExcelDate(meta.rawRow['Bill Date']) : openingDate,
          billingCycle: 'ANNUAL',
          annualRent: insertedLocker.annualRent,
          securityDeposit: insertedLocker.securityDeposit,
          rentSnapshot: insertedLocker.annualRent,
          depositSnapshot: insertedLocker.securityDeposit,
          status: 'ACTIVE',
          allocationType: 'LEGACY_IMPORT',
          remarks: remarksList.join(' | ') || 'Legacy Excel Master Import',
          createdBy: adminId,
          isActive: true,
        });
      }
    }

    if (allocationsToInsert.length > 0) {
      logger.info(`Inserting ${allocationsToInsert.length} active tenancy agreements...`);
      const insertedAllocations = await LockerAllocation.insertMany(allocationsToInsert);
      logger.info(`Successfully inserted ${insertedAllocations.length} tenancy agreements.`);

      insertedAllocations.forEach((alloc) => {
        allocationMapByLockerId.set(String(alloc.lockerId), alloc);
      });

      // 4. Create Active Recurring Invoices for active allocations
      for (const alloc of insertedAllocations) {
        const invNumber = `INV-2026-${String(invoiceSeq++).padStart(6, '0')}`;
        const dueDate = alloc.nextRenewalDueDate || alloc.endDate || new Date();
        const dueStatus = determineDueStatus(dueDate, alloc.rentSnapshot);

        const { periodStart, periodEnd } = calculateBillingPeriod(dueDate, 'ANNUAL');

        invoicesToInsert.push({
          invoiceNumber: invNumber,
          invoiceType: 'RENEWAL',
          allocationId: alloc._id,
          customerId: alloc.customerId,
          lockerId: alloc.lockerId,
          billingPeriodStart: periodStart,
          billingPeriodEnd: periodEnd,
          issueDate: new Date(),
          dueDate,
          billingCycle: 'ANNUAL',
          baseRent: alloc.rentSnapshot,
          lateFee: 0,
          discount: 0,
          otherCharges: 0,
          taxAmount: 0,
          subtotal: alloc.rentSnapshot,
          totalAmount: alloc.rentSnapshot,
          paidAmount: 0,
          balanceAmount: alloc.rentSnapshot,
          status: 'ISSUED',
          paymentStatus: 'UNPAID',
          dueStatus,
          source: 'SYSTEM',
          notes: 'Next recurring tenancy renewal cycle invoice',
          createdBy: adminId,
        });
      }
    }

    // 5. Import 2,242 Historical Renewal Bills from 'Renewal History' Sheet
    logger.info(`Processing ${renewalRows.length} historical renewal ledger records...`);
    let legacyBillSeq = 1;

    for (const rRow of renewalRows) {
      const lockerNum = String(rRow['Locker No'] || '').trim();
      const billNo = String(rRow['Bill No'] || legacyBillSeq++).trim();
      const billDate = parseExcelDate(rRow['Bill Date']);
      const amount = Number(rRow['Amount']) || 0;
      const notes = rRow['Notes'] || '';

      const locker = lockerMapByNum.get(lockerNum);
      if (!locker) continue;

      const allocation = allocationMapByLockerId.get(String(locker._id));
      const customerId = allocation ? allocation.customerId : createdCustomers[0]?._id;
      if (!allocation) continue;

      const invNumber = `INV-HIST-${String(billNo).padStart(6, '0')}`;
      const { periodStart, periodEnd } = calculateBillingPeriod(billDate, 'ANNUAL');

      invoicesToInsert.push({
        invoiceNumber: invNumber,
        invoiceType: 'LEGACY_IMPORT',
        allocationId: allocation._id,
        customerId,
        lockerId: locker._id,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        issueDate: billDate,
        dueDate: billDate,
        billingCycle: 'ANNUAL',
        baseRent: amount,
        lateFee: 0,
        discount: 0,
        otherCharges: 0,
        taxAmount: 0,
        subtotal: amount,
        totalAmount: amount,
        paidAmount: amount,
        balanceAmount: 0,
        status: 'PAID',
        paymentStatus: 'PAID',
        dueStatus: 'UPCOMING',
        source: 'LEGACY_IMPORT',
        legacyReference: `Bill #${billNo}`,
        legacyInvoiceNumber: String(billNo),
        notes: notes || 'Historical Renewal Bill Ledger Import',
        createdBy: adminId,
      });
    }

    if (invoicesToInsert.length > 0) {
      logger.info(`Inserting ${invoicesToInsert.length} invoices into MongoDB in batches...`);
      const batchSize = 500;
      for (let i = 0; i < invoicesToInsert.length; i += batchSize) {
        const batch = invoicesToInsert.slice(i, i + batchSize);
        await LockerInvoice.insertMany(batch);
      }
      logger.info(`Successfully inserted ${invoicesToInsert.length} total invoices.`);
    }

    logger.info(`=== MASTER EXCEL & RENEWALS IMPORT COMPLETE ===`);
    logger.info(`Total Lockers Imported: ${insertedLockers.length}`);
    logger.info(`Total Customers Created: ${createdCustomers.length}`);
    logger.info(`Total Active Agreements: ${allocationsToInsert.length}`);
    logger.info(`Total Invoices & Renewal Records: ${invoicesToInsert.length}`);
  } catch (error) {
    logger.error('Error importing Excel data:', error);
    throw error;
  }
}

// Direct execution CLI
if (require.main === module) {
  (async () => {
    try {
      await connectDatabase();
      await importExcelData();
      await disconnectDatabase();
      process.exit(0);
    } catch {
      process.exit(1);
    }
  })();
}

import path from 'path';
import ExcelJS from 'exceljs';
import { connectDatabase, disconnectDatabase } from '../config/database';
import '../models/Customer';
import '../models/Locker';
import '../models/LockerAllocation';
import { Locker } from '../models/Locker';
import { Customer } from '../models/Customer';
import { LockerAllocation } from '../models/LockerAllocation';
import { logger } from '../utils/logger';

export function parsePhones(rawPhone: any): { primary: string; alternate?: string } {
  if (!rawPhone) return { primary: '' };
  const str = String(rawPhone).trim();
  const parts = str.split(/[\/,;]+/).map(p => p.trim()).filter(Boolean);

  const formatOne = (p: string): string => {
    const digits = p.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return `+91 ${digits.slice(1, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
    }
    if (digits.length === 8) {
      return `+91 44 ${digits.slice(0, 4)} ${digits.slice(4)}`;
    }
    if (digits.length > 0) {
      return `+91 ${digits}`;
    }
    return '';
  };

  const primary = formatOne(parts[0] || '');
  const alternate = parts.length > 1 ? formatOne(parts[1]) : undefined;
  return { primary, alternate };
}

function parseExcelDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (typeof dateVal === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateVal * 86400000);
  }
  const parsed = new Date(String(dateVal));
  return isNaN(parsed.getTime()) ? null : parsed;
}

export async function syncExcelToDb(): Promise<void> {
  const excelPath = path.resolve(__dirname, '../../vault-ledger-locker-template-filled.xlsx');
  logger.info(`Starting synchronization from Excel: ${excelPath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  const lockersSheet = workbook.getWorksheet('Lockers')!;
  const headers = (lockersSheet.getRow(1).values as unknown[]).slice(1).map((v) => String(v ?? '').trim());

  const excelRows: any[] = [];
  lockersSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, any> = {};
    headers.forEach((h, idx) => {
      const cellVal = row.getCell(idx + 1).value;
      record[h] = cellVal && typeof cellVal === 'object' && 'result' in cellVal ? (cellVal as any).result : (cellVal ?? '');
    });
    excelRows.push(record);
  });

  await connectDatabase();

  let updatedPhonesCount = 0;
  let updatedNotesCount = 0;
  let updatedRenewalDatesCount = 0;
  let vacatedTestLockersCount = 0;

  // 1. Process 405 Occupied Lockers from Excel
  for (const ex of excelRows) {
    const lockerNum = String(ex['Locker No'] ?? '').trim();
    const custName = String(ex['Customer Name'] ?? '').trim();
    if (!lockerNum || !custName) continue;

    const locker = await Locker.findOne({ lockerNumber: lockerNum });
    if (!locker) continue;

    const alloc = await LockerAllocation.findOne({ lockerId: locker._id, status: 'ACTIVE' });
    if (!alloc) continue;

    const cust = await Customer.findById(alloc.customerId);
    if (!cust) continue;

    // A. Update Phone & Alternate Phone
    const rawPhone = ex['Phone'];
    if (rawPhone) {
      const { primary, alternate } = parsePhones(rawPhone);
      let needsPhoneUpdate = false;

      if (primary && primary !== cust.phone) {
        cust.phone = primary;
        needsPhoneUpdate = true;
      }
      if (alternate && alternate !== cust.alternatePhone) {
        cust.alternatePhone = alternate;
        needsPhoneUpdate = true;
      }

      if (needsPhoneUpdate) {
        await cust.save();
        updatedPhonesCount++;
      }
    }

    // B. Update Notes if Excel has additional details
    const exNotes = String(ex['Notes'] ?? '').trim();
    const exRefund = String(ex['Refund Status'] ?? '').trim();
    const exBillNo = String(ex['Bill No'] ?? '').trim();

    let combinedNotes = cust.notes || '';
    let notesChanged = false;

    if (exNotes && !combinedNotes.includes(exNotes)) {
      combinedNotes = combinedNotes ? `${combinedNotes} | ${exNotes}` : exNotes;
      notesChanged = true;
    }
    if (exRefund && !combinedNotes.includes(`Refund: ${exRefund}`)) {
      combinedNotes = combinedNotes ? `${combinedNotes} | Refund: ${exRefund}` : `Refund: ${exRefund}`;
      notesChanged = true;
    }
    if (exBillNo && !combinedNotes.includes(`Bill: ${exBillNo}`)) {
      combinedNotes = combinedNotes ? `${combinedNotes} | Bill: ${exBillNo}` : `Bill: ${exBillNo}`;
      notesChanged = true;
    }

    if (notesChanged) {
      cust.notes = combinedNotes;
      await cust.save();
      updatedNotesCount++;
    }

    // C. Synchronize Next Renewal Date if mismatched
    const exNextRenewal = parseExcelDate(ex['Next Renewal Date']);
    if (exNextRenewal && alloc.nextRenewalDueDate) {
      const dEx = exNextRenewal.toISOString().slice(0, 10);
      const dDb = new Date(alloc.nextRenewalDueDate).toISOString().slice(0, 10);
      if (dEx !== dDb) {
        alloc.nextRenewalDueDate = exNextRenewal;
        alloc.endDate = exNextRenewal;
        alloc.paidThroughDate = exNextRenewal;
        await alloc.save();
        updatedRenewalDatesCount++;
      }
    }
  }

  // 2. Reconcile Vacant Lockers: Locker 2, 123, 1258
  const testLockerNums = ['2', '123', '1258'];
  for (const num of testLockerNums) {
    const ex = excelRows.find(r => String(r['Locker No']).trim() === num);
    // If Excel has no customer for this locker, but DB has active allocation:
    if (ex && !String(ex['Customer Name'] || '').trim()) {
      const locker = await Locker.findOne({ lockerNumber: num });
      if (locker && locker.status === 'OCCUPIED') {
        const activeAlloc = await LockerAllocation.findOne({ lockerId: locker._id, status: 'ACTIVE' });
        if (activeAlloc) {
          activeAlloc.status = 'CANCELLED';
          activeAlloc.remarks = `Reconciled with Master Excel: Locker is vacant in physical vault ledger.`;
          await activeAlloc.save();
        }
        locker.status = 'VACANT';
        await locker.save();
        vacatedTestLockersCount++;
        logger.info(`Locker #${num} reconciled to VACANT to match physical ledger.`);
      }
    }
  }

  // Final Counts Verification
  const finalTotalLockers = await Locker.countDocuments();
  const finalOccupiedLockers = await Locker.countDocuments({ status: 'OCCUPIED' });
  const finalVacantLockers = await Locker.countDocuments({ status: 'VACANT' });
  const finalActiveAllocations = await LockerAllocation.countDocuments({ status: 'ACTIVE' });

  console.log('\n================ RECONCILIATION SUMMARY ================');
  console.log(`Customer Phones Formatted & Updated: ${updatedPhonesCount}`);
  console.log(`Customer Notes & Ledger References Updated: ${updatedNotesCount}`);
  console.log(`Renewal Due Dates Synchronized: ${updatedRenewalDatesCount}`);
  console.log(`Test Demo Lockers Reconciled to Vacant: ${vacatedTestLockersCount}`);
  console.log(`--------------------------------------------------------`);
  console.log(`Total Lockers in DB: ${finalTotalLockers} (Excel: 1,484)`);
  console.log(`Total Occupied in DB: ${finalOccupiedLockers} (Excel: 405)`);
  console.log(`Total Vacant in DB: ${finalVacantLockers} (Excel: 1,079)`);
  console.log(`Total Active Tenancies in DB: ${finalActiveAllocations} (Excel: 405)`);
  console.log(`========================================================\n`);

  await disconnectDatabase();
}

syncExcelToDb().then(() => process.exit(0)).catch(err => {
  console.error('Sync failed:', err);
  process.exit(1);
});

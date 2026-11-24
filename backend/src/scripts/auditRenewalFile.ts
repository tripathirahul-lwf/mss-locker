import path from 'path';
import ExcelJS from 'exceljs';
import { connectDatabase, disconnectDatabase } from '../config/database';
import '../models/Customer';
import '../models/Locker';
import '../models/LockerAllocation';
import '../models/LockerInvoice';
import { Locker } from '../models/Locker';
import { LockerInvoice } from '../models/LockerInvoice';

async function auditRenewalFile() {
  const excelPath = path.resolve(__dirname, '../../RECEPT_RENEWAL_PAID22_black_removed.xlsx');
  console.log(`Inspecting Excel: ${excelPath}`);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);

  console.log(`Sheets in workbook:`, workbook.worksheets.map(w => ({ name: w.name, rowCount: w.rowCount })));

  for (const sheet of workbook.worksheets) {
    console.log(`\n================ SHEET: ${sheet.name} (Rows: ${sheet.rowCount}) ================`);
    if (sheet.rowCount > 0) {
      // Find the first row that looks like a header (contains non-empty cells)
      let headerRowIndex = 1;
      let headers: string[] = [];

      for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
        const rowVals = (sheet.getRow(r).values as unknown[]).slice(1).map(v => String(v ?? '').trim()).filter(Boolean);
        if (rowVals.length >= 3) {
          headerRowIndex = r;
          headers = (sheet.getRow(r).values as unknown[]).slice(1).map(v => String(v ?? '').trim());
          break;
        }
      }

      console.log(`Detected header row index: ${headerRowIndex}`);
      console.log(`Headers:`, headers.filter(Boolean));

      // Sample first 3 data rows
      const sampleRows: any[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIndex) return;
        if (sampleRows.length >= 3) return;

        const record: Record<string, any> = {};
        let hasData = false;
        headers.forEach((h, idx) => {
          if (!h) return;
          const val = row.getCell(idx + 1).value;
          const cleanVal = val && typeof val === 'object' && 'result' in val ? (val as any).result : (val ?? '');
          record[h] = cleanVal;
          if (cleanVal !== '') hasData = true;
        });
        if (hasData) sampleRows.push({ rowNum: rowNumber, ...record });
      });

      console.log(`Sample rows:`, JSON.stringify(sampleRows, null, 2));
    }
  }

  await connectDatabase();
  const dbInvoiceCount = await LockerInvoice.countDocuments();
  const dbHistCount = await LockerInvoice.countDocuments({ invoiceType: 'LEGACY_IMPORT' });
  const dbRenewalCount = await LockerInvoice.countDocuments({ invoiceType: 'RENEWAL' });
  const dbLockersCount = await Locker.countDocuments();
  console.log('\n--- Current DB Stats ---', {
    totalLockers: dbLockersCount,
    totalInvoices: dbInvoiceCount,
    historicalBills: dbHistCount,
    renewalInvoices: dbRenewalCount
  });

  await disconnectDatabase();
}

auditRenewalFile().then(() => process.exit(0)).catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});

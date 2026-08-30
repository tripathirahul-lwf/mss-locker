import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import {
  SHEET_ALIASES,
  LOCKER_COLUMN_ALIASES,
  RENEWAL_COLUMN_ALIASES,
} from '../constants/import.constants';

export interface ParsedWorkbook {
  fileHash: string;
  sheetNames: string[];
  detectedSheets: {
    lockersSheet?: string;
    renewalHistorySheet?: string;
    customersSheet?: string;
  };
  sheetData: Record<string, any[]>;
  autoMappings: Record<string, Record<string, string>>;
}

export class ImportParserService {
  /**
   * Generates SHA-256 checksum for the buffer
   */
  calculateHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Parses Excel or CSV buffer and extracts normalized sheets and auto column mappings
   */
  async parseWorkbook(buffer: Buffer, fileName: string): Promise<ParsedWorkbook> {
    const fileHash = this.calculateHash(buffer);
    if (buffer.length > 25 * 1024 * 1024) throw new Error('Workbook exceeds the 25 MB limit');
    const workbook = new ExcelJS.Workbook();
    if (/\.csv$/i.test(fileName)) {
      await workbook.csv.read(Readable.from(buffer));
    } else {
      await workbook.xlsx.load(buffer as any);
    }
    if (workbook.worksheets.length > 20) throw new Error('Workbook contains too many sheets (maximum 20)');
    const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
    const detectedSheets: {
      lockersSheet?: string;
      renewalHistorySheet?: string;
      customersSheet?: string;
    } = {};

    const sheetData: Record<string, any[]> = {};
    const autoMappings: Record<string, Record<string, string>> = {};

    // 1. Detect matching sheet names
    for (const rawName of sheetNames) {
      const cleanName = rawName.trim().toLowerCase();

      if (!detectedSheets.lockersSheet && SHEET_ALIASES.lockers.includes(cleanName)) {
        detectedSheets.lockersSheet = rawName;
      } else if (!detectedSheets.renewalHistorySheet && SHEET_ALIASES.renewal_history.includes(cleanName)) {
        detectedSheets.renewalHistorySheet = rawName;
      } else if (!detectedSheets.customersSheet && SHEET_ALIASES.customers.includes(cleanName)) {
        detectedSheets.customersSheet = rawName;
      }

      // Convert sheet to JSON rows
      const worksheet = workbook.getWorksheet(rawName);
      const rows: any[] = [];
      if (worksheet) {
        if (worksheet.rowCount > 100_001 || worksheet.columnCount > 200) {
          throw new Error(`Sheet '${rawName}' exceeds the 100,000 row / 200 column safety limit`);
        }
        const headers = (worksheet.getRow(1).values as unknown[]).slice(1).map((v) => String(v ?? '').trim());
        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return;
          const record: Record<string, unknown> = {};
          let populated = false;
          headers.forEach((header, index) => {
            if (!header) return;
            const cell = row.getCell(index + 1);
            const value = cell.value && typeof cell.value === 'object' && 'result' in cell.value
              ? cell.value.result
              : cell.value ?? '';
            record[header] = value;
            if (value !== '') populated = true;
          });
          if (populated) rows.push(record);
        });
      }

      sheetData[rawName] = rows;
    }

    // Default first sheet as lockersSheet if only 1 sheet exists and not yet assigned
    if (!detectedSheets.lockersSheet && sheetNames.length > 0) {
      detectedSheets.lockersSheet = sheetNames[0];
    }

    // 2. Generate Auto Column Mappings
    if (detectedSheets.lockersSheet) {
      const rows = sheetData[detectedSheets.lockersSheet] || [];
      if (rows.length > 0) {
        const fileColumns = Object.keys(rows[0]);
        autoMappings[detectedSheets.lockersSheet] = this.autoMapColumns(
          fileColumns,
          LOCKER_COLUMN_ALIASES
        );
      }
    }

    if (detectedSheets.renewalHistorySheet) {
      const rows = sheetData[detectedSheets.renewalHistorySheet] || [];
      if (rows.length > 0) {
        const fileColumns = Object.keys(rows[0]);
        autoMappings[detectedSheets.renewalHistorySheet] = this.autoMapColumns(
          fileColumns,
          RENEWAL_COLUMN_ALIASES
        );
      }
    }

    return {
      fileHash,
      sheetNames,
      detectedSheets,
      sheetData,
      autoMappings,
    };
  }

  /**
   * Matches raw spreadsheet columns to system schema fields using alias dictionary
   */
  autoMapColumns(
    fileColumns: string[],
    aliasDict: Record<string, string[]>
  ): Record<string, string> {
    const mappings: Record<string, string> = {};

    for (const col of fileColumns) {
      const cleanCol = col.trim().toLowerCase().replace(/[\s-_#.]/g, '');

      for (const [systemField, aliases] of Object.entries(aliasDict)) {
        const matched = aliases.some(
          (alias) =>
            alias.replace(/[\s-_#.]/g, '').toLowerCase() === cleanCol ||
            alias.toLowerCase() === col.trim().toLowerCase()
        );
        if (matched) {
          mappings[col] = systemField;
          break;
        }
      }
    }

    return mappings;
  }

  /**
   * Centralized Date Parser
   * Handles JS Date, Excel serial numbers (e.g. 44927), DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
   */
  parseDate(val: any): Date | null {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

    // Excel serial number
    if (typeof val === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const date = new Date(excelEpoch.getTime() + val * 86400000);
      return isNaN(date.getTime()) ? null : date;
    }

    const str = String(val).trim();
    if (!str) return null;

    // Standard DD/MM/YYYY or DD-MM-YYYY (India locale priority)
    const ddmmyyyy = str.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1], 10);
      const month = parseInt(ddmmyyyy[2], 10) - 1;
      const year = parseInt(ddmmyyyy[3], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }

    // Standard ISO / YYYY-MM-DD
    const isoDate = new Date(str);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    return null;
  }

  /**
   * Centralized Currency & Amount Parser
   * Parses ₹5,000, 5000.00, " 5,000 ", etc.
   */
  parseAmount(val: any): number | null {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;

    const cleaned = String(val)
      .replace(/[₹$,\s]/g, '')
      .trim();

    if (!cleaned) return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
}

export const importParserService = new ImportParserService();

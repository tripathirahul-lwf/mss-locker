import { Types } from 'mongoose';
import { Locker } from '../models/Locker';
import { Customer } from '../models/Customer';
import { LockerAllocation } from '../models/LockerAllocation';
import { IImportRowResult } from '../models/ImportJob';
import {
  normalizeLockerSize,
  normalizeLockerStatus,
} from '../constants/import.constants';
import { importParserService } from './import-parser.service';

export interface ValidationSummaryResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  duplicateRows: number;
  rowResults: IImportRowResult[];
}

export class ImportValidationService {
  /**
   * Performs full dry-run validation over Lockers and Renewal History sheets
   */
  async validateJobData(
    sheetData: Record<string, any[]>,
    columnMappings: Record<string, Record<string, string>>,
    lockersSheetName?: string,
    renewalSheetName?: string
  ): Promise<ValidationSummaryResult> {
    const rowResults: IImportRowResult[] = [];
    const seenLockerNumbersInFile = new Set<string>();

    let totalRows = 0;
    let validRows = 0;
    let invalidRows = 0;
    let warningRows = 0;
    let duplicateRows = 0;

    // 1. VALIDATE LOCKERS SHEET
    if (lockersSheetName && sheetData[lockersSheetName]) {
      const rawRows = sheetData[lockersSheetName];
      const mapping = columnMappings[lockersSheetName] || {};

      // Pre-fetch all existing locker numbers from DB to check duplicates
      const existingDbLockers = await Locker.find({})
        .select('lockerNumber status')
        .lean();
      const existingLockerNumberMap = new Map<string, any>();
      existingDbLockers.forEach((l) =>
        existingLockerNumberMap.set(l.lockerNumber.trim().toUpperCase(), l)
      );

      // Pre-fetch customers to detect possible duplicate phones
      const existingCustomers = await Customer.find({}).select('phone customerCode').lean();
      const existingPhoneMap = new Map<string, string>();
      existingCustomers.forEach((c) => existingPhoneMap.set(c.phone.trim(), c.customerCode));

      for (let i = 0; i < rawRows.length; i++) {
        totalRows++;
        const rawRow = rawRows[i];
        const rowNumber = i + 2; // 1-based index (accounting for header row)
        const errors: string[] = [];
        const warnings: string[] = [];

        // Map columns
        const mappedData: Record<string, any> = {};
        for (const [fileCol, sysField] of Object.entries(mapping)) {
          if (rawRow[fileCol] !== undefined) {
            mappedData[sysField] = rawRow[fileCol];
          }
        }

        // --- A. Locker Specs Validation ---
        const lockerNumberRaw = String(mappedData.lockerNumber || '').trim();
        if (!lockerNumberRaw) {
          errors.push('Locker Number is required.');
        } else {
          const normLockerNum = lockerNumberRaw.toUpperCase();
          if (seenLockerNumbersInFile.has(normLockerNum)) {
            errors.push(`Duplicate Locker Number #${lockerNumberRaw} within this file.`);
          } else {
            seenLockerNumbersInFile.add(normLockerNum);
          }

          if (existingLockerNumberMap.has(normLockerNum)) {
            warnings.push(
              `Locker #${lockerNumberRaw} already exists in database (will be updated if upsert is selected).`
            );
          }
        }

        const rackNumberRaw = String(mappedData.rackNumber || '').trim();
        if (!rackNumberRaw) {
          errors.push('Rack Number is required.');
        }

        // Size & Status normalization
        mappedData.size = normalizeLockerSize(mappedData.size || 'STD');
        mappedData.status = normalizeLockerStatus(mappedData.status || 'VACANT');

        // Amounts
        if (mappedData.annualRent !== undefined && mappedData.annualRent !== '') {
          const rent = importParserService.parseAmount(mappedData.annualRent);
          if (rent === null || rent < 0) {
            warnings.push(`Invalid annual rent amount: "${mappedData.annualRent}". Defaulting to 0.`);
            mappedData.annualRent = 0;
          } else {
            mappedData.annualRent = rent;
          }
        } else {
          mappedData.annualRent = 0;
        }

        if (mappedData.securityDeposit !== undefined && mappedData.securityDeposit !== '') {
          const dep = importParserService.parseAmount(mappedData.securityDeposit);
          if (dep === null || dep < 0) {
            warnings.push(`Invalid security deposit amount: "${mappedData.securityDeposit}". Defaulting to 0.`);
            mappedData.securityDeposit = 0;
          } else {
            mappedData.securityDeposit = dep;
          }
        } else {
          mappedData.securityDeposit = 0;
        }

        // --- B. Customer & Allotment Validation (if present) ---
        const hasCustomerName = Boolean(String(mappedData.customerName || '').trim());
        const hasCustomerPhone = Boolean(String(mappedData.phone || '').trim());

        if (mappedData.status === 'OCCUPIED' || hasCustomerName || hasCustomerPhone) {
          if (!hasCustomerName) {
            errors.push('Customer name is required for occupied/allotted locker.');
          }

          if (!hasCustomerPhone) {
            errors.push('Customer phone number is required.');
          } else {
            const cleanPhone = String(mappedData.phone).replace(/\D/g, '');
            if (cleanPhone.length < 10) {
              errors.push(`Customer phone "${mappedData.phone}" must contain at least 10 digits.`);
            } else {
              mappedData.phone = cleanPhone.slice(-10); // Standardize 10 digits
              if (existingPhoneMap.has(mappedData.phone)) {
                warnings.push(
                  `Phone ${mappedData.phone} matches existing customer (${existingPhoneMap.get(
                    mappedData.phone
                  )}). Allocation will be linked to existing profile.`
                );
              }
            }
          }

          // Dates
          if (mappedData.startDate) {
            const parsedStart = importParserService.parseDate(mappedData.startDate);
            if (!parsedStart) {
              warnings.push(`Could not parse Start Date: "${mappedData.startDate}". Defaulting to today.`);
              mappedData.startDate = new Date();
            } else {
              mappedData.startDate = parsedStart;
            }
          } else {
            mappedData.startDate = new Date();
          }

          if (mappedData.renewalDueDate) {
            const parsedDue = importParserService.parseDate(mappedData.renewalDueDate);
            if (!parsedDue) {
              warnings.push(`Could not parse Renewal Due Date: "${mappedData.renewalDueDate}".`);
              delete mappedData.renewalDueDate;
            } else {
              mappedData.renewalDueDate = parsedDue;
            }
          }
        }

        // Determine Row Status
        let status: 'VALID' | 'WARNING' | 'INVALID' | 'DUPLICATE' = 'VALID';
        if (errors.length > 0) {
          status = 'INVALID';
          invalidRows++;
        } else if (warnings.length > 0) {
          status = 'WARNING';
          warningRows++;
        } else {
          validRows++;
        }

        rowResults.push({
          sheet: lockersSheetName,
          rowNumber,
          status,
          errors,
          warnings,
          data: mappedData,
          action: status === 'INVALID' ? 'FAIL' : 'INSERT',
        });
      }
    }

    // 2. VALIDATE RENEWAL HISTORY SHEET
    if (renewalSheetName && sheetData[renewalSheetName]) {
      const rawRenewalRows = sheetData[renewalSheetName];
      const renewalMapping = columnMappings[renewalSheetName] || {};

      for (let j = 0; j < rawRenewalRows.length; j++) {
        totalRows++;
        const rawRow = rawRenewalRows[j];
        const rowNumber = j + 2;
        const errors: string[] = [];
        const warnings: string[] = [];

        const mappedData: Record<string, any> = {};
        for (const [fileCol, sysField] of Object.entries(renewalMapping)) {
          if (rawRow[fileCol] !== undefined) {
            mappedData[sysField] = rawRow[fileCol];
          }
        }

        const lockerNum = String(mappedData.lockerNumber || '').trim();
        const allocCode = String(mappedData.allocationCode || '').trim();

        if (!lockerNum && !allocCode) {
          errors.push('Locker Number or Allocation Code is required to link historical renewal.');
        }

        // Amount validation
        const totalAmount = importParserService.parseAmount(mappedData.totalAmount);
        if (totalAmount === null || totalAmount <= 0) {
          errors.push(`Invalid invoice total amount: "${mappedData.totalAmount}".`);
        } else {
          mappedData.totalAmount = totalAmount;
        }

        const paidAmount = importParserService.parseAmount(mappedData.paidAmount);
        mappedData.paidAmount = paidAmount !== null && paidAmount >= 0 ? paidAmount : 0;
        mappedData.balanceAmount = Math.max(0, (mappedData.totalAmount || 0) - mappedData.paidAmount);

        // Due date validation
        if (mappedData.dueDate) {
          const parsedDue = importParserService.parseDate(mappedData.dueDate);
          if (!parsedDue) {
            warnings.push(`Unparseable Due Date: "${mappedData.dueDate}".`);
            mappedData.dueDate = new Date();
          } else {
            mappedData.dueDate = parsedDue;
          }
        } else {
          mappedData.dueDate = new Date();
        }

        // Billing period dates
        if (mappedData.periodStart) {
          mappedData.periodStart = importParserService.parseDate(mappedData.periodStart) || mappedData.dueDate;
        }
        if (mappedData.periodEnd) {
          mappedData.periodEnd = importParserService.parseDate(mappedData.periodEnd) || mappedData.dueDate;
        }

        // Payment status
        const payStatusRaw = String(mappedData.paymentStatus || '').trim().toUpperCase();
        if (['PAID', 'YES', 'CLEARED', 'SETTLED'].includes(payStatusRaw)) {
          mappedData.paymentStatus = 'PAID';
          if (mappedData.paidAmount === 0 && mappedData.totalAmount > 0) {
            mappedData.paidAmount = mappedData.totalAmount;
            mappedData.balanceAmount = 0;
          }
        } else if (['UNPAID', 'DUE', 'PENDING', 'NO'].includes(payStatusRaw)) {
          mappedData.paymentStatus = 'UNPAID';
        } else if (mappedData.paidAmount > 0 && mappedData.balanceAmount > 0) {
          mappedData.paymentStatus = 'PARTIALLY_PAID';
        } else if (mappedData.paidAmount >= (mappedData.totalAmount || 0)) {
          mappedData.paymentStatus = 'PAID';
        } else {
          mappedData.paymentStatus = 'UNPAID';
        }

        let status: 'VALID' | 'WARNING' | 'INVALID' | 'DUPLICATE' = 'VALID';
        if (errors.length > 0) {
          status = 'INVALID';
          invalidRows++;
        } else if (warnings.length > 0) {
          status = 'WARNING';
          warningRows++;
        } else {
          validRows++;
        }

        rowResults.push({
          sheet: renewalSheetName,
          rowNumber,
          status,
          errors,
          warnings,
          data: mappedData,
          action: status === 'INVALID' ? 'FAIL' : 'INSERT',
        });
      }
    }

    return {
      totalRows,
      validRows,
      invalidRows,
      warningRows,
      duplicateRows,
      rowResults,
    };
  }
}

export const importValidationService = new ImportValidationService();

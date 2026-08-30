export type ImportType =
  | 'FULL_MIGRATION'
  | 'LOCKERS'
  | 'CUSTOMERS'
  | 'ALLOCATIONS'
  | 'RENEWAL_HISTORY'
  | 'LEGACY_IMPORT';

export type ImportStatus =
  | 'UPLOADED'
  | 'VALIDATING'
  | 'READY'
  | 'IMPORTING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED'
  | 'CANCELLED'
  | 'ROLLED_BACK';

export type ImportRowStatus = 'VALID' | 'WARNING' | 'INVALID' | 'DUPLICATE';

export interface ImportRowResult {
  sheet: string;
  rowNumber: number;
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  data: Record<string, any>;
  action?: 'INSERT' | 'UPDATE' | 'SKIP' | 'FAIL';
}

export interface ImportValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  duplicateRows: number;
}

export interface ImportCommitSummary {
  insertedRows: number;
  updatedRows: number;
  skippedRows: number;
  failedRows: number;
}

export interface ImportReconciliationReport {
  isReconciled: boolean;
  totalLockers: number;
  totalOccupiedLockers: number;
  totalVacantLockers: number;
  totalActiveAllocations: number;
  conflicts: string[];
  notes?: string;
}

export interface ImportJob {
  _id: string;
  jobNumber: string;
  importType: ImportType;
  fileName: string;
  fileSize: number;
  fileHash: string;
  status: ImportStatus;
  sheetNames: string[];
  sheetData?: Record<string, any[]>;
  columnMappings: Record<string, Record<string, string>>;
  validationSummary: ImportValidationSummary;
  commitSummary: ImportCommitSummary;
  rowResults?: ImportRowResult[];
  reconciliation?: ImportReconciliationReport;
  options: {
    importMode: 'INSERT_ONLY' | 'UPSERT_SAFE';
    allowPartial: boolean;
  };
  startedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  completedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  startedAt?: string;
  completedAt?: string;
  rolledBackAt?: string;
  rollbackReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponseData {
  job: ImportJob;
  detectedSheets: {
    lockersSheet?: string;
    renewalHistorySheet?: string;
    customersSheet?: string;
  };
  isDuplicateFile: boolean;
  duplicateJobNumber?: string;
}

export interface ValidationResponseData {
  job: ImportJob;
  validationSummary: ImportValidationSummary;
  rowResultsPreview: ImportRowResult[];
}

import { Schema, model, Document, Types } from 'mongoose';
import {
  ImportType,
  IMPORT_TYPES,
  ImportStatus,
  IMPORT_STATUSES,
  ImportRowStatus,
  IMPORT_ROW_STATUSES,
  ImportMode,
  IMPORT_MODES,
} from '../constants/import.constants';

export interface IImportRowResult {
  sheet: string;
  rowNumber: number;
  status: ImportRowStatus;
  errors: string[];
  warnings: string[];
  data: Record<string, any>;
  action?: 'INSERT' | 'UPDATE' | 'SKIP' | 'FAIL';
}

export interface IImportJob extends Document {
  _id: Types.ObjectId;
  jobNumber: string;
  importType: ImportType;
  fileName: string;
  fileSize: number;
  fileHash: string;

  status: ImportStatus;
  sheetNames: string[];
  sheetData: Record<string, any[]>;
  columnMappings: Record<string, Record<string, string>>;

  validationSummary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    warningRows: number;
    duplicateRows: number;
  };

  commitSummary: {
    insertedRows: number;
    updatedRows: number;
    skippedRows: number;
    failedRows: number;
  };

  rowResults: IImportRowResult[];

  reconciliation?: {
    isReconciled: boolean;
    totalActiveAllocations: number;
    totalOccupiedLockers: number;
    conflicts: string[];
    notes?: string;
  };

  options: {
    importMode: ImportMode;
    allowPartial: boolean;
  };

  createdRecordIds: {
    lockers: Types.ObjectId[];
    customers: Types.ObjectId[];
    allocations: Types.ObjectId[];
    invoices: Types.ObjectId[];
    payments: Types.ObjectId[];
    kycDocs: Types.ObjectId[];
  };

  startedBy?: Types.ObjectId;
  completedBy?: Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;

  rolledBackAt?: Date;
  rolledBackBy?: Types.ObjectId;
  rollbackReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const importRowResultSchema = new Schema<IImportRowResult>(
  {
    sheet: { type: String, required: true },
    rowNumber: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(IMPORT_ROW_STATUSES),
      required: true,
    },
    errors: [{ type: String }],
    warnings: [{ type: String }],
    data: { type: Schema.Types.Mixed, default: {} },
    action: { type: String, enum: ['INSERT', 'UPDATE', 'SKIP', 'FAIL'] },
  },
  { _id: false }
);

const importJobSchema = new Schema<IImportJob>(
  {
    jobNumber: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    importType: {
      type: String,
      enum: Object.values(IMPORT_TYPES),
      default: IMPORT_TYPES.FULL_MIGRATION,
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    fileHash: {
      type: String,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(IMPORT_STATUSES),
      default: IMPORT_STATUSES.UPLOADED,
      index: true,
    },
    sheetNames: [{ type: String }],
    sheetData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    columnMappings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    validationSummary: {
      totalRows: { type: Number, default: 0 },
      validRows: { type: Number, default: 0 },
      invalidRows: { type: Number, default: 0 },
      warningRows: { type: Number, default: 0 },
      duplicateRows: { type: Number, default: 0 },
    },
    commitSummary: {
      insertedRows: { type: Number, default: 0 },
      updatedRows: { type: Number, default: 0 },
      skippedRows: { type: Number, default: 0 },
      failedRows: { type: Number, default: 0 },
    },
    rowResults: [importRowResultSchema],
    reconciliation: {
      isReconciled: { type: Boolean, default: true },
      totalActiveAllocations: { type: Number, default: 0 },
      totalOccupiedLockers: { type: Number, default: 0 },
      conflicts: [{ type: String }],
      notes: { type: String },
    },
    options: {
      importMode: {
        type: String,
        enum: Object.values(IMPORT_MODES),
        default: IMPORT_MODES.INSERT_ONLY,
      },
      allowPartial: { type: Boolean, default: true },
    },
    createdRecordIds: {
      lockers: [{ type: Schema.Types.ObjectId, ref: 'Locker' }],
      customers: [{ type: Schema.Types.ObjectId, ref: 'Customer' }],
      allocations: [{ type: Schema.Types.ObjectId, ref: 'LockerAllocation' }],
      invoices: [{ type: Schema.Types.ObjectId, ref: 'LockerInvoice' }],
      payments: [{ type: Schema.Types.ObjectId, ref: 'Payment' }],
      kycDocs: [{ type: Schema.Types.ObjectId, ref: 'CustomerKycDocument' }],
    },
    startedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    rolledBackAt: { type: Date },
    rolledBackBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    rollbackReason: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast history search and duplicate upload check
importJobSchema.index({ fileHash: 1, status: 1 });
importJobSchema.index({ status: 1, createdAt: -1 });

export const ImportJob = model<IImportJob>('ImportJob', importJobSchema);

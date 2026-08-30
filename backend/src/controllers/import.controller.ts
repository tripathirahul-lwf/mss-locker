import { Request, Response } from 'express';
import { ImportJob } from '../models/ImportJob';
import { importParserService } from '../services/import-parser.service';
import { importValidationService } from '../services/import-validation.service';
import { importCommitService } from '../services/import-commit.service';
import { importReconciliationService } from '../services/import-reconciliation.service';
import { importTemplateService } from '../services/import-template.service';
import { logger } from '../utils/logger';

export class ImportController {
  /**
   * Uploads and parses an Excel or CSV file
   */
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }

      const importType = (req.body.importType || 'FULL_MIGRATION').toUpperCase();
      const parsed = await importParserService.parseWorkbook(file.buffer, file.originalname);

      // Check for duplicate file upload
      const existingJob = await ImportJob.findOne({
        fileHash: parsed.fileHash,
        status: { $in: ['COMPLETED', 'READY'] },
      }).sort({ createdAt: -1 });

      const count = await ImportJob.countDocuments();
      const jobNumber = `IMP-${new Date().getFullYear()}-${String(count + 1).padStart(6, '0')}`;

      const job = await ImportJob.create({
        jobNumber,
        importType,
        fileName: file.originalname,
        fileSize: file.size,
        fileHash: parsed.fileHash,
        status: 'UPLOADED',
        sheetNames: parsed.sheetNames,
        sheetData: parsed.sheetData,
        columnMappings: parsed.autoMappings,
        startedBy: (req as any).user?._id,
        startedAt: new Date(),
      });

      res.status(201).json({
        success: true,
        message: 'File parsed and uploaded successfully',
        data: {
          job,
          detectedSheets: parsed.detectedSheets,
          isDuplicateFile: Boolean(existingJob),
          duplicateJobNumber: existingJob?.jobNumber,
        },
      });
    } catch (error: any) {
      logger.error('Error during file upload and parse:', error);
      res.status(500).json({ success: false, message: error.message || 'File upload failed' });
    }
  }

  /**
   * Runs dry-run validation on mapped sheet data
   */
  async validateJob(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const { columnMappings, lockersSheet, renewalSheet } = req.body;

      const job = await ImportJob.findById(id);
      if (!job) {
        res.status(404).json({ success: false, message: 'Import job not found' });
        return;
      }

      const mappings = columnMappings || job.columnMappings;
      const lockersSheetName = lockersSheet || job.sheetNames.find((s) => s.toLowerCase().includes('locker')) || job.sheetNames[0];
      const renewalSheetName = renewalSheet || job.sheetNames.find((s) => s.toLowerCase().includes('renewal'));

      job.status = 'VALIDATING';
      job.columnMappings = mappings;
      await job.save();

      const validation = await importValidationService.validateJobData(
        job.sheetData,
        mappings,
        lockersSheetName,
        renewalSheetName
      );

      job.validationSummary = {
        totalRows: validation.totalRows,
        validRows: validation.validRows,
        invalidRows: validation.invalidRows,
        warningRows: validation.warningRows,
        duplicateRows: validation.duplicateRows,
      };
      job.rowResults = validation.rowResults;
      job.status = 'READY';
      await job.save();

      res.status(200).json({
        success: true,
        message: 'Validation completed',
        data: {
          job,
          validationSummary: job.validationSummary,
          rowResultsPreview: job.rowResults.slice(0, 100),
        },
      });
    } catch (error: any) {
      logger.error('Error validating import job:', error);
      res.status(500).json({ success: false, message: error.message || 'Validation failed' });
    }
  }

  /**
   * Commits validated data into live collections
   */
  async commitJob(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;

      const job = await importCommitService.commitJob(id, userId);

      // Run post-import reconciliation
      const reconciliation = await importReconciliationService.runReconciliation();
      job.reconciliation = reconciliation;
      await job.save();

      res.status(200).json({
        success: true,
        message: 'Import committed successfully',
        data: {
          job,
          reconciliation,
        },
      });
    } catch (error: any) {
      logger.error('Error committing import job:', error);
      res.status(500).json({ success: false, message: error.message || 'Commit failed' });
    }
  }

  /**
   * Fetches list of all import jobs
   */
  async getImportJobs(req: Request, res: Response): Promise<void> {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
      const skip = (page - 1) * limit;

      const [jobs, total] = await Promise.all([
        ImportJob.find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('startedBy', 'name username')
          .populate('completedBy', 'name username')
          .select('-sheetData -rowResults')
          .lean(),
        ImportJob.countDocuments({}),
      ]);

      res.status(200).json({
        success: true,
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      logger.error('Error fetching import jobs:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch jobs' });
    }
  }

  /**
   * Fetches full job details including validation logs
   */
  async getImportJobById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const job = await ImportJob.findById(id)
        .populate('startedBy', 'name username')
        .populate('completedBy', 'name username');

      if (!job) {
        res.status(404).json({ success: false, message: 'Import job not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: job,
      });
    } catch (error: any) {
      logger.error('Error fetching import job by id:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to fetch job' });
    }
  }

  /**
   * Streams downloadable CSV of row errors and warnings
   */
  async getImportErrorsCsv(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const job = await ImportJob.findById(id);
      if (!job) {
        res.status(404).json({ success: false, message: 'Import job not found' });
        return;
      }

      const issues = job.rowResults.filter(
        (r) => r.status === 'INVALID' || r.status === 'WARNING'
      );

      const headers = ['Sheet', 'Row Number', 'Status', 'Errors', 'Warnings', 'Locker Number', 'Customer'];
      const rows = issues.map((r) => [
        `"${r.sheet}"`,
        r.rowNumber,
        r.status,
        `"${r.errors.join('; ')}"`,
        `"${r.warnings.join('; ')}"`,
        `"${r.data?.lockerNumber || ''}"`,
        `"${r.data?.customerName || ''}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${job.jobNumber}-validation-issues.csv"`);
      res.status(200).send(csvContent);
    } catch (error: any) {
      logger.error('Error generating import errors CSV:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to generate error report' });
    }
  }

  /**
   * Safely rolls back an imported job
   */
  async rollbackJob(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const userId = (req as any).user?._id;
      const reason = req.body.reason || 'Admin rollback request';

      const job = await importCommitService.rollbackJob(id, userId, reason);

      res.status(200).json({
        success: true,
        message: 'Import job successfully rolled back',
        data: job,
      });
    } catch (error: any) {
      logger.error('Error rolling back import job:', error);
      res.status(500).json({ success: false, message: error.message || 'Rollback failed' });
    }
  }

  /**
   * Downloads official migration templates
   */
  async downloadTemplate(req: Request, res: Response): Promise<void> {
    try {
      const type = String(req.params.type || 'full-migration').toLowerCase();
      let buffer: Buffer;
      let fileName = 'vault-ledger-full-migration-template.xlsx';

      if (type === 'lockers') {
        buffer = await importTemplateService.generateLockersTemplate();
        fileName = 'vault-ledger-lockers-template.xlsx';
      } else if (type === 'customers') {
        buffer = await importTemplateService.generateCustomerTemplate();
        fileName = 'vault-ledger-customers-template.xlsx';
      } else {
        buffer = await importTemplateService.generateFullMigrationTemplate();
        fileName = 'vault-ledger-full-migration-template.xlsx';
      }

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(buffer);
    } catch (error: any) {
      logger.error('Error generating template:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to download template' });
    }
  }
}

export const importController = new ImportController();

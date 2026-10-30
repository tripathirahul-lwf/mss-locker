import { Payment } from '../models/Payment';
import { Customer } from '../models/Customer';
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { StorageService } from '../services/storage.service';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { CustomerKycDocument } from '../models/CustomerKycDocument';

// Configure multer with memory storage and 5MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (_req, file, cb) => {
    if (StorageService.isValidMimeType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file format '${file.mimetype}'. Only JPG, PNG, WebP, and PDF files are permitted.`
        )
      );
    }
  },
});

export const uploadSingleMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(Object.assign(new Error('File exceeds the 5 MB upload limit.'), { statusCode: 413 }));
    }
    return next(Object.assign(error instanceof Error ? error : new Error('Unable to process uploaded file.'), { statusCode: 400 }));
  });
};

export class UploadController {
  static async downloadPrivateFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filePath = StorageService.resolvePrivateKycFile(String(req.params.fileName));
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }

  static async uploadFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json(errorResponse('No file provided for upload.'));
        return;
      }

      const folder = (req.body.folder as string) || 'general';

      const result = await StorageService.uploadFile({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        folder,
      });

      res.status(201).json(successResponse('File uploaded successfully', result));
    } catch (error) {
      next(error);
    }
  }

  static async downloadPrivateCloudFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fileUrl = `/api/upload/private/cloud/${req.params.token}`;
      const canViewKyc = req.user?.isSuperAdmin || req.user?.permissions.includes('customers.kyc.view');
      const canViewReceipt = req.user?.permissions.includes('payments.view') && await Payment.exists({ proofUrl: fileUrl });
      if (!canViewKyc && !canViewReceipt) { res.status(403).json(errorResponse('Document access permission required.')); return; }
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      const file = await StorageService.readPrivateFile(String(req.params.token));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      res.type(file.mimeType).send(file.buffer);
    } catch (error) { next(error); }
  }

  static async deleteUploadedFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const fileUrl = typeof req.body?.fileUrl === 'string' ? req.body.fileUrl : '';
      StorageService.assertPrivateDocumentUrl(fileUrl);
      if (await CustomerKycDocument.exists({ documentUrl: fileUrl, isActive: true }) || await Payment.exists({ proofUrl: fileUrl }) || await Customer.exists({ photoUrl: fileUrl })) {
        throw Object.assign(new Error('Attached KYC documents must be removed through the customer document workflow.'), { statusCode: 409 });
      }
      await StorageService.deleteFile(fileUrl);
      res.json(successResponse('Uploaded file removed'));
    } catch (error) { next(error); }
  }
}

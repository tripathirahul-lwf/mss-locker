import { Router } from 'express';
import multer from 'multer';
import { importController } from '../controllers/import.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max limit
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv',
    ];
    if (
      allowed.includes(file.mimetype) ||
      file.originalname.match(/\.(xlsx|csv)$/i)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .csv files are supported'));
    }
  },
});

router.use(authenticate);

// Template downloads
router.get(
  '/templates/:type',
  requirePermission(PERMISSIONS.IMPORTS_VIEW),
  importController.downloadTemplate
);

// List import jobs
router.get(
  '/',
  requirePermission(PERMISSIONS.IMPORTS_VIEW),
  importController.getImportJobs
);

// Upload & Parse
router.post(
  '/upload',
  requirePermission(PERMISSIONS.IMPORTS_CREATE),
  upload.single('file'),
  importController.uploadFile
);

// Get single job details
router.get(
  '/:id',
  requirePermission(PERMISSIONS.IMPORTS_VIEW),
  importController.getImportJobById
);

// Dry-run validate
router.post(
  '/:id/validate',
  requirePermission(PERMISSIONS.IMPORTS_VALIDATE),
  importController.validateJob
);

// Commit import
router.post(
  '/:id/commit',
  requirePermission(PERMISSIONS.IMPORTS_COMMIT),
  importController.commitJob
);

// Download error CSV
router.get(
  '/:id/errors',
  requirePermission(PERMISSIONS.IMPORTS_VIEW),
  importController.getImportErrorsCsv
);

// Rollback import
router.post(
  '/:id/rollback',
  requirePermission(PERMISSIONS.IMPORTS_ROLLBACK),
  importController.rollbackJob
);

export default router;

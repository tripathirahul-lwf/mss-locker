import { Router } from 'express';
import {
  UploadController,
  uploadSingleMiddleware,
} from '../controllers/upload.controller';
import { authenticate, requireAnyPermission, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// File upload requires Customer Create, KYC Manage, or Payment Collect permissions
router.post(
  '/file',
  authenticate,
  requireAnyPermission(
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_KYC_MANAGE,
    PERMISSIONS.PAYMENTS_CREATE
  ),
  uploadSingleMiddleware,
  UploadController.uploadFile
);

// File deletion requires KYC Manage permission
router.delete(
  '/file',
  authenticate,
  requirePermission(PERMISSIONS.CUSTOMERS_KYC_MANAGE),
  UploadController.deleteUploadedFile
);

// Cryptographically HMAC-signed Cloudinary private document redirect.
// Security: Asset reference is verified via HMAC-SHA256 signature in StorageService.decodeRef.
// Direct GET access is required for browser <img>, <iframe> and window.open compatibility.
router.get(
  '/private/cloud/:token',
  UploadController.downloadPrivateCloudFile
);

// Legacy local private files (authenticated with KYC View permission)
router.get(
  '/private/:fileName',
  authenticate,
  requirePermission(PERMISSIONS.CUSTOMERS_KYC_VIEW),
  UploadController.downloadPrivateFile
);

export default router;

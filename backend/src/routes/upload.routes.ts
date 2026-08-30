import { Router } from 'express';
import {
  UploadController,
  uploadSingleMiddleware,
} from '../controllers/upload.controller';
import { authenticate, requireAnyPermission, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

router.post('/file', requireAnyPermission(PERMISSIONS.CUSTOMERS_CREATE, PERMISSIONS.CUSTOMERS_KYC_MANAGE), uploadSingleMiddleware, UploadController.uploadFile);
router.delete('/file', requirePermission(PERMISSIONS.CUSTOMERS_KYC_MANAGE), UploadController.deleteUploadedFile);
router.get('/private/cloud/:token', requirePermission(PERMISSIONS.CUSTOMERS_KYC_VIEW), UploadController.downloadPrivateCloudFile);
router.get('/private/:fileName', requirePermission(PERMISSIONS.CUSTOMERS_KYC_VIEW), UploadController.downloadPrivateFile);

export default router;

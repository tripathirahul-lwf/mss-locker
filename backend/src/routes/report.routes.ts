import { Router } from 'express';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';
import { exportReport, getReportOverview } from '../controllers/report.controller';

const router = Router();
router.get('/overview', authenticate, requirePermission(PERMISSIONS.REPORTS_VIEW), getReportOverview);
router.get('/export', authenticate, requirePermission(PERMISSIONS.REPORTS_EXPORT), exportReport);
export default router;

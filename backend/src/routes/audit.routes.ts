import { Router } from 'express';
import { authenticate,requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';
import { listAuditLogs,exportAuditLogs } from '../controllers/audit.controller';

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.AUDIT_VIEW));
router.get('/export', exportAuditLogs);
router.get('/', listAuditLogs);
export default router;

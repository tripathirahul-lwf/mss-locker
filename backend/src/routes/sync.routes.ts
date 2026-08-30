import { Router } from 'express';
import { syncController } from '../controllers/sync.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

/**
 * GET /api/sync?cursor=...
 */
router.get('/', syncController.getIncrementalSync);

/**
 * GET /api/sync/dashboard
 */
router.get('/dashboard', requirePermission(PERMISSIONS.DASHBOARD_VIEW), syncController.getDashboardSync);

export default router;

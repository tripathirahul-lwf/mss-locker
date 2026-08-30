import { Router } from 'express';
import { searchController } from '../controllers/search.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

/**
 * GET /api/search?q=&limit=&types=
 */
router.get('/', searchController.globalSearch);

/**
 * GET /api/search/customers/:id/quick-preview
 */
router.get('/customers/:id/quick-preview', requirePermission(PERMISSIONS.CUSTOMERS_VIEW), searchController.getCustomerQuickPreview);

/**
 * GET /api/search/customers/:id/renewal-history
 */
router.get('/customers/:id/renewal-history', requirePermission(PERMISSIONS.RENEWALS_VIEW), searchController.getCustomerRenewalHistory);

/**
 * GET /api/search/lockers/:id/quick-preview
 */
router.get('/lockers/:id/quick-preview', requirePermission(PERMISSIONS.LOCKERS_VIEW), searchController.getLockerQuickPreview);

export default router;

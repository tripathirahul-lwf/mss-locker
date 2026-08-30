import { Router } from 'express';
import { LockerController } from '../controllers/locker.controller';
import { LockerAllocationController } from '../controllers/allocation.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// Apply authentication middleware to all locker routes
router.use(authenticate);

// Locker statistics & availability
router.get('/stats', requirePermission(PERMISSIONS.LOCKERS_VIEW), LockerController.getLockerStats);
router.get(
  '/availability',
  requirePermission(PERMISSIONS.LOCKERS_VIEW),
  LockerController.getAvailableLockers
);

// Standard Locker CRUD
router.get('/', requirePermission(PERMISSIONS.LOCKERS_VIEW), LockerController.getLockers);
router.post('/', requirePermission(PERMISSIONS.LOCKERS_CREATE), LockerController.createLocker);
router.post(
  '/bulk-import',
  requirePermission(PERMISSIONS.LOCKERS_CREATE),
  LockerController.bulkImportLockers
);
router.get('/:id', requirePermission(PERMISSIONS.LOCKERS_VIEW), LockerController.getLockerById);
router.get(
  '/:id/allocations',
  requirePermission(PERMISSIONS.LOCKERS_VIEW),
  LockerAllocationController.getLockerAllocations
);
router.patch('/:id', requirePermission(PERMISSIONS.LOCKERS_UPDATE), LockerController.updateLocker);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.LOCKERS_DELETE),
  LockerController.deactivateLocker
);

export default router;

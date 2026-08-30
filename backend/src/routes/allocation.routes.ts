import { Router } from 'express';
import { LockerAllocationController } from '../controllers/allocation.controller';
import { depositController } from '../controllers/deposit.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// Apply auth to all allocation routes
router.use(authenticate);

/**
 * GET /api/allocations
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.ALLOCATIONS_VIEW),
  LockerAllocationController.getAllocations
);

/**
 * GET /api/allocations/stats
 */
router.get(
  '/stats',
  requirePermission(PERMISSIONS.ALLOCATIONS_VIEW),
  LockerAllocationController.getAllocationStats
);

/**
 * POST /api/allocations
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.ALLOCATIONS_CREATE),
  LockerAllocationController.createAllocation
);

/**
 * POST /api/allocations/reserve
 */
router.post(
  '/reserve',
  requirePermission(PERMISSIONS.ALLOCATIONS_CREATE),
  LockerAllocationController.reserveLocker
);

/**
 * GET /api/allocations/:id
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.ALLOCATIONS_VIEW),
  LockerAllocationController.getAllocationById
);

/**
 * PATCH /api/allocations/:id
 */
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ALLOCATIONS_UPDATE),
  LockerAllocationController.updateAllocation
);

/**
 * POST /api/allocations/:id/activate
 */
router.post(
  '/:id/activate',
  requirePermission(PERMISSIONS.ALLOCATIONS_ACTIVATE),
  LockerAllocationController.activateReservation
);

/**
 * POST /api/allocations/:id/cancel
 */
router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.ALLOCATIONS_CANCEL),
  LockerAllocationController.cancelReservation
);

/**
 * GET /api/allocations/:id/deposit-summary
 */
router.get(
  '/:id/deposit-summary',
  requirePermission(PERMISSIONS.DEPOSITS_VIEW),
  depositController.getDepositSummary
);

/**
 * GET /api/allocations/:id/deposit-transactions
 */
router.get(
  '/:id/deposit-transactions',
  requirePermission(PERMISSIONS.DEPOSITS_VIEW),
  (req, res) => {
    req.query.allocationId = req.params.id;
    return depositController.getDepositTransactions(req, res);
  }
);

export default router;

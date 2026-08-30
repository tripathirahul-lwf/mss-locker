import { Router } from 'express';
import { lockerClosureController } from '../controllers/locker-closure.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// Apply authentication to all closure routes
router.use(authenticate);

/**
 * GET /api/closures/stats
 */
router.get(
  '/stats',
  requirePermission(PERMISSIONS.CLOSURES_VIEW),
  lockerClosureController.getClosureStats
);

/**
 * GET /api/closures
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.CLOSURES_VIEW),
  lockerClosureController.getClosures
);

/**
 * POST /api/closures
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.CLOSURES_CREATE),
  lockerClosureController.createClosure
);

/**
 * GET /api/closures/:id/statement-html
 */
router.get(
  '/:id/statement-html',
  requirePermission(PERMISSIONS.CLOSURES_PRINT),
  lockerClosureController.getClosureStatementHtml
);

/**
 * GET /api/closures/:id/readiness
 */
router.get(
  '/:id/readiness',
  requirePermission(PERMISSIONS.CLOSURES_VIEW),
  lockerClosureController.getClosureReadiness
);

/**
 * POST /api/closures/:id/readiness
 */
router.post(
  '/:id/readiness',
  requirePermission(PERMISSIONS.CLOSURES_VIEW),
  lockerClosureController.getClosureReadiness
);

/**
 * GET /api/closures/:id
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.CLOSURES_VIEW),
  lockerClosureController.getClosureById
);

/**
 * POST /api/closures/:id/submit
 */
router.post(
  '/:id/submit',
  requirePermission(PERMISSIONS.CLOSURES_CREATE),
  lockerClosureController.submitClosure
);

/**
 * POST /api/closures/:id/review
 */
router.post(
  '/:id/review',
  requirePermission(PERMISSIONS.CLOSURES_REVIEW),
  lockerClosureController.reviewClosure
);

/**
 * POST /api/closures/:id/approve
 */
router.post(
  '/:id/approve',
  requirePermission(PERMISSIONS.CLOSURES_APPROVE),
  lockerClosureController.approveClosure
);

/**
 * POST /api/closures/:id/complete
 */
router.post(
  '/:id/complete',
  requirePermission(PERMISSIONS.CLOSURES_COMPLETE),
  lockerClosureController.completeClosure
);

/**
 * POST /api/closures/:id/reject
 */
router.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.CLOSURES_REJECT),
  lockerClosureController.rejectClosure
);

/**
 * POST /api/closures/:id/cancel
 */
router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.CLOSURES_CANCEL),
  lockerClosureController.cancelClosure
);

export default router;

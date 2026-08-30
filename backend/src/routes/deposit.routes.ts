import { Router } from 'express';
import { depositController } from '../controllers/deposit.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// Protect all deposit routes with authentication
router.use(authenticate);

// Top level stats
router.get(
  '/stats',
  requirePermission(PERMISSIONS.DEPOSITS_VIEW),
  depositController.getDepositStats
);

// Ledger list with filters & pagination
router.get(
  '/',
  requirePermission(PERMISSIONS.DEPOSITS_VIEW),
  depositController.getDepositTransactions
);

// Collect Security Deposit
router.post(
  '/collect',
  requirePermission(PERMISSIONS.DEPOSITS_COLLECT),
  depositController.collectDeposit
);

// Adjust Deposit (Deduction/Addition)
router.post(
  '/adjust',
  requirePermission(PERMISSIONS.DEPOSITS_ADJUST),
  depositController.adjustDeposit
);

// Allocation deposit summary
router.get(
  '/allocation/:id/summary',
  requirePermission(PERMISSIONS.DEPOSITS_VIEW),
  depositController.getDepositSummary
);

// Closure financial readiness helper
router.get(
  '/allocation/:id/closure-readiness',
  requirePermission(PERMISSIONS.DEPOSITS_VIEW),
  depositController.getClosureReadiness
);

// Deposit transaction details
router.get(
  '/:id',
  requirePermission(PERMISSIONS.DEPOSITS_VIEW),
  depositController.getDepositTransactionById
);

// Soft cancel transaction
router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.DEPOSITS_ADJUST),
  depositController.cancelDepositTransaction
);

export default router;

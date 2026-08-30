import { Router } from 'express';
import { refundController } from '../controllers/refund.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// Protect all refund routes with authentication
router.use(authenticate);

// List refund requests with filters & pagination
router.get(
  '/',
  requirePermission(PERMISSIONS.REFUNDS_VIEW),
  refundController.getRefunds
);

// Create new refund request
router.post(
  '/',
  requirePermission(PERMISSIONS.REFUNDS_CREATE),
  refundController.createRefund
);

// Get single refund request details
router.get(
  '/:id',
  requirePermission(PERMISSIONS.REFUNDS_VIEW),
  refundController.getRefundById
);

// Submit draft refund request
router.post(
  '/:id/submit',
  requirePermission(PERMISSIONS.REFUNDS_CREATE),
  refundController.submitRefund
);

// Approve refund request (Maker-Checker authorization)
router.post(
  '/:id/approve',
  requirePermission(PERMISSIONS.REFUNDS_APPROVE),
  refundController.approveRefund
);

// Reject refund request
router.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.REFUNDS_REJECT),
  refundController.rejectRefund
);

// Pay/Disburse approved refund
router.post(
  '/:id/pay',
  requirePermission(PERMISSIONS.REFUNDS_PAY),
  refundController.payRefund
);

// Cancel refund request
router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.REFUNDS_CANCEL),
  refundController.cancelRefund
);

export default router;

import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// Apply authentication to all payment routes
router.use(authenticate);

/**
 * GET /api/payments/stats
 */
router.get(
  '/stats',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  paymentController.getPaymentStats
);

/**
 * GET /api/payments
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  paymentController.getPayments
);

/**
 * POST /api/payments
 */
router.post(
  '/',
  requirePermission(PERMISSIONS.PAYMENTS_CREATE),
  paymentController.recordPayment
);

/**
 * GET /api/payments/:id/receipt-html
 */
router.get(
  '/:id/receipt-html',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  paymentController.getPaymentReceiptHtml
);

/**
 * GET /api/payments/:id
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  paymentController.getPaymentById
);

/**
 * POST /api/payments/:id/cancel
 */
router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.PAYMENTS_CANCEL),
  paymentController.cancelPayment
);

/**
 * GET /api/payments/customer/:id
 */
router.get(
  '/customer/:id',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  paymentController.getCustomerPayments
);

/**
 * GET /api/payments/locker/:id
 */
router.get(
  '/locker/:id',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  paymentController.getLockerPayments
);

/**
 * GET /api/payments/invoice/:id
 */
router.get(
  '/invoice/:id',
  requirePermission(PERMISSIONS.PAYMENTS_VIEW),
  paymentController.getInvoicePayments
);

export default router;

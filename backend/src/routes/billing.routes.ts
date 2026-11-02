import { Router } from 'express';
import { renewalCollectionSchema } from '../validators/renewalCollection.validator';
import { RenewalCollectionService } from '../services/renewalCollection.service';
import { billingController } from '../controllers/billing.controller';
import { authenticate,requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// Apply authentication to all billing & renewal routes
router.use(authenticate);

router.post('/collect', requirePermission(PERMISSIONS.RENEWALS_CREATE, PERMISSIONS.PAYMENTS_CREATE), async (req,res,next) => {
  try { const input=renewalCollectionSchema.parse(req.body); const data=await RenewalCollectionService.complete(input,req.user!.userId,req.user!.username); res.status(201).json({success:true,data,message:'Locker renewed and cash receipt recorded'}); } catch(error) { next(error); }
});


/**
 * GET /api/renewals/stats
 */
router.get(
  '/stats',
  requirePermission(PERMISSIONS.RENEWALS_VIEW),
  billingController.getRenewalStats
);

/**
 * GET /api/renewals
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.RENEWALS_VIEW),
  billingController.getInvoices
);

/**
 * POST /api/renewals/generate
 */
router.post(
  '/generate',
  requirePermission(PERMISSIONS.RENEWALS_CREATE),
  billingController.generateRenewal
);

router.get(
  '/:id/pdf',
  requirePermission(PERMISSIONS.RENEWALS_VIEW),
  billingController.downloadInvoicePdf
);

router.get(
  '/:id/html',
  requirePermission(PERMISSIONS.RENEWALS_VIEW),
  billingController.getInvoiceHtml
);

/**
 * GET /api/renewals/:id
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.RENEWALS_VIEW),
  billingController.getInvoiceById
);

/**
 * POST /api/renewals/:id/cancel
 */
router.post(
  '/:id/cancel',
  requirePermission(PERMISSIONS.RENEWALS_CREATE),
  billingController.cancelInvoice
);

/**
 * PATCH /api/renewals/:id/billing-period
 */
router.patch(
  '/:id/billing-period',
  requirePermission(PERMISSIONS.RENEWALS_CREATE),
  billingController.updateInvoiceBillingPeriod
);

/**
 * GET /api/renewals/customer/:id
 */
router.get(
  '/customer/:id',
  requirePermission(PERMISSIONS.RENEWALS_VIEW),
  billingController.getCustomerInvoices
);

/**
 * GET /api/renewals/locker/:id
 */
router.get(
  '/locker/:id',
  requirePermission(PERMISSIONS.RENEWALS_VIEW),
  billingController.getLockerInvoices
);

/**
 * GET /api/renewals/allocation/:id
 */
router.get(
  '/allocation/:id',
  requirePermission(PERMISSIONS.RENEWALS_VIEW),
  billingController.getAllocationInvoices
);

export default router;

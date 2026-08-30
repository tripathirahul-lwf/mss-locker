import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { CustomerKycController } from '../controllers/customerKyc.controller';
import { LockerAllocationController } from '../controllers/allocation.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);

// Statistics and duplicate checks
router.get(
  '/stats',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  CustomerController.getCustomerStats
);
router.post(
  '/check-duplicate',
  requirePermission(PERMISSIONS.CUSTOMERS_CREATE),
  CustomerController.checkDuplicate
);

// Customer CRUD
router.get(
  '/',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  CustomerController.getCustomers
);
router.post(
  '/',
  requirePermission(PERMISSIONS.CUSTOMERS_CREATE),
  CustomerController.createCustomer
);
router.get(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  CustomerController.getCustomerById
);
router.patch(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  CustomerController.updateCustomer
);
router.delete(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_DELETE),
  CustomerController.deactivateCustomer
);

// Customer Allocations History
router.get(
  '/:id/allocations',
  requirePermission(PERMISSIONS.ALLOCATIONS_VIEW),
  LockerAllocationController.getCustomerAllocations
);

// Customer KYC Document Endpoints
router.get(
  '/:id/kyc',
  requirePermission(PERMISSIONS.CUSTOMERS_KYC_VIEW),
  CustomerKycController.getKycDocuments
);
router.post(
  '/:id/kyc',
  requirePermission(PERMISSIONS.CUSTOMERS_KYC_MANAGE),
  CustomerKycController.addKycDocument
);
router.patch(
  '/:id/kyc/:kycId',
  requirePermission(PERMISSIONS.CUSTOMERS_KYC_MANAGE),
  CustomerKycController.updateKycDocument
);
router.delete(
  '/:id/kyc/:kycId',
  requirePermission(PERMISSIONS.CUSTOMERS_KYC_MANAGE),
  CustomerKycController.deleteKycDocument
);
router.post(
  '/:id/kyc/:kycId/verify',
  requirePermission(PERMISSIONS.CUSTOMERS_KYC_VERIFY),
  CustomerKycController.verifyKycDocument
);

export default router;

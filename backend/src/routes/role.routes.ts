import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { authenticate,requirePermission } from '../middlewares/auth';
import { validateRequest } from '../validators';
import { updateRoleSchema } from '../validators/role.validator';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

router.use(authenticate);
router.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});

router.get(
  '/',
  requirePermission(PERMISSIONS.ROLES_VIEW),
  RoleController.getRoles
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.ROLES_VIEW),
  validateRequest(updateRoleSchema.pick({ params: true })),
  RoleController.getRoleById
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.ROLES_MANAGE),
  validateRequest(updateRoleSchema),
  RoleController.updateRole
);

export const roleRoutes = router;

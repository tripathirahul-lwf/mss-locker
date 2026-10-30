import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, requirePermission, requireAnyPermission } from '../middlewares/auth';
import { validateRequest } from '../validators';
import {
  createUserSchema,
  updateUserSchema,
  resetUserPasswordSchema,
  queryUsersSchema, userIdSchema,
} from '../validators/user.validator';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// All user routes require authentication
router.use(authenticate);
router.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
router.get('/assignable-roles', requireAnyPermission(PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_CREATE, PERMISSIONS.USERS_UPDATE), UserController.assignableRoles);

router.get(
  '/',
  requirePermission(PERMISSIONS.USERS_VIEW),
  validateRequest(queryUsersSchema),
  UserController.getUsers
);

router.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  validateRequest(createUserSchema),
  UserController.createUser
);

router.get(
  '/:id',
  requirePermission(PERMISSIONS.USERS_VIEW),
  validateRequest(userIdSchema),
  UserController.getUserById
);

router.patch(
  '/:id',
  (req, res, next) => {
    const statusOnly = Object.keys(req.body || {}).every(key => key === 'status') && req.body?.status;
    return requirePermission(statusOnly ? PERMISSIONS.USERS_DEACTIVATE : PERMISSIONS.USERS_UPDATE)(req, res, next);
  },
  validateRequest(updateUserSchema),
  UserController.updateUser
);

router.post(
  '/:id/reset-password',
  requirePermission(PERMISSIONS.USERS_RESET_PASSWORD),
  validateRequest(resetUserPasswordSchema),
  UserController.resetPassword
);

export const userRoutes = router;

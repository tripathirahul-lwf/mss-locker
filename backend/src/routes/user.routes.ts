import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate, requirePermission } from '../middlewares/auth';
import { validateRequest } from '../validators';
import {
  createUserSchema,
  updateUserSchema,
  resetUserPasswordSchema,
  queryUsersSchema,
} from '../validators/user.validator';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

// All user routes require authentication
router.use(authenticate);

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
  UserController.getUserById
);

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.USERS_UPDATE),
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

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { verifyBrowserOrigin } from '../middlewares/verifyBrowserOrigin';
import { loginRateLimiter, refreshRateLimiter } from '../middlewares/rateLimiter';
import { validateRequest } from '../validators';
import { loginSchema, changePasswordSchema } from '../validators/auth.validator';

const router = Router();

router.post('/login', loginRateLimiter, verifyBrowserOrigin, validateRequest(loginSchema), AuthController.login);
router.post('/refresh', refreshRateLimiter, verifyBrowserOrigin, AuthController.refresh);
router.post('/logout', verifyBrowserOrigin, AuthController.logout);
router.get('/me', authenticate, AuthController.getMe);
router.post('/change-password', authenticate, validateRequest(changePasswordSchema), AuthController.changePassword);

export const authRoutes = router;

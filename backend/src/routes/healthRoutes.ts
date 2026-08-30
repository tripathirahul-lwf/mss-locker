import { Router } from 'express';
import { checkHealth, checkLiveness, checkReadiness } from '../controllers/healthController';

const router = Router();

router.get('/health', checkHealth);
router.get('/health/live', checkLiveness);
router.get('/health/ready', checkReadiness);

export const healthRoutes = router;

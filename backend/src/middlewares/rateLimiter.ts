import rateLimit from 'express-rate-limit';

const response = (message: string) => ({ success: false, message });

const isLocalOrDev = (ip?: string): boolean => {
  if (process.env.NODE_ENV !== 'production') return true;
  if (!ip) return false;
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => (isLocalOrDev(req.ip) ? 50000 : 2500),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const p = req.path || req.originalUrl || '';
    return p === '/health' || p.endsWith('/health') || p.includes('/api/health');
  },
  message: response('Too many requests from this IP, please try again after 15 minutes'),
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req) => (isLocalOrDev(req.ip) ? 100 : 20),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.identifier || '').trim().toLowerCase()}`,
  message: response('Too many login attempts. Please try again after 15 minutes.'),
});

export const refreshRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: (req) => (isLocalOrDev(req.ip) ? 1000 : 200),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalOrDev(req.ip),
  message: response('Too many session refresh attempts. Please wait and try again.'),
});


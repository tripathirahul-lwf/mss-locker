import rateLimit from 'express-rate-limit';

const response = (message: string) => ({ success: false, message });

export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: response('Too many requests from this IP, please try again after 15 minutes'),
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.identifier || '').trim().toLowerCase()}`,
  message: response('Too many login attempts. Please try again after 15 minutes.'),
});

export const refreshRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: response('Too many session refresh attempts. Please wait and try again.'),
});

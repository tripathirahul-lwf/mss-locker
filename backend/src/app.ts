import express, { Application } from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { requestLogger } from './middlewares/requestLogger';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { notFoundHandler } from './middlewares/notFoundHandler';
import { errorHandler } from './middlewares/errorHandler';
import { apiRouter } from './routes';
import { requestContext } from './middlewares/requestContext';

const app: Application = express();
app.disable('x-powered-by');
if (env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(requestContext);

// Security Headers (configured to allow local image rendering)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration with dynamic localhost & production origin support
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      
      // Allow configured client URL and Vercel / Render origins
      if (
        env.CLIENT_URL === '*' ||
        origin === env.CLIENT_URL ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.onrender.com')
      ) {
        return callback(null, true);
      }

      // Allow all local development origins (localhost & 127.0.0.1 on any port like 5173, 5174, 5175, 3000, etc.)
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
  })
);

// Lightweight Root Health Check for Render & External Uptime Keep-Alive Monitors
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Rate Limiting
app.use(globalRateLimiter);

// Cookie Parser for HttpOnly refresh tokens
app.use(cookieParser());

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving for uploaded photos & KYC documents
// Public static delivery is intentionally limited to non-sensitive general files.
// Customer photos and KYC documents are delivered through authenticated routes.
app.use('/uploads/general', express.static(path.resolve(process.cwd(), 'uploads', 'general'), {
  dotfiles: 'deny',
  fallthrough: false,
  index: false,
  maxAge: env.NODE_ENV === 'production' ? '1h' : 0,
}));
// Customer photos remain image-tag compatible; identity documents are never static-served.
app.use('/uploads/photos', express.static(path.resolve(process.cwd(), 'uploads', 'photos'), {
  dotfiles: 'deny', fallthrough: false, index: false, maxAge: env.NODE_ENV === 'production' ? '1h' : 0,
}));

// Request Logging
app.use(requestLogger);

// Mount API Routes
app.use('/api', apiRouter);

// 404 Handler
app.use(notFoundHandler);

// Centralized Error Handler
app.use(errorHandler);

export { app };

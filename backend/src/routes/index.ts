import { Router } from 'express';
import { healthRoutes } from './healthRoutes';
import { authRoutes } from './auth.routes';
import { userRoutes } from './user.routes';
import { roleRoutes } from './role.routes';
import lockerRoutes from './locker.routes';
import customerRoutes from './customer.routes';
import allocationRoutes from './allocation.routes';
import billingRoutes from './billing.routes';
import paymentRoutes from './payment.routes';
import depositRoutes from './deposit.routes';
import refundRoutes from './refund.routes';
import closureRoutes from './locker-closure.routes';
import searchRoutes from './search.routes';
import importRoutes from './import.routes';
import syncRoutes from './sync.routes';
import uploadRoutes from './upload.routes';
import auditRoutes from './audit.routes';
import reportRoutes from './report.routes';
import settingRoutes from './setting.routes';
import { requireDatabaseReady } from '../middlewares/databaseReady';

const apiRouter = Router();

// Base health endpoint /api/health
apiRouter.use('/', healthRoutes);

// Health remains available during outages; business and authentication APIs
// return a retryable 503 instead of leaking Mongoose failures as 500 errors.
apiRouter.use(requireDatabaseReady);

// Auth & Session endpoints /api/auth/*
apiRouter.use('/auth', authRoutes);

// User Management endpoints /api/users/*
apiRouter.use('/users', userRoutes);

// Roles & Permissions endpoints /api/roles/*
apiRouter.use('/roles', roleRoutes);

// Locker Master endpoints /api/lockers/*
apiRouter.use('/lockers', lockerRoutes);

// Customer & KYC endpoints /api/customers/*
apiRouter.use('/customers', customerRoutes);

// Locker Allocation & Tenancy endpoints /api/allocations/*
apiRouter.use('/allocations', allocationRoutes);

// Locker Renewal & Billing endpoints /api/renewals/* and /api/invoices/*
apiRouter.use('/renewals', billingRoutes);
apiRouter.use('/invoices', billingRoutes);

// Payment Collection & Receipts endpoints /api/payments/*
apiRouter.use('/payments', paymentRoutes);

// Security Deposit Ledger & Caution Money endpoints /api/deposits/*
apiRouter.use('/deposits', depositRoutes);

// Refund Processing & Maker-Checker Approval endpoints /api/refunds/*
apiRouter.use('/refunds', refundRoutes);

// Locker Closure & Final Settlement endpoints /api/closures/*
apiRouter.use('/closures', closureRoutes);

// Global Search & Walk-in Quick Preview endpoints /api/search/*
apiRouter.use('/search', searchRoutes);

// Bulk Excel/CSV Import & Migration endpoints /api/imports/*
apiRouter.use('/imports', importRoutes);

// Safe Offline-First Incremental Sync endpoints /api/sync/*
apiRouter.use('/sync', syncRoutes);

// Storage & Upload endpoints /api/upload/*
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/audit-logs', auditRoutes);
apiRouter.use('/reports', reportRoutes);
apiRouter.use('/settings', settingRoutes);

export { apiRouter };

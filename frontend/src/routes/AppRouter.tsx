import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ProtectedRoute } from '../components/common/ProtectedRoute';

const DashboardPage = lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const LockerDetailPage = lazy(() => import('../pages/LockerDetailPage').then((m) => ({ default: m.LockerDetailPage })));
const CustomerDetailPage = lazy(() => import('../pages/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })));
const UsersPage = lazy(() => import('../pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ReportsPage = lazy(() => import('../pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const ClosuresPage = lazy(() => import('../pages/ClosuresPage').then((m) => ({ default: m.ClosuresPage })));
const DepositsRefundsPage = lazy(() => import('../pages/DepositsRefundsPage').then((m) => ({ default: m.DepositsRefundsPage })));
const AllocationsPage = lazy(() => import('../pages/AllocationsPage').then((m) => ({ default: m.AllocationsPage })));
const LockersPage = lazy(() => import('../pages/LockersPage').then((m) => ({ default: m.LockersPage })));
const CustomersPage = lazy(() => import('../pages/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const RenewalsPage = lazy(() => import('../pages/RenewalsPage').then((m) => ({ default: m.RenewalsPage })));
const PaymentsPage = lazy(() => import('../pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const OfflinePage = lazy(() => import('../pages/OfflinePage').then((m) => ({ default: m.OfflinePage })));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })));

const PageLoader = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><LoadingSpinner /></div>}>
    {children}
  </Suspense>
);

const router = createBrowserRouter([
  // Public Login Route
  {
    path: '/login',
    element: <PageLoader><LoginPage /></PageLoader>,
  },

  // Protected App Shell Routes
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute requiredPermission="dashboard.view">
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute requiredPermission="dashboard.view">
            <DashboardPage />
          </ProtectedRoute>
        ),
      },
      // Locker Master Routes
      {
        path: 'lockers',
        element: (
          <ProtectedRoute requiredPermission="lockers.view">
            <LockersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'closed-lockers',
        element: (
          <ProtectedRoute requiredPermission="closures.view">
            <ClosuresPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'renewal-lockers',
        element: (
          <ProtectedRoute requiredPermission="renewals.view">
            <RenewalsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'lockers/:id',
        element: (
          <ProtectedRoute requiredPermission="lockers.view">
            <LockerDetailPage />
          </ProtectedRoute>
        ),
      },
      // Customer & KYC Routes
      {
        path: 'customers',
        element: (
          <ProtectedRoute requiredPermission="customers.view">
            <CustomersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'customers/:id',
        element: (
          <ProtectedRoute requiredPermission="customers.view">
            <CustomerDetailPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'allocations',
        element: (
          <ProtectedRoute requiredPermission="allocations.view">
            <AllocationsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'renewals',
        element: (
          <ProtectedRoute requiredPermission="renewals.view">
            <RenewalsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'payments',
        element: (
          <ProtectedRoute requiredPermission="payments.view">
            <PaymentsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'deposits-refunds',
        element: (
          <ProtectedRoute requiredPermission="deposits.view">
            <DepositsRefundsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'closures',
        element: (
          <ProtectedRoute requiredPermission="closures.view">
            <ClosuresPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute requiredPermission="reports.view">
            <ReportsPage />
          </ProtectedRoute>
        ),
      },
      // Audit Trail Routes
      {
        path: 'audit',
        element: (
          <ProtectedRoute requiredPermission="audit.view">
            <AuditLogsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'audit-logs',
        element: (
          <ProtectedRoute requiredPermission="audit.view">
            <AuditLogsPage />
          </ProtectedRoute>
        ),
      },

      // User Management Routes
      {
        path: 'users',
        element: (
          <ProtectedRoute requiredPermission="users.view">
            <UsersPage />
          </ProtectedRoute>
        ),
      },

      // System Settings
      {
        path: 'settings',
        element: (
          <ProtectedRoute requiredPermission="settings.view">
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'offline',
        element: <OfflinePage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

export function AppRouter() {
  return <PageLoader><RouterProvider router={router} /></PageLoader>;
}

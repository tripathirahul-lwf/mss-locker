import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppLayout } from '../components/layout/AppLayout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ProtectedRoute } from '../components/common/ProtectedRoute';
import {
  KeyRound,
  Users,
  FolderSync,
  CalendarClock,
  CreditCard,
  Receipt,
  Lock,
  BarChart3,
  FileSpreadsheet,
  ShieldCheck,
  Settings,
} from 'lucide-react';

const DashboardPage = lazy(() => import('../pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const LockersPage = lazy(() => import('../pages/LockersPage').then((m) => ({ default: m.LockersPage })));
const LockerDetailPage = lazy(() => import('../pages/LockerDetailPage').then((m) => ({ default: m.LockerDetailPage })));
const CustomersPage = lazy(() => import('../pages/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() => import('../pages/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })));
const AllocationsPage = lazy(() => import('../pages/AllocationsPage').then((m) => ({ default: m.AllocationsPage })));
const RenewalsPage = lazy(() => import('../pages/RenewalsPage').then((m) => ({ default: m.RenewalsPage })));
const PaymentsPage = lazy(() => import('../pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const DepositsRefundsPage = lazy(() => import('../pages/DepositsRefundsPage').then((m) => ({ default: m.DepositsRefundsPage })));
const ClosuresPage = lazy(() => import('../pages/ClosuresPage').then((m) => ({ default: m.ClosuresPage })));
const ImportExportPage = lazy(() => import('../pages/ImportExportPage').then((m) => ({ default: m.ImportExportPage })));
const PlaceholderPage = lazy(() => import('../pages/PlaceholderPage').then((m) => ({ default: m.PlaceholderPage })));
const OfflinePage = lazy(() => import('../pages/OfflinePage').then((m) => ({ default: m.OfflinePage })));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const UsersPage = lazy(() => import('../pages/UsersPage').then((m) => ({ default: m.UsersPage })));
const RolesPage = lazy(() => import('../pages/RolesPage').then((m) => ({ default: m.RolesPage })));
const AuditLogsPage = lazy(() => import('../pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const ReportsPage = lazy(() => import('../pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('../pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

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
      {
        path: 'import-export',
        element: (
          <ProtectedRoute requiredPermission="imports.create">
            <ImportExportPage />
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
      {
        path: 'users/roles',
        element: (
          <ProtectedRoute requiredPermission="roles.view">
            <RolesPage />
          </ProtectedRoute>
        ),
      },

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

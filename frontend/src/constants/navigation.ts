import {
  LayoutDashboard,
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
  UserCog,
  Settings,
} from 'lucide-react';
import { NavItem, NavSection } from '../types';

export const NAVIGATION_SECTIONS: NavSection[] = [
  {
    title: 'Operations',
    items: [
      {
        title: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
        requiredPermission: 'dashboard.view',
        description: 'Key metrics, vault occupancy, collection summaries, and operational status',
      },
      {
        title: 'Lockers',
        href: '/lockers',
        icon: KeyRound,
        badge: '1,484',
        requiredPermission: 'lockers.view',
        description: 'Physical vault inventory, rack mapping, sizes A-G2, status and maintenance',
      },
      {
        title: 'Customers',
        href: '/customers',
        icon: Users,
        requiredPermission: 'customers.view',
        description: 'Customer profiles, KYC verification, nominees, and identity records',
      },
      {
        title: 'Allocations',
        href: '/allocations',
        icon: FolderSync,
        requiredPermission: 'allocations.view',
        description: 'Active locker allocations, agreement numbers, terms, and assignments',
      },
      {
        title: 'Renewals',
        href: '/renewals',
        icon: CalendarClock,
        requiredPermission: 'renewals.view',
        description: 'Upcoming renewal schedules, renewal alerts, and tenure extensions',
      },
    ],
  },
  {
    title: 'Financials',
    items: [
      {
        title: 'Payments',
        href: '/payments',
        icon: CreditCard,
        requiredPermission: 'payments.view',
        description: 'Rental invoicing, receipt generation, GST, and payment tracking',
      },
      {
        title: 'Deposits & Refunds',
        href: '/deposits-refunds',
        icon: Receipt,
        requiredPermission: 'refunds.view',
        description: 'Security deposit ledger, advance rentals, and refund vouchers',
      },
      {
        title: 'Locker Closures',
        href: '/closures',
        icon: Lock,
        requiredPermission: 'closures.view',
        description: 'Surrenders, key returns, clearance certificates, and deposit release',
      },
    ],
  },
  {
    title: 'Management & System',
    items: [
      {
        title: 'Reports',
        href: '/reports',
        icon: BarChart3,
        requiredPermission: 'reports.view',
        description: 'Occupancy reports, revenue statements, due registers, and GST summaries',
      },
      {
        title: 'Import / Export',
        href: '/import-export',
        icon: FileSpreadsheet,
        requiredPermission: 'imports.create',
        description: 'Excel bulk import/export for initial 1,484 lockers, customers & migration',
      },
      {
        title: 'Audit Logs',
        href: '/audit-logs',
        icon: ShieldCheck,
        requiredPermission: 'audit.view',
        description: 'Tamper-evident activity logs, operator actions, and compliance trail',
      },
      {
        title: 'Users & Roles',
        href: '/users',
        icon: UserCog,
        requiredPermission: 'users.view',
        description: 'Staff accounts, role permissions (Admin, Vault Manager, Cashier, Auditor)',
      },
      {
        title: 'Settings',
        href: '/settings',
        icon: Settings,
        requiredPermission: 'settings.view',
        description: 'Locker size tariff plans, business details, invoice prefixes, and system parameters',
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAVIGATION_SECTIONS.flatMap(
  (section) => section.items
);

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
        title: 'Day-End Closures',
        href: '/closures',
        icon: Lock,
        requiredPermission: 'closures.view',
        description: 'Day-end cash balancing, custody surrenders & registers',
      },
    ],
  },
  {
    title: 'System & Governance',
    items: [
      {
        title: 'Operator Users',
        href: '/users',
        icon: UserCog,
        badge: 'RBAC',
        requiredPermission: 'users.view',
        description: 'Staff accounts, role permissions and counter clearance',
      },
      {
        title: 'Audit Trail',
        href: '/audit',
        icon: ShieldCheck,
        badge: 'Security',
        requiredPermission: 'audit.view',
        description: 'Tamper-evident activity logs, operator actions, and compliance trail',
      },
      {
        title: 'System Settings',
        href: '/settings',
        icon: Settings,
        badge: 'Tariffs',
        requiredPermission: 'settings.view',
        description: 'Locker size tariff plans, business details, invoice prefixes, and system parameters',
      },
      {
        title: 'Reports & Analytics',
        href: '/reports',
        icon: BarChart3,
        badge: 'Reports',
        requiredPermission: 'reports.view',
        description: 'Occupancy reports, revenue statements, due registers, and GST summaries',
      },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAVIGATION_SECTIONS.flatMap(
  (section) => section.items
);

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',

  // Lockers
  LOCKERS_VIEW: 'lockers.view',
  LOCKERS_CREATE: 'lockers.create',
  LOCKERS_UPDATE: 'lockers.update',
  LOCKERS_DELETE: 'lockers.delete',
  LOCKERS_VIEW_SENSITIVE: 'lockers.view_sensitive',

  // Customers & KYC
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',
  CUSTOMERS_KYC_VIEW: 'customers.kyc.view',
  CUSTOMERS_KYC_MANAGE: 'customers.kyc.manage',
  CUSTOMERS_KYC_VERIFY: 'customers.kyc.verify',
  CUSTOMERS_VIEW_SENSITIVE: 'customers.view_sensitive',

  // Allocations
  ALLOCATIONS_VIEW: 'allocations.view',
  ALLOCATIONS_CREATE: 'allocations.create',
  ALLOCATIONS_UPDATE: 'allocations.update',
  ALLOCATIONS_ACTIVATE: 'allocations.activate',
  ALLOCATIONS_CANCEL: 'allocations.cancel',
  ALLOCATIONS_OVERRIDE: 'allocations.override',

  // Renewals
  RENEWALS_VIEW: 'renewals.view',
  RENEWALS_CREATE: 'renewals.create',

  // Payments
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_CREATE: 'payments.create',
  PAYMENTS_CANCEL: 'payments.cancel',
  PAYMENTS_VIEW_RECEIPT: 'payments.view_receipt',

  // Deposits
  DEPOSITS_VIEW: 'deposits.view',
  DEPOSITS_COLLECT: 'deposits.collect',
  DEPOSITS_ADJUST: 'deposits.adjust',
  DEPOSITS_OVERRIDE: 'deposits.override',

  // Refunds
  REFUNDS_VIEW: 'refunds.view',
  REFUNDS_CREATE: 'refunds.create',
  REFUNDS_APPROVE: 'refunds.approve',
  REFUNDS_REJECT: 'refunds.reject',
  REFUNDS_PAY: 'refunds.pay',
  REFUNDS_CANCEL: 'refunds.cancel',

  // Closures
  CLOSURES_VIEW: 'closures.view',
  CLOSURES_CREATE: 'closures.create',
  CLOSURES_REVIEW: 'closures.review',
  CLOSURES_APPROVE: 'closures.approve',
  CLOSURES_COMPLETE: 'closures.complete',
  CLOSURES_REJECT: 'closures.reject',
  CLOSURES_CANCEL: 'closures.cancel',
  CLOSURES_PRINT: 'closures.print',
  CLOSURES_FINANCIAL_OVERRIDE: 'closures.financial_override',

  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // Imports & Migration
  IMPORTS_VIEW: 'imports.view',
  IMPORTS_CREATE: 'imports.create',
  IMPORTS_VALIDATE: 'imports.validate',
  IMPORTS_COMMIT: 'imports.commit',
  IMPORTS_LEGACY: 'imports.legacy',
  IMPORTS_ROLLBACK: 'imports.rollback',

  // Audit
  AUDIT_VIEW: 'audit.view',

  // Users
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DEACTIVATE: 'users.deactivate',
  USERS_RESET_PASSWORD: 'users.reset_password',

  // Roles
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
} as const;

export type PermissionCode = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

export interface PermissionGroup {
  module: string;
  description: string;
  permissions: {
    code: PermissionCode;
    name: string;
    description: string;
  }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    module: 'Dashboard',
    description: 'Overview metrics and operational statistics',
    permissions: [
      { code: PERMISSIONS.DASHBOARD_VIEW, name: 'View Dashboard', description: 'Access dashboard summary and occupancy stats' },
    ],
  },
  {
    module: 'Lockers',
    description: 'Physical vault inventory and rack management',
    permissions: [
      { code: PERMISSIONS.LOCKERS_VIEW, name: 'View Lockers', description: 'View locker list, rack maps, and details' },
      { code: PERMISSIONS.LOCKERS_CREATE, name: 'Create Lockers', description: 'Add new lockers or rack units' },
      { code: PERMISSIONS.LOCKERS_UPDATE, name: 'Update Lockers', description: 'Edit locker specifications or maintenance status' },
      { code: PERMISSIONS.LOCKERS_DELETE, name: 'Deactivate Lockers', description: 'Archive or deactivate physical locker units' },
      { code: PERMISSIONS.LOCKERS_VIEW_SENSITIVE, name: 'View Sensitive Master-Key', description: 'Access master key references and sensitive custody details' },
    ],
  },
  {
    module: 'Customers',
    description: 'Customer profiles, identification, and KYC compliance',
    permissions: [
      { code: PERMISSIONS.CUSTOMERS_VIEW, name: 'View Customers', description: 'Search and view customer records and KYC state' },
      { code: PERMISSIONS.CUSTOMERS_CREATE, name: 'Create Customers', description: 'Register new customers with contact details' },
      { code: PERMISSIONS.CUSTOMERS_UPDATE, name: 'Update Customers', description: 'Modify customer profile and contact information' },
      { code: PERMISSIONS.CUSTOMERS_DELETE, name: 'Deactivate Customers', description: 'Archive or deactivate customer records' },
      { code: PERMISSIONS.CUSTOMERS_KYC_VIEW, name: 'View KYC Documents', description: 'View uploaded KYC proof documents' },
      { code: PERMISSIONS.CUSTOMERS_KYC_MANAGE, name: 'Manage KYC Documents', description: 'Upload and edit customer identity documents' },
      { code: PERMISSIONS.CUSTOMERS_KYC_VERIFY, name: 'Verify KYC Documents', description: 'Approve or reject customer KYC submissions' },
      { code: PERMISSIONS.CUSTOMERS_VIEW_SENSITIVE, name: 'View Sensitive KYC Numbers', description: 'Access unmasked Aadhaar, PAN, and full ID numbers' },
    ],
  },
  {
    module: 'Allocations',
    description: 'Locker allotment and customer tenancy',
    permissions: [
      { code: PERMISSIONS.ALLOCATIONS_VIEW, name: 'View Allocations', description: 'View active and past locker allotments' },
      { code: PERMISSIONS.ALLOCATIONS_CREATE, name: 'Create Allotment', description: 'Allot vacant lockers to verified customers' },
      { code: PERMISSIONS.ALLOCATIONS_UPDATE, name: 'Update Allotment', description: 'Modify agreement terms or remarks' },
      { code: PERMISSIONS.ALLOCATIONS_ACTIVATE, name: 'Activate Reservation', description: 'Activate reserved locker agreements' },
      { code: PERMISSIONS.ALLOCATIONS_CANCEL, name: 'Cancel Reservation', description: 'Cancel hold/reservation on lockers' },
      { code: PERMISSIONS.ALLOCATIONS_OVERRIDE, name: 'Override Tariffs', description: 'Override default locker tariffs or bypass limits' },
    ],
  },
  {
    module: 'Renewals',
    description: 'Locker tenure extension and renewal alerts',
    permissions: [
      { code: PERMISSIONS.RENEWALS_VIEW, name: 'View Renewals', description: 'View upcoming expirations and renewal schedules' },
      { code: PERMISSIONS.RENEWALS_CREATE, name: 'Process Renewal', description: 'Extend locker tenures and record renewals' },
    ],
  },
  {
    module: 'Payments',
    description: 'Rental invoicing, receipts, and cashier collections',
    permissions: [
      { code: PERMISSIONS.PAYMENTS_VIEW, name: 'View Payments', description: 'View invoices, receipts, and cashier books' },
      { code: PERMISSIONS.PAYMENTS_CREATE, name: 'Collect Payment', description: 'Issue rental invoices and record payments' },
      { code: PERMISSIONS.PAYMENTS_CANCEL, name: 'Cancel Payment', description: 'Cancel recorded payment and reopen invoice balance' },
      { code: PERMISSIONS.PAYMENTS_VIEW_RECEIPT, name: 'View & Print Receipts', description: 'Access customer payment receipts and print' },
    ],
  },
  {
    module: 'Deposits & Caution Money',
    description: 'Security deposit ledger, collections, adjustments, and refunds',
    permissions: [
      { code: PERMISSIONS.DEPOSITS_VIEW, name: 'View Deposits', description: 'View security deposit balances and ledger transactions' },
      { code: PERMISSIONS.DEPOSITS_COLLECT, name: 'Collect Deposit', description: 'Collect and record caution money security deposits' },
      { code: PERMISSIONS.DEPOSITS_ADJUST, name: 'Adjust Deposit', description: 'Record deposit additions, penalties, or damage deductions' },
      { code: PERMISSIONS.DEPOSITS_OVERRIDE, name: 'Override Deposit Limits', description: 'Bypass standard deposit collection limits' },
      { code: PERMISSIONS.REFUNDS_VIEW, name: 'View Refunds', description: 'View refund requests, approvals, and payout records' },
      { code: PERMISSIONS.REFUNDS_CREATE, name: 'Initiate Refund', description: 'Create and submit deposit refund requests' },
      { code: PERMISSIONS.REFUNDS_APPROVE, name: 'Approve Refund', description: 'Authorize deposit refund disbursement (Maker-Checker)' },
      { code: PERMISSIONS.REFUNDS_REJECT, name: 'Reject Refund', description: 'Decline deposit refund request with remarks' },
      { code: PERMISSIONS.REFUNDS_PAY, name: 'Disburse Refund', description: 'Process and record refund payout payment' },
      { code: PERMISSIONS.REFUNDS_CANCEL, name: 'Cancel Refund Request', description: 'Cancel pending or approved refund requests' },
    ],
  },
  {
    module: 'Locker Closures',
    description: 'Surrenders, key handover, and clearances',
    permissions: [
      { code: PERMISSIONS.CLOSURES_VIEW, name: 'View Closures', description: 'View locker surrender requests and archives' },
      { code: PERMISSIONS.CLOSURES_CREATE, name: 'Initiate Closure', description: 'Start surrender and key inspection workflow' },
      { code: PERMISSIONS.CLOSURES_REVIEW, name: 'Review Closure', description: 'Review checklist, audit readiness, and verify clearances' },
      { code: PERMISSIONS.CLOSURES_APPROVE, name: 'Approve Closure', description: 'Authorize closure clearance (Maker-Checker)' },
      { code: PERMISSIONS.CLOSURES_COMPLETE, name: 'Complete Closure', description: 'Execute final settlement, release locker, and archive records' },
      { code: PERMISSIONS.CLOSURES_REJECT, name: 'Reject Closure', description: 'Decline closure request with operational remarks' },
      { code: PERMISSIONS.CLOSURES_CANCEL, name: 'Cancel Closure', description: 'Cancel pending surrender workflow' },
      { code: PERMISSIONS.CLOSURES_PRINT, name: 'Print Closure Statement', description: 'Generate and print official locker closure certificate' },
      { code: PERMISSIONS.CLOSURES_FINANCIAL_OVERRIDE, name: 'Financial Override', description: 'Bypass financial dues check during closure' },
    ],
  },
  {
    module: 'Reports',
    description: 'Business intelligence, revenue and occupancy exports',
    permissions: [
      { code: PERMISSIONS.REPORTS_VIEW, name: 'View Reports', description: 'Generate and view operational/financial reports' },
      { code: PERMISSIONS.REPORTS_EXPORT, name: 'Export Reports', description: 'Download reports as Excel or PDF' },
    ],
  },
  {
    module: 'Imports & Migration',
    description: 'Bulk data migration, Excel templates and historical rollbacks',
    permissions: [
      { code: PERMISSIONS.IMPORTS_VIEW, name: 'View Imports', description: 'View import job history and validation previews' },
      { code: PERMISSIONS.IMPORTS_CREATE, name: 'Upload & Parse Files', description: 'Upload Excel/CSV rosters for parsing' },
      { code: PERMISSIONS.IMPORTS_VALIDATE, name: 'Dry-Run Validation', description: 'Run dry-run data and relationship validation' },
      { code: PERMISSIONS.IMPORTS_COMMIT, name: 'Commit Import Data', description: 'Commit validated records into live database' },
      { code: PERMISSIONS.IMPORTS_LEGACY, name: 'Historical Billing Migration', description: 'Import past years renewal and invoice histories' },
      { code: PERMISSIONS.IMPORTS_ROLLBACK, name: 'Rollback Imports', description: 'Safely revert imported job records' },
    ],
  },
  {
    module: 'Audit & Compliance',
    description: 'System audit logs and compliance trails',
    permissions: [
      { code: PERMISSIONS.AUDIT_VIEW, name: 'View Audit Logs', description: 'Review security logs, operator events, and trails' },
    ],
  },
  {
    module: 'User Management',
    description: 'Staff accounts and operator management',
    permissions: [
      { code: PERMISSIONS.USERS_VIEW, name: 'View Users', description: 'List operator accounts and status' },
      { code: PERMISSIONS.USERS_CREATE, name: 'Create Users', description: 'Create new staff operator accounts' },
      { code: PERMISSIONS.USERS_UPDATE, name: 'Update Users', description: 'Edit staff accounts and assign roles' },
      { code: PERMISSIONS.USERS_DEACTIVATE, name: 'Deactivate Users', description: 'Suspend or deactivate operator accounts' },
      { code: PERMISSIONS.USERS_RESET_PASSWORD, name: 'Reset Password', description: 'Reset staff operator passwords' },
    ],
  },
  {
    module: 'Roles & Permissions',
    description: 'Access control matrices and role policies',
    permissions: [
      { code: PERMISSIONS.ROLES_VIEW, name: 'View Roles', description: 'View system roles and permission sets' },
      { code: PERMISSIONS.ROLES_MANAGE, name: 'Manage Roles', description: 'Modify role permission matrices' },
    ],
  },
  {
    module: 'System Settings',
    description: 'Tariff master and vault configuration',
    permissions: [
      { code: PERMISSIONS.SETTINGS_VIEW, name: 'View Settings', description: 'View vault configuration and tariff schedules' },
      { code: PERMISSIONS.SETTINGS_MANAGE, name: 'Manage Settings', description: 'Edit tariff masters, GSTIN, and company info' },
    ],
  },
];

export const SYSTEM_ROLE_CODES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  COUNTER_STAFF: 'COUNTER_STAFF',
  READ_ONLY: 'READ_ONLY',
} as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionCode[]> = {
  [SYSTEM_ROLE_CODES.SUPER_ADMIN]: ALL_PERMISSIONS,
  [SYSTEM_ROLE_CODES.ADMIN]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LOCKERS_VIEW,
    PERMISSIONS.LOCKERS_CREATE,
    PERMISSIONS.LOCKERS_UPDATE,
    PERMISSIONS.LOCKERS_DELETE,
    PERMISSIONS.LOCKERS_VIEW_SENSITIVE,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.CUSTOMERS_KYC_VIEW,
    PERMISSIONS.CUSTOMERS_KYC_MANAGE,
    PERMISSIONS.CUSTOMERS_KYC_VERIFY,
    PERMISSIONS.CUSTOMERS_VIEW_SENSITIVE,
    PERMISSIONS.ALLOCATIONS_VIEW,
    PERMISSIONS.ALLOCATIONS_CREATE,
    PERMISSIONS.ALLOCATIONS_UPDATE,
    PERMISSIONS.ALLOCATIONS_ACTIVATE,
    PERMISSIONS.ALLOCATIONS_CANCEL,
    PERMISSIONS.ALLOCATIONS_OVERRIDE,
    PERMISSIONS.RENEWALS_VIEW,
    PERMISSIONS.RENEWALS_CREATE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_CANCEL,
    PERMISSIONS.PAYMENTS_VIEW_RECEIPT,
    PERMISSIONS.DEPOSITS_VIEW,
    PERMISSIONS.DEPOSITS_COLLECT,
    PERMISSIONS.DEPOSITS_ADJUST,
    PERMISSIONS.DEPOSITS_OVERRIDE,
    PERMISSIONS.REFUNDS_VIEW,
    PERMISSIONS.REFUNDS_CREATE,
    PERMISSIONS.REFUNDS_APPROVE,
    PERMISSIONS.REFUNDS_REJECT,
    PERMISSIONS.REFUNDS_PAY,
    PERMISSIONS.REFUNDS_CANCEL,
    PERMISSIONS.CLOSURES_VIEW,
    PERMISSIONS.CLOSURES_CREATE,
    PERMISSIONS.CLOSURES_REVIEW,
    PERMISSIONS.CLOSURES_APPROVE,
    PERMISSIONS.CLOSURES_COMPLETE,
    PERMISSIONS.CLOSURES_REJECT,
    PERMISSIONS.CLOSURES_CANCEL,
    PERMISSIONS.CLOSURES_PRINT,
    PERMISSIONS.CLOSURES_FINANCIAL_OVERRIDE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.IMPORTS_VIEW,
    PERMISSIONS.IMPORTS_CREATE,
    PERMISSIONS.IMPORTS_VALIDATE,
    PERMISSIONS.IMPORTS_COMMIT,
    PERMISSIONS.IMPORTS_LEGACY,
    PERMISSIONS.IMPORTS_ROLLBACK,
    PERMISSIONS.SETTINGS_VIEW,
  ],
  [SYSTEM_ROLE_CODES.COUNTER_STAFF]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LOCKERS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_UPDATE,
    PERMISSIONS.CUSTOMERS_KYC_VIEW,
    PERMISSIONS.CUSTOMERS_KYC_MANAGE,
    PERMISSIONS.ALLOCATIONS_VIEW,
    PERMISSIONS.ALLOCATIONS_CREATE,
    PERMISSIONS.ALLOCATIONS_UPDATE,
    PERMISSIONS.ALLOCATIONS_ACTIVATE,
    PERMISSIONS.ALLOCATIONS_CANCEL,
    PERMISSIONS.RENEWALS_VIEW,
    PERMISSIONS.RENEWALS_CREATE,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENTS_CREATE,
    PERMISSIONS.PAYMENTS_VIEW_RECEIPT,
    PERMISSIONS.DEPOSITS_VIEW,
    PERMISSIONS.DEPOSITS_COLLECT,
    PERMISSIONS.REFUNDS_VIEW,
    PERMISSIONS.REFUNDS_CREATE,
    PERMISSIONS.REFUNDS_PAY,
    PERMISSIONS.CLOSURES_VIEW,
    PERMISSIONS.CLOSURES_CREATE,
    PERMISSIONS.CLOSURES_PRINT,
  ],
  [SYSTEM_ROLE_CODES.READ_ONLY]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.LOCKERS_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_KYC_VIEW,
    PERMISSIONS.ALLOCATIONS_VIEW,
    PERMISSIONS.RENEWALS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.DEPOSITS_VIEW,
    PERMISSIONS.REFUNDS_VIEW,
    PERMISSIONS.CLOSURES_VIEW,
    PERMISSIONS.CLOSURES_PRINT,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.AUDIT_VIEW,
  ],
};

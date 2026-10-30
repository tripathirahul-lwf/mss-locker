export const escapeAuditSearch = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matches = (field: string, regex: string) => ({ $regexMatch: { input: { $ifNull: [`$${field}`, ''] }, regex, options: 'i' } });
const category = (action: string, entity: string) => ({ $or: [matches('action', action), matches('entityType', entity), matches('module', entity)] });
export const auditPresentationStages: any[] = [{ $set: {
  category: { $switch: { branches: [
    { case: category('^(LOGIN|LOGOUT|PASSWORD|SESSION|AUTH)(_|$)', '^(AUTH|AUTHENTICATION|SESSIONS?)(_|$)'), then: 'AUTH' },
    { case: category('^(PAYMENT|INVOICE|RENEWAL|DEPOSIT|REFUND|BILLING|TARIFF)(_|$)', '^(PAYMENTS?|INVOICES?|LOCKER_INVOICE|RENEWALS?|DEPOSITS?|REFUNDS?|BILLING|DEPOSIT_TRANSACTION|REFUND_REQUEST)(_|$)'), then: 'PAYMENT' },
    { case: category('^(LOCKER|ALLOCATION|RESERVATION|CLOSURE)(_|$)', '^(LOCKERS?|VAULT|ALLOCATIONS?|RESERVATIONS?|CLOSURES?|LOCKER_ALLOCATION|LOCKER_CLOSURE)(_|$)'), then: 'LOCKER' },
    { case: category('^(CUSTOMER|KYC)(_|$)', '^(CUSTOMERS?|KYC|CUSTOMER_KYC|CUSTOMERKYCDOCUMENT)(_|$)'), then: 'CUSTOMER' },
  ], default: 'SYSTEM' } },
  severity: { $switch: { branches: [
    { case: matches('action', 'FAILED|REJECTED|DEACTIVATED|CANCELLED|DENIED'), then: 'DANGER' },
    { case: matches('action', 'PASSWORD|OVERRIDDEN|REMOVED'), then: 'WARNING' },
    { case: matches('action', 'CREATED|UPDATED|REVISED|GENERATED'), then: 'INFO' },
  ], default: 'SUCCESS' } },
} }, { $set: { isLedgerMutation: { $and: [{ $in: ['$category', ['LOCKER', 'PAYMENT']] }, { $regexMatch: { input: '$action', regex: '(CREATED|UPDATED|REVISED|GENERATED|RECORDED|CANCELLED|ADJUSTED|RECEIVED|RESERVED|ACTIVATED|DEACTIVATED|CLOSED|COMPLETED|APPROVED|REJECTED|SUBMITTED|REMOVED|ADDED|VERIFIED|PAID|STATUS_CHANGED|REVIEWED|REQUESTED)$' } }] } } }];
export function redactAuditValue(value: unknown, depth = 0): any {
  if (depth > 8) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 200).map(item => redactAuditValue(item, depth + 1));
  if (!value || typeof value !== 'object') return value;
  if (value instanceof Date || typeof (value as any).toHexString === 'function') return value;
  const plain = typeof (value as any).toObject === 'function' ? (value as any).toObject() : value;
  return Object.fromEntries(Object.entries(plain as Record<string, unknown>).map(([key, item]) => [key,
    /password|token|secret|authorization|cookie|masterKey|keyReference|keyNumber|documentNumber|aadhaar|panNumber/i.test(key) ? '[REDACTED]' : redactAuditValue(item, depth + 1),
  ]));
}
export function auditCsvCell(value: unknown): string {
  let text = String(value ?? '');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

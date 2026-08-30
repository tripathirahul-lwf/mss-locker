export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'OTHER';
export type PaymentStatus = 'COMPLETED' | 'PENDING' | 'FAILED' | 'CANCELLED';
export type PaymentSource = 'COUNTER' | 'MANUAL_ENTRY' | 'LEGACY_IMPORT' | 'SYSTEM';
export type PaymentPurpose = 'INVOICE_PAYMENT' | 'SECURITY_DEPOSIT' | 'REFUND' | 'OTHER';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; isDigital: boolean }[] = [
  { value: 'CASH', label: 'Cash Payment', isDigital: false },
  { value: 'UPI', label: 'UPI (GPay / PhonePe / QR)', isDigital: true },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer (NEFT / RTGS / IMPS)', isDigital: true },
  { value: 'CARD', label: 'Debit / Credit Card', isDigital: true },
  { value: 'CHEQUE', label: 'Cheque / Demand Draft', isDigital: false },
  { value: 'OTHER', label: 'Other Mode', isDigital: false },
];

export const PAYMENT_STATUSES: { value: PaymentStatus; label: string }[] = [
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'PENDING', label: 'Pending Clearance' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export const DIGITAL_PAYMENT_METHODS: PaymentMethod[] = ['UPI', 'BANK_TRANSFER', 'CARD'];

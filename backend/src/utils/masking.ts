import { KycDocumentType } from '../constants/customer.constants';

/**
 * Mask Aadhaar number: "123456789012" -> "XXXXXXXX9012"
 */
export function maskAadhaar(docNum: string): string {
  const cleaned = docNum.replace(/\s+/g, '');
  if (cleaned.length < 4) return 'XXXXXXXX';
  const last4 = cleaned.slice(-4);
  return `XXXXXXXX${last4}`;
}

/**
 * Mask PAN card: "ABCDE1234F" -> "ABCDE****F"
 */
export function maskPan(docNum: string): string {
  const cleaned = docNum.trim().toUpperCase();
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)}****${cleaned.slice(-1)}`;
  }
  return maskGeneric(cleaned);
}

/**
 * Mask Passport: "A1234567" -> "A****567"
 */
export function maskPassport(docNum: string): string {
  const cleaned = docNum.trim();
  if (cleaned.length >= 6) {
    return `${cleaned.slice(0, 2)}****${cleaned.slice(-3)}`;
  }
  return maskGeneric(cleaned);
}

/**
 * Generic masking for Driving License, Voter ID, etc.
 * Keeps last 4 digits visible, masks the rest.
 */
export function maskGeneric(docNum: string): string {
  const cleaned = docNum.trim();
  if (cleaned.length <= 4) return '****';
  const visible = cleaned.slice(-4);
  return `****${visible}`;
}

/**
 * Centralized mask dispatcher based on document type.
 */
export function maskKycDocumentNumber(
  documentType: KycDocumentType | string,
  documentNumber: string | undefined | null
): string {
  if (!documentNumber) return '';

  const docTypeUpper = documentType.toUpperCase();
  switch (docTypeUpper) {
    case 'AADHAAR':
      return maskAadhaar(documentNumber);
    case 'PAN':
      return maskPan(documentNumber);
    case 'PASSPORT':
      return maskPassport(documentNumber);
    default:
      return maskGeneric(documentNumber);
  }
}

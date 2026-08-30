/**
 * Normalizes Indian and international phone numbers into standard searchable format.
 * Examples:
 *   "9876543210"       -> "+91 9876543210"
 *   "09876543210"      -> "+91 9876543210"
 *   "+91 98765 43210"  -> "+91 9876543210"
 *   "+919876543210"    -> "+91 9876543210"
 */
export function normalizePhone(phone: string | undefined | null): string {
  if (!phone) return '';

  const trimmed = phone.trim();
  // Remove spaces, hyphens, parentheses, and dots
  const digitsOnly = trimmed.replace(/[\s\-\(\)\.]/g, '');

  // If starts with +91
  if (digitsOnly.startsWith('+91') && digitsOnly.length === 13) {
    return `+91 ${digitsOnly.substring(3)}`;
  }

  // If starts with 91 (12 digits)
  if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
    return `+91 ${digitsOnly.substring(2)}`;
  }

  // If starts with 0 (11 digits e.g. 09876543210)
  if (digitsOnly.startsWith('0') && digitsOnly.length === 11) {
    return `+91 ${digitsOnly.substring(1)}`;
  }

  // Standard 10-digit Indian mobile number
  if (/^[6-9]\d{9}$/.test(digitsOnly)) {
    return `+91 ${digitsOnly}`;
  }

  // Fallback for international numbers or landlines with STD
  return trimmed;
}

/**
 * Validates if the phone number represents a valid mobile/contact number.
 */
export function isValidPhone(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const digitsOnly = phone.replace(/[\s\-\(\)\.\+]/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
}

/**
 * Format phone number cleanly for Indian display: "+91 98765 43210"
 */
export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '-';
  const trimmed = phone.trim();

  // If already formatted with +91
  if (trimmed.startsWith('+91')) {
    const digits = trimmed.replace(/\D/g, '').substring(2);
    if (digits.length === 10) {
      return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
    }
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  return trimmed;
}

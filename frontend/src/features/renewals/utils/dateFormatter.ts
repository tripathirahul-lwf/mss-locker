/**
 * Safe date formatter that normalizes legacy imported dates where years were corrupted (e.g. 0221 -> 2021)
 * and formats cleanly in Indian locale (e.g. "12 Apr 2021").
 */
export function formatDateSafe(
  dateInput: string | Date | undefined | null,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return 'N/A';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);

  const y = d.getFullYear();
  if (y > 100 && y < 1000) {
    d.setFullYear(2000 + (y % 100));
  }

  return d.toLocaleDateString('en-IN', options || {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/** Escape stored text before interpolating it into printable HTML. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

/** Copy plain document data, escaping strings while preserving numbers, dates and IDs. */
export function escapeHtmlFields<T>(input: T): T {
  if (typeof input === 'string') return escapeHtml(input) as T;
  if (!input || typeof input !== 'object' || input instanceof Date) return input;
  if (Array.isArray(input)) return input.map(escapeHtmlFields) as T;
  const value = typeof (input as any).toObject === 'function' ? (input as any).toObject() : input;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, escapeHtmlFields(item)])) as T;
}

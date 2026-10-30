/** Normalizes rupee amounts to two decimal places and rejects unsafe values. */
export const normalizeMoney = (value: unknown, field = 'Amount'): number => {
  if (!['number', 'string'].includes(typeof value) || typeof value === 'string' && !value.trim()) throw Object.assign(new Error(`${field} must be a positive finite number`), { statusCode: 400 });
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error(`${field} must be a positive finite number`) as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  const normalized = Math.round((amount + Number.EPSILON) * 100) / 100;
  if (normalized <= 0) throw Object.assign(new Error(`${field} must be at least 0.01`), { statusCode: 400 });
  if (!Number.isSafeInteger(Math.round(normalized * 100))) {
    const error = new Error(`${field} is outside the supported range`) as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

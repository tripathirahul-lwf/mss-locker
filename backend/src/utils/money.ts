/** Normalizes rupee amounts to two decimal places and rejects unsafe values. */
export const normalizeMoney = (value: unknown, field = 'Amount'): number => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error(`${field} must be a positive finite number`) as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  const normalized = Math.round((amount + Number.EPSILON) * 100) / 100;
  if (!Number.isSafeInteger(Math.round(normalized * 100))) {
    const error = new Error(`${field} is outside the supported range`) as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }
  return normalized;
};

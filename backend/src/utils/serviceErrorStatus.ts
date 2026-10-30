/** Preserve ambiguous database failures as retryable server errors, not rejected payments. */
export function serviceErrorStatus(error: any, fallback = 400): number {
  if (Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599) return error.statusCode;
  if (error?.code === 11000) return 409;
  if (['CastError', 'ValidationError', 'ZodError'].includes(error?.name)) return 400;
  const labels = error?.errorLabels || [];
  if (/Mongo(Network|ServerSelection|NetworkTimeout)/.test(error?.name || '') || labels.includes('UnknownTransactionCommitResult') || labels.includes('TransientTransactionError')) return 503;
  return fallback;
}

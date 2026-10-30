export function isAllowedOrigin(origin: string, clientUrl: string, environment: string): boolean {
  let candidate: URL;
  try { candidate = new URL(origin); } catch { return false; }
  if (!['http:', 'https:'].includes(candidate.protocol) || candidate.origin !== origin.replace(/\/$/, '')) return false;
  const configured = clientUrl.split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean);
  if (configured.includes(candidate.origin)) return true;
  return environment !== 'production' && ['localhost', '127.0.0.1'].includes(candidate.hostname);
}

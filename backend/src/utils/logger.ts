type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private sanitize(value: unknown, seen = new WeakSet<object>()): unknown {
    if (!value || typeof value !== 'object') return value;
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
    if (Array.isArray(value)) return value.map((item) => this.sanitize(item, seen));
    const sensitive = /password|token|secret|authorization|cookie|aadhaar|pan|documentnumber/i;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitive.test(key) ? '[REDACTED]' : this.sanitize(item, seen),
    ]));
  }

  private format(level: LogLevel, message: string, meta?: unknown): string {
    return JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...(meta ? { meta: this.sanitize(meta) } : {}) });
  }

  info(message: string, meta?: unknown): void {
    console.log(this.format('info', message, meta));
  }

  warn(message: string, meta?: unknown): void {
    console.warn(this.format('warn', message, meta));
  }

  error(message: string, meta?: unknown): void {
    console.error(this.format('error', message, meta));
  }

  debug(message: string, meta?: unknown): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.format('debug', message, meta));
    }
  }
}

export const logger = new Logger();

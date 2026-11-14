import { env } from 'src/configs/env.config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMetadata = Record<string, unknown>;

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = /password|token|authorization|cookie|secret|api[-_]?key/i;
const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel = env.logLevel as LogLevel;

const sanitize = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (value instanceof Error) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const diagnostic = value as Error & {
      code?: unknown;
      cause?: unknown;
      errors?: unknown;
      errorCode?: unknown;
      statusCode?: unknown;
    };
    return {
      name: value.name,
      message: value.message,
      ...(typeof diagnostic.code === 'string' ? { code: diagnostic.code } : {}),
      ...(typeof diagnostic.errorCode === 'string' ? { errorCode: diagnostic.errorCode } : {}),
      ...(typeof diagnostic.statusCode === 'number' ? { statusCode: diagnostic.statusCode } : {}),
      ...(diagnostic.cause !== undefined ? { cause: sanitize(diagnostic.cause, seen) } : {}),
      ...(Array.isArray(diagnostic.errors)
        ? { errors: diagnostic.errors.map((error) => sanitize(error, seen)) }
        : {}),
      ...(env.nodeEnv !== 'production' ? { stack: value.stack } : {}),
    };
  }
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => sanitize(item, seen));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEYS.test(key) ? REDACTED : sanitize(item, seen),
    ]),
  );
};

const write = (level: LogLevel, message: string, metadata: LogMetadata = {}) => {
  if (LEVEL_PRIORITY[level] < (LEVEL_PRIORITY[configuredLevel] ?? LEVEL_PRIORITY.info)) return;

  const sanitizedMetadata = sanitize(metadata) as LogMetadata;
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...sanitizedMetadata,
  });

  if (level === 'error') process.stderr.write(`${entry}\n`);
  else process.stdout.write(`${entry}\n`);
};

export const logger = {
  debug: (message: string, metadata?: LogMetadata) => write('debug', message, metadata),
  info: (message: string, metadata?: LogMetadata) => write('info', message, metadata),
  warn: (message: string, metadata?: LogMetadata) => write('warn', message, metadata),
  error: (message: string, metadata?: LogMetadata) => write('error', message, metadata),
};

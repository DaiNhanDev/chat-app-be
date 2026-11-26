import 'dotenv/config';

const toPositiveInteger = (name: string, fallback: number): number => {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
};

const toList = (value: string | undefined, fallback: string[]): string[] =>
  value
    ? value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback;

const required = (name: string, developmentFallback?: string): string => {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (process.env.NODE_ENV !== 'production' && developmentFallback) return developmentFallback;
  throw new Error(`${name} is required`);
};

const sessionCookieSameSite = (process.env.SESSION_COOKIE_SAME_SITE || 'lax').toLowerCase();
if (!['lax', 'strict', 'none'].includes(sessionCookieSameSite))
  throw new Error('SESSION_COOKIE_SAME_SITE must be lax, strict or none');

export const env = Object.freeze({
  sessionCookieSameSite: sessionCookieSameSite as 'lax' | 'strict' | 'none',
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toPositiveInteger('PORT', 3615),
  trustProxy: toPositiveInteger('TRUST_PROXY', 1),
  bodyLimit: process.env.BODY_LIMIT || '10mb',
  corsOrigins: toList(process.env.CORS_ORIGINS, ['*']),
  corsMaxAge: toPositiveInteger('CORS_MAX_AGE', 86400),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/chat'),
  jwtSecret: required('JWT_SECRET', 'local-development-only-change-me'),
  jwtSaltRounds: toPositiveInteger('JWT_SALT_ROUNDS', 10),
  shutdownTimeoutMs: toPositiveInteger('SHUTDOWN_TIMEOUT_MS', 60000),
  publicUrl: process.env.PUBLIC_URL?.trim() || '',
  swaggerServer: process.env.SWAGGER_SERVER?.trim() || '',
  firebaseDatabaseUrl: process.env.FIREBASE_DATABASE_URL?.trim() || '',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID?.trim() || '',
  pwaBaseUrl: process.env.PWA_BASE_URL?.trim() || '',
  pushTimeoutMs: toPositiveInteger('PUSH_TIMEOUT_MS', 5000),
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
});

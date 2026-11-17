import { randomBytes } from 'node:crypto';
import { z } from 'zod';

const MIN_SECRET_LENGTH = 32;

const boolString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: boolString,
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  SYTHM_AUTH_SECRET: z.string().optional(),
  SYTHM_TOKEN_TTL_HOURS: z.coerce
    .number()
    .min(0.1)
    .max(24 * 30)
    .default(24 * 7),
  CORS_ORIGINS: z.string().optional(),
  TRUST_PROXY: boolString,
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  host: string;
  databaseUrl: string | undefined;
  databaseSsl: boolean;
  databasePoolMax: number;
  authSecret: string;
  tokenTtlMs: number;
  /** `true` = refletir qualquer origem; array = allowlist; `false` = bloquear cross-origin. */
  corsOrigin: boolean | string[];
  trustProxy: boolean;
  rateLimitMax: number;
  rateLimitAuthMax: number;
}

export class ConfigError extends Error {}

/**
 * Lê e valida as variáveis de ambiente. Em produção, falha cedo se faltar
 * `SYTHM_AUTH_SECRET` (>= 32 chars) ou `DATABASE_URL`.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ConfigError(`Variáveis de ambiente inválidas: ${details}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';

  let authSecret = e.SYTHM_AUTH_SECRET;
  if (!authSecret || authSecret.length < MIN_SECRET_LENGTH) {
    if (isProduction) {
      throw new ConfigError(
        `SYTHM_AUTH_SECRET é obrigatório em produção e deve ter pelo menos ${MIN_SECRET_LENGTH} caracteres. ` +
          'Gere um com: openssl rand -base64url 48',
      );
    }
    // Dev/test: segredo efêmero. Os tokens deixam de valer a cada restart.
    authSecret = randomBytes(48).toString('base64url');
  }

  if (isProduction && !e.DATABASE_URL) {
    throw new ConfigError('DATABASE_URL é obrigatório em produção.');
  }

  const origins = (e.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const corsOrigin: boolean | string[] =
    origins.length > 0
      ? origins
      : isProduction
        ? false
        : ['http://localhost:5173', 'http://127.0.0.1:5173'];

  return {
    env: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    host: e.HOST,
    databaseUrl: e.DATABASE_URL,
    databaseSsl: e.DATABASE_SSL,
    databasePoolMax: e.DATABASE_POOL_MAX,
    authSecret,
    tokenTtlMs: e.SYTHM_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    corsOrigin,
    trustProxy: e.TRUST_PROXY,
    rateLimitMax: e.RATE_LIMIT_MAX,
    rateLimitAuthMax: e.RATE_LIMIT_AUTH_MAX,
  };
}

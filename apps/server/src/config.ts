import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  PUBLIC_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  COOKIE_SECRET: z.string().min(32),
  SNAPSHOT_KEY: z
    .string()
    .min(1)
    .refine((value) => {
      try {
        return Buffer.from(value, 'base64').byteLength === 32;
      } catch {
        return false;
      }
    }, 'SNAPSHOT_KEY must be a base64 encoded 32-byte key'),
  TOKEN_PEPPER: z.string().min(32),
  ADMIN_USERNAME: z.string().min(1).max(64).default('admin'),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  TRUST_PROXY: booleanString,
  RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  ROOM_IDLE_HOURS: z.coerce.number().int().min(1).max(168).default(12),
  APP_BUILD_SHA: z.string().default('development'),
  WEB_DIST_DIR: z.string().default('apps/web/dist'),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(env);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${message}`);
  }
  return result.data;
}

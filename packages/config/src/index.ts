import { z } from 'zod';
const serviceSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.enum(['127.0.0.1', '0.0.0.0', '::']).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(8),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
});
export type ServiceConfig = z.infer<typeof serviceSchema>;
export function parseServiceConfig(
  environment: Record<string, string | undefined>,
): ServiceConfig {
  const result = serviceSchema.safeParse(environment);
  if (!result.success) {
    // Never serialize environment values: they may contain passwords.
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  return result.data;
}

export { parseAuthConfig } from './auth.js';
export type { AuthConfig } from './auth.js';

export { parseDevelopmentConfig } from './development.js';

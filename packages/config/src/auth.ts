import { z } from 'zod';
const authSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    AUTH_BASE_URL: z.url(),
    WEB_ORIGIN: z.url(),
    AUTH_SECRET: z.string().min(32),
    MAIL_MODE: z.enum(['smtp', 'capture']).default('smtp'),
    SMTP_HOST: z.string().min(1).default('localhost'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
    SMTP_SECURE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    SMTP_USER: z.string().default(''),
    SMTP_PASSWORD: z.string().default(''),
    MAIL_FROM: z.email().default('noreply@reconcile.invalid'),
  })
  .superRefine((config, context) => {
    try {
      new URL(config.AUTH_BASE_URL);
      new URL(config.WEB_ORIGIN);
    } catch {
      return;
    }
    const issue = (field: string) =>
      context.addIssue({
        code: 'custom',
        path: [field],
        message: 'Invalid authentication configuration',
      });
    for (const field of ['AUTH_BASE_URL', 'WEB_ORIGIN'] as const) {
      const url = new URL(config[field]);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        issue(field);
    }
    if (
      new URL(config.AUTH_BASE_URL).origin !== new URL(config.WEB_ORIGIN).origin
    )
      issue('WEB_ORIGIN');
    if (config.MAIL_MODE === 'capture' && config.NODE_ENV !== 'test')
      issue('MAIL_MODE');
    if (config.NODE_ENV === 'production') {
      if (!config.AUTH_BASE_URL.startsWith('https:')) issue('AUTH_BASE_URL');
      if (!config.WEB_ORIGIN.startsWith('https:')) issue('WEB_ORIGIN');
      if (
        /local|demo|example|change|development|test/i.test(
          config.AUTH_SECRET,
        ) ||
        new Set(config.AUTH_SECRET).size < 16
      )
        issue('AUTH_SECRET');
      if (!config.SMTP_SECURE) issue('SMTP_SECURE');
      if (!config.SMTP_USER || !config.SMTP_PASSWORD) issue('SMTP_USER');
      if (/localhost|127\.0\.0\.1|\.invalid$/i.test(config.SMTP_HOST))
        issue('SMTP_HOST');
      if (/\.invalid$|@example\./i.test(config.MAIL_FROM)) issue('MAIL_FROM');
    }
  });
export type AuthConfig = z.infer<typeof authSchema>;
export function parseAuthConfig(
  environment: Record<string, string | undefined>,
): AuthConfig {
  const result = authSchema.safeParse(environment);
  if (!result.success)
    throw new Error(
      `Invalid authentication environment: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  return result.data;
}

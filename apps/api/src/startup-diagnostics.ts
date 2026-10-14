export type StartupStage =
  'service-config' | 'auth-config' | 'identity' | 'http-init' | 'listen';

const codes: Readonly<Record<string, string>> = {
  EADDRINUSE: 'Address/port already in use',
  EACCES: 'Permission denied binding the listener',
  EADDRNOTAVAIL: 'Configured listener address is unavailable',
  ENOTFOUND: 'Required host could not be resolved',
  ECONNREFUSED: 'Required service refused the connection',
  ETIMEDOUT: 'Required service connection timed out',
};
const configFields = new Set([
  'NODE_ENV',
  'HOST',
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'S3_ENDPOINT',
  'S3_REGION',
  'S3_BUCKET',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'WORKER_CONCURRENCY',
  'AUTH_BASE_URL',
  'WEB_ORIGIN',
  'AUTH_SECRET',
  'MAIL_MODE',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_SECURE',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'MAIL_FROM',
]);

function inspectStartupFailure(
  error: unknown,
  stage: StartupStage,
  listener?: { host: string; port: number },
): string {
  const prefix = `API startup failed [stage=${stage}]`;
  if (stage === 'service-config' || stage === 'auth-config') {
    if (error instanceof Error) {
      const match = /^Invalid (?:authentication )?environment: (.+)$/.exec(
        error.message,
      );
      const fields = match?.[1]
        ?.split(', ')
        .filter((field) => configFields.has(field));
      if (fields?.length)
        return `${prefix} invalid fields: ${[...new Set(fields)].join(', ')}`;
    }
    return `${prefix} invalid configuration; check .env`;
  }
  const code: unknown =
    error && typeof error === 'object' ? Reflect.get(error, 'code') : undefined;
  const description =
    typeof code === 'string' && Object.hasOwn(codes, code)
      ? codes[code]
      : undefined;
  const address =
    stage === 'listen' && listener
      ? ` (${listener.host}:${listener.port})`
      : '';
  return description
    ? `${prefix} ${code}: ${description}${address}`
    : `${prefix} unexpected initialization error${address}; error details withheld`;
}

export function formatStartupFailure(
  error: unknown,
  stage: StartupStage,
  listener?: { host: string; port: number },
): string {
  try {
    return inspectStartupFailure(error, stage, listener);
  } catch {
    return `API startup failed [stage=${stage}] error inspection failed; error details withheld`;
  }
}

export async function closeAfterStartupFailure(
  cleanup: () => Promise<unknown>,
  timeoutMs = 3000,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve()
        .then(cleanup)
        .catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@reconcile/database';
import { createAuth } from '@reconcile/auth';
import { parseAuthConfig, parseServiceConfig } from '@reconcile/config';
import { createApplication } from './application.js';
import {
  closeAfterStartupFailure,
  formatStartupFailure,
  type StartupStage,
} from './startup-diagnostics.js';
async function bootstrap(): Promise<void> {
  let stage: StartupStage = 'service-config';
  let prisma: PrismaClient | undefined;
  let app: NestFastifyApplication | undefined;
  let listener: { host: string; port: number } | undefined;
  try {
    const service = parseServiceConfig(process.env);
    listener = { host: service.HOST, port: service.PORT };
    stage = 'auth-config';
    const config = parseAuthConfig(process.env);
    stage = 'identity';
    prisma = new PrismaClient();
    const auth = createAuth({ prisma, config });
    stage = 'http-init';
    app = await createApplication({ auth, prisma });
    app.enableShutdownHooks();
    stage = 'listen';
    await app.listen(service.PORT, service.HOST);
    console.info(`API listening on http://${service.HOST}:${service.PORT}`);
  } catch (error) {
    console.error(formatStartupFailure(error, stage, listener));
    await closeAfterStartupFailure(() =>
      Promise.allSettled([app?.close(), prisma?.$disconnect()]),
    );
    // Bootstrap cannot serve requests; terminate even if partial initialization left handles.
    process.exit(1);
  }
}
void bootstrap();

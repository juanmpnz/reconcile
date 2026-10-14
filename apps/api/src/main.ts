import { PrismaClient } from '@reconcile/database';
import { createAuth } from '@reconcile/auth';
import { parseAuthConfig, parseServiceConfig } from '@reconcile/config';
import { createApplication } from './application.js';
async function bootstrap(): Promise<void> {
  const service = parseServiceConfig(process.env);
  const config = parseAuthConfig(process.env);
  const prisma = new PrismaClient();
  try {
    const auth = createAuth({ prisma, config });
    const app = await createApplication({ auth, prisma });
    app.enableShutdownHooks();
    await app.listen(service.PORT, service.HOST);
  } catch (error) {
    await prisma.$disconnect();
    throw error;
  }
}
bootstrap().catch(() => {
  console.error(
    'API failed to start. Check authentication, mail and service configuration.',
  );
  process.exitCode = 1;
});

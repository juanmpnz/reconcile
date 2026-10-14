import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { parseServiceConfig } from '@reconcile/config';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
@Module({ controllers: [HealthController], providers: [HealthService] })
class AppModule {}
async function bootstrap(): Promise<void> {
  const config = parseServiceConfig(process.env);
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      bodyLimit: 1024 * 1024,
      requestTimeout: 30000,
      genReqId: () => crypto.randomUUID(),
    }),
  );
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  await app.listen(config.PORT, config.HOST);
}
bootstrap().catch(() => {
  console.error(
    'API failed to start. Check service configuration and connectivity.',
  );
  process.exitCode = 1;
});

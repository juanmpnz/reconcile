import 'reflect-metadata';
import { parseServiceConfig } from '@reconcile/config';
import {
  createPrivateDocumentStorage,
  type PrivateDocumentStorage,
} from '@reconcile/document-processing';
import { registerClaimRoutes } from './claims.routes.js';
import { registerAgreementRoutes } from './agreements.routes.js';
import { registerAnalysisRoutes } from './analysis.routes.js';
import { registerDocumentRoutes } from './document.routes.js';
import { closeAfterStartupFailure } from './startup-diagnostics.js';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import type { PrismaClient } from '@reconcile/database';
import { capabilities, isOrganizationRole, type Auth } from '@reconcile/auth';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance } from 'fastify';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
@Module({ controllers: [HealthController], providers: [HealthService] })
class AppModule {}
export async function createApplication({
  auth,
  prisma,
  documentStorage,
}: {
  auth: Auth;
  prisma: PrismaClient;
  documentStorage?: PrivateDocumentStorage;
}): Promise<NestFastifyApplication> {
  const adapter = new FastifyAdapter({
    bodyLimit: 1024 * 1024,
    requestTimeout: 30000,
    genReqId: () => crypto.randomUUID(),
  });
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
    { logger: false, abortOnError: false },
  );
  app.setGlobalPrefix('api/v1');
  const server: FastifyInstance = adapter.getInstance();
  server.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    bodyLimit: 64 * 1024,
    handler: async (request, reply) => {
      const headers = fromNodeHeaders(request.headers);
      headers.set('x-reconcile-client-ip', request.ip);
      headers.delete('x-forwarded-for');
      headers.delete('x-real-ip');
      headers.delete('forwarded');
      headers.delete('x-forwarded-host');
      headers.delete('x-forwarded-proto');
      const url = new URL(request.raw.url ?? '/api/auth', auth.options.baseURL);
      const configuredBase = new URL(
        auth.options.baseURL ?? 'http://invalid.local',
      );
      if (url.origin !== configuredBase.origin)
        return reply.status(400).send({ code: 'INVALID_AUTH_URL' });
      const origin = headers.get('origin');
      const trustedOrigins = new Set([
        configuredBase.origin,
        ...(Array.isArray(auth.options.trustedOrigins)
          ? auth.options.trustedOrigins.filter(
              (value): value is string => typeof value === 'string',
            )
          : []),
      ]);
      // Browser auth writes require an explicit exact origin. Referer is not a fallback.
      // Email verification/reset GET links intentionally work without an Origin header.
      if (
        (request.method === 'POST' && !origin) ||
        (origin !== null && !trustedOrigins.has(origin)) ||
        (request.method === 'POST' &&
          headers.get('sec-fetch-site') === 'cross-site')
      ) {
        return reply.status(403).send({ code: 'UNTRUSTED_ORIGIN' });
      }
      headers.set('host', configuredBase.host);
      const body =
        request.method === 'GET'
          ? undefined
          : JSON.stringify(request.body ?? {});
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          ...(body === undefined ? {} : { body }),
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') reply.header(key, value);
      });
      const retryAfter = response.headers.get('x-retry-after');
      if (
        response.status === 429 &&
        !response.headers.has('retry-after') &&
        retryAfter !== null &&
        /^\d+$/.test(retryAfter)
      ) {
        reply.header('retry-after', retryAfter);
      }
      const cookies = response.headers.getSetCookie();
      if (cookies.length) reply.header('set-cookie', cookies);
      return reply.send(
        response.body ? Buffer.from(await response.arrayBuffer()) : undefined,
      );
    },
  });
  server.get<{ Params: { organizationId: string } }>(
    '/api/v1/organizations/:organizationId/context',
    async (request, reply) => {
      reply.header('cache-control', 'no-store');
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
        query: { disableCookieCache: true },
      });
      if (!session?.user.emailVerified)
        return reply.status(401).send({ code: 'UNAUTHORIZED' });
      const deny = async () => {
        await prisma.identityAuditEvent.create({
          data: {
            actorId: session.user.id,
            action: 'organization.context',
            outcome: 'denied',
            requestId: request.id.slice(0, 64),
          },
        });
        return reply.status(404).send({ code: 'NOT_FOUND' });
      };
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          request.params.organizationId,
        )
      )
        return deny();
      const member = await prisma.member.findUnique({
        where: {
          organizationId_userId: {
            organizationId: request.params.organizationId,
            userId: session.user.id,
          },
        },
        include: { organization: true },
      });
      if (!member || !isOrganizationRole(member.role)) return deny();
      await prisma.identityAuditEvent.create({
        data: {
          actorId: session.user.id,
          organizationId: member.organizationId,
          action: 'organization.context',
          outcome: 'success',
          requestId: request.id.slice(0, 64),
        },
      });
      return {
        organization: {
          id: member.organization.id,
          name: member.organization.name,
          slug: member.organization.slug,
        },
        membership: { role: member.role },
        capabilities: capabilities(member.role),
      };
    },
  );
  const storage =
    documentStorage ??
    createPrivateDocumentStorage(parseServiceConfig(process.env));
  registerDocumentRoutes(server, { auth, prisma, storage });
  registerAnalysisRoutes(server, { auth, prisma });
  registerAgreementRoutes(server, { auth, prisma });
  registerClaimRoutes(server, { auth, prisma });
  server.addHook('onClose', async () => {
    if (!documentStorage) storage.close();
    await prisma.$disconnect();
  });
  try {
    await app.init();
    await server.ready();
    return app;
  } catch (error) {
    await closeAfterStartupFailure(() => app.close());
    throw error;
  }
}

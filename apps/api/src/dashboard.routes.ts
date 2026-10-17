import { createBusinessRequestContext } from './request-context.js';
import type { FastifyInstance } from 'fastify';
import type { Auth } from '@reconcile/auth';
import type { PrismaClient } from '@reconcile/database';
import {
  getOrganizationDashboard,
  DocumentError,
} from '@reconcile/application';
export function registerDashboardRoutes(
  server: FastifyInstance,
  { auth, prisma }: { auth: Auth; prisma: PrismaClient },
) {
  const context = createBusinessRequestContext({
    auth,
    prisma,
    mutationBucket: 'analysis',
  });
  server.get<{ Params: { organizationId: string } }>(
    '/api/v1/organizations/:organizationId/dashboard',
    async (req, reply) => {
      reply.header('cache-control', 'private, no-store');
      reply.header('x-content-type-options', 'nosniff');
      try {
        const actor = await context(req, reply);
        return await getOrganizationDashboard(
          prisma,
          req.params.organizationId,
          actor,
        );
      } catch (error) {
        if (error instanceof DocumentError)
          return reply.status(error.status).send({ code: error.code });
        return reply.status(503).send({ code: 'DASHBOARD_UNAVAILABLE' });
      }
    },
  );
}

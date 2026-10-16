import type { FastifyInstance } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
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
  server.get<{ Params: { organizationId: string } }>(
    '/api/v1/organizations/:organizationId/dashboard',
    async (req, reply) => {
      reply.header('cache-control', 'private, no-store');
      reply.header('x-content-type-options', 'nosniff');
      try {
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            req.params.organizationId,
          )
        )
          throw new DocumentError(404, 'NOT_FOUND');
        const session = await auth.api.getSession({
          headers: fromNodeHeaders(req.headers),
          query: { disableCookieCache: true },
        });
        if (!session?.user.emailVerified)
          throw new DocumentError(401, 'UNAUTHORIZED');
        return await getOrganizationDashboard(
          prisma,
          req.params.organizationId,
          session.user.id,
        );
      } catch (error) {
        if (error instanceof DocumentError)
          return reply.status(error.status).send({ code: error.code });
        return reply.status(503).send({ code: 'DASHBOARD_UNAVAILABLE' });
      }
    },
  );
}

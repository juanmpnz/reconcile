import { agreementListQuerySchema } from '@reconcile/contracts';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from '@reconcile/auth';
import { Prisma, type PrismaClient } from '@reconcile/database';
import {
  createAnalysisService,
  createAgreementService,
  DocumentError,
  authorizeDocuments,
} from '@reconcile/application';
import {
  agreementCreateSchema,
  operationAgreementsSchema,
} from '@reconcile/contracts';
export function registerAgreementRoutes(
  server: FastifyInstance,
  { auth, prisma }: { auth: Auth; prisma: PrismaClient },
) {
  const service = createAgreementService({ prisma });
  const analysis = createAnalysisService({ prisma });
  type Params = {
    organizationId: string;
    operationId?: string;
    agreementVersionId?: string;
  };
  async function actor(
    req: FastifyRequest<{ Params: Params }>,
    reply: FastifyReply,
    write = false,
  ) {
    reply.header('cache-control', 'private, no-store');
    reply.header('x-content-type-options', 'nosniff');
    if (
      Object.values(req.params).some(
        (v) =>
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            v,
          ),
      )
    )
      throw new DocumentError(404, 'NOT_FOUND');
    if (write) {
      const origins = new Set([
        new URL(auth.options.baseURL ?? 'http://invalid.local').origin,
        ...(Array.isArray(auth.options.trustedOrigins)
          ? auth.options.trustedOrigins.filter(
              (o): o is string => typeof o === 'string',
            )
          : []),
      ]);
      if (
        !req.headers.origin ||
        !origins.has(req.headers.origin) ||
        req.headers['sec-fetch-site'] === 'cross-site'
      )
        throw new DocumentError(403, 'UNTRUSTED_ORIGIN');
    }
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
      query: { disableCookieCache: true },
    });
    if (!session?.user.emailVerified)
      throw new DocumentError(401, 'UNAUTHORIZED');
    await authorizeDocuments(
      prisma,
      req.params.organizationId,
      session.user.id,
      write,
    );
    if (write) {
      const now = BigInt(Date.now()),
        cutoff = now - 60000n,
        key = 'analysis-mutation:' + session.user.id;
      const counts = await prisma.$queryRaw<
        { count: number }[]
      >`INSERT INTO auth_rate_limits (id,key,count,"lastRequest") VALUES (${randomUUID()}::uuid,${key},1,${now}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN auth_rate_limits."lastRequest" < ${cutoff} THEN 1 ELSE auth_rate_limits.count+1 END,"lastRequest"=CASE WHEN auth_rate_limits."lastRequest" < ${cutoff} THEN ${now} ELSE auth_rate_limits."lastRequest" END RETURNING count`;
      if ((counts[0]?.count ?? 101) > 100) {
        reply.header('retry-after', '60');
        throw new DocumentError(429, 'RATE_LIMITED');
      }
    }
    return session.user.id;
  }
  async function bounded(reply: FastifyReply, fn: () => Promise<unknown>) {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2034' ||
          (error.code === 'P2010' &&
            typeof error.meta?.['code'] === 'string' &&
            error.meta['code'] === '40001'))
      )
        return reply.status(409).send({ code: 'CONCURRENT_UPDATE' });
      if (error instanceof DocumentError)
        return reply.status(error.status).send({ code: error.code });
      return reply.status(503).send({ code: 'AGREEMENT_SERVICE_UNAVAILABLE' });
    }
  }
  const base = '/api/v1/organizations/:organizationId/agreements';
  server.get<{
    Params: Params;
    Querystring: {
      limit?: string;
      offset?: string;
      q?: string;
      sort?: string;
      direction?: string;
    };
  }>(base, (req, reply) =>
    bounded(reply, async () => {
      const who = await actor(req, reply);
      const limit = Number(req.query.limit ?? 50),
        offset = Number(req.query.offset ?? 0);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 100000
      )
        throw new DocumentError(400, 'INVALID_PAGINATION');
      const options = agreementListQuerySchema.safeParse({
        q: req.query.q,
        sort: req.query.sort,
        direction: req.query.direction,
      });
      if (!options.success) throw new DocumentError(400, 'INVALID_LIST_QUERY');
      return service.list(
        req.params.organizationId,
        who,
        limit,
        offset,
        options.data,
      );
    }),
  );
  server.get<{ Params: Params }>(base + '/:agreementVersionId', (req, reply) =>
    bounded(reply, async () =>
      service.detail(
        req.params.organizationId,
        await actor(req, reply),
        req.params.agreementVersionId ?? '',
      ),
    ),
  );
  server.post<{ Params: Params }>(
    base,
    { bodyLimit: 128 * 1024 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = agreementCreateSchema.safeParse(req.body);
        if (!input.success) throw new DocumentError(400, 'INVALID_AGREEMENT');
        reply.status(201);
        return service.create(req.params.organizationId, who, input.data);
      }),
  );
  server.put<{ Params: Params }>(
    '/api/v1/organizations/:organizationId/operations/:operationId/agreements',
    { bodyLimit: 32 * 1024 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = operationAgreementsSchema.safeParse(req.body);
        if (!input.success)
          throw new DocumentError(400, 'INVALID_AGREEMENT_BINDINGS');
        await service.select(
          req.params.organizationId,
          req.params.operationId ?? '',
          who,
          input.data,
        );
        return analysis.detail(
          req.params.organizationId,
          req.params.operationId ?? '',
          who,
        );
      }),
  );
}

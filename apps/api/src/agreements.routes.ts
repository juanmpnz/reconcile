import { createBusinessRequestContext } from './request-context.js';
import { agreementListQuerySchema } from '@reconcile/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Auth } from '@reconcile/auth';
import { Prisma, type PrismaClient } from '@reconcile/database';
import {
  createAnalysisService,
  createAgreementService,
  DocumentError,
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
  const actor = createBusinessRequestContext({
    auth,
    prisma,
    mutationBucket: 'analysis',
  });
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

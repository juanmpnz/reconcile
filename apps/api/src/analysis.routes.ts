import { createBusinessRequestContext } from './request-context.js';
import { operationListQuerySchema } from '@reconcile/contracts';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Auth } from '@reconcile/auth';
import { Prisma, type PrismaClient } from '@reconcile/database';
import { createAnalysisService, DocumentError } from '@reconcile/application';
import {
  analysisRequestSchema,
  operationCreateSchema,
  operationUpdateSchema,
  operationDocumentsSchema,
  factRevisionInputSchema,
} from '@reconcile/contracts';
export function registerAnalysisRoutes(
  server: FastifyInstance,
  { auth, prisma }: { auth: Auth; prisma: PrismaClient },
) {
  const service = createAnalysisService({ prisma });
  type Params = {
    organizationId: string;
    operationId?: string;
    runId?: string;
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
      return reply.status(503).send({ code: 'ANALYSIS_SERVICE_UNAVAILABLE' });
    }
  }
  const base = '/api/v1/organizations/:organizationId/operations';
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
      const options = operationListQuerySchema.safeParse({
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
  server.post<{ Params: Params }>(base, { bodyLimit: 4096 }, (req, reply) =>
    bounded(reply, async () => {
      const who = await actor(req, reply, true);
      const input = operationCreateSchema.safeParse(req.body);
      if (!input.success) throw new DocumentError(400, 'INVALID_OPERATION');
      reply.status(201);
      return service.create(req.params.organizationId, who, input.data);
    }),
  );
  server.get<{ Params: Params }>(base + '/:operationId', (req, reply) =>
    bounded(reply, async () =>
      service.detail(
        req.params.organizationId,
        req.params.operationId ?? '',
        await actor(req, reply),
      ),
    ),
  );
  server.patch<{ Params: Params }>(
    base + '/:operationId',
    { bodyLimit: 4096 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = operationUpdateSchema.safeParse(req.body);
        if (!input.success) throw new DocumentError(400, 'INVALID_OPERATION');
        return service.update(
          req.params.organizationId,
          req.params.operationId ?? '',
          who,
          input.data,
        );
      }),
  );
  server.put<{ Params: Params }>(
    base + '/:operationId/documents',
    { bodyLimit: 8192 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = operationDocumentsSchema.safeParse(req.body);
        if (!input.success)
          throw new DocumentError(400, 'INVALID_DOCUMENT_LINKS');
        return service.link(
          req.params.organizationId,
          req.params.operationId ?? '',
          who,
          input.data,
        );
      }),
  );
  server.post<{ Params: Params }>(
    base + '/:operationId/fact-revisions',
    { bodyLimit: 256 * 1024 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = factRevisionInputSchema.safeParse(req.body);
        if (!input.success)
          throw new DocumentError(400, 'INVALID_FACT_REVISION');
        return service.revise(
          req.params.organizationId,
          req.params.operationId ?? '',
          who,
          input.data,
        );
      }),
  );
  server.post<{ Params: Params }>(
    base + '/:operationId/analyses',
    { bodyLimit: 4096 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = analysisRequestSchema.safeParse(req.body);
        if (!input.success)
          throw new DocumentError(400, 'INVALID_ANALYSIS_REQUEST');
        reply.status(202);
        return service.request(
          req.params.organizationId,
          req.params.operationId ?? '',
          who,
          input.data.idempotencyKey,
        );
      }),
  );
  server.get<{
    Params: Params;
    Querystring: { limit?: string; offset?: string };
  }>(base + '/:operationId/analyses', (req, reply) =>
    bounded(reply, async () => {
      const who = await actor(req, reply);
      const limit = Number(req.query.limit ?? 25),
        offset = Number(req.query.offset ?? 0);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 50 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 100000
      )
        throw new DocumentError(400, 'INVALID_PAGINATION');
      return service.history(
        req.params.organizationId,
        req.params.operationId ?? '',
        who,
        limit,
        offset,
      );
    }),
  );
  server.get<{ Params: Params }>(
    base + '/:operationId/analyses/:runId',
    (req, reply) =>
      bounded(reply, async () =>
        service.run(
          req.params.organizationId,
          req.params.operationId ?? '',
          req.params.runId ?? '',
          await actor(req, reply),
        ),
      ),
  );
}

import { createBusinessRequestContext } from './request-context.js';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Auth } from '@reconcile/auth';
import { Prisma, type PrismaClient } from '@reconcile/database';
import { createClaimService, DocumentError } from '@reconcile/application';
import {
  findingDecisionInputSchema,
  claimCreateInputSchema,
  claimDraftInputSchema,
  claimEventInputSchema,
  claimExportInputSchema,
  claimRebaseInputSchema,
} from '@reconcile/contracts';
export function registerClaimRoutes(
  server: FastifyInstance,
  { auth, prisma }: { auth: Auth; prisma: PrismaClient },
) {
  const service = createClaimService({ prisma });
  type Params = {
    organizationId: string;
    operationId: string;
    claimId?: string;
    exportId?: string;
    runId?: string;
  };
  const actor = createBusinessRequestContext({
    auth,
    prisma,
    mutationBucket: 'claim',
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
      return reply.status(503).send({ code: 'CLAIM_SERVICE_UNAVAILABLE' });
    }
  }

  const base = '/api/v1/organizations/:organizationId/operations/:operationId';
  server.get<{ Params: Params }>(base + '/review', (req, reply) =>
    bounded(reply, async () =>
      service.review(
        req.params.organizationId,
        req.params.operationId,
        await actor(req, reply),
      ),
    ),
  );
  server.post<{ Params: Params }>(
    base + '/analyses/:runId/decisions',
    { bodyLimit: 8192 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = findingDecisionInputSchema.safeParse(req.body);
        if (!input.success) throw new DocumentError(400, 'INVALID_DECISION');
        return service.decide(
          req.params.organizationId,
          req.params.operationId,
          req.params.runId ?? '',
          who,
          input.data,
        );
      }),
  );
  server.post<{ Params: Params }>(
    base + '/claims',
    { bodyLimit: 8192 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = claimCreateInputSchema.safeParse(req.body);
        if (!input.success) throw new DocumentError(400, 'INVALID_CLAIM');
        reply.status(201);
        return service.create(
          req.params.organizationId,
          req.params.operationId,
          who,
          input.data,
        );
      }),
  );
  server.get<{ Params: Params }>(base + '/claims/:claimId', (req, reply) =>
    bounded(reply, async () =>
      service.detail(
        req.params.organizationId,
        req.params.operationId,
        req.params.claimId ?? '',
        await actor(req, reply),
      ),
    ),
  );
  server.patch<{ Params: Params }>(
    base + '/claims/:claimId',
    { bodyLimit: 20000 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = claimDraftInputSchema.safeParse(req.body);
        if (!input.success) throw new DocumentError(400, 'INVALID_CLAIM_DRAFT');
        return service.edit(
          req.params.organizationId,
          req.params.operationId,
          req.params.claimId ?? '',
          who,
          input.data,
        );
      }),
  );
  server.post<{ Params: Params }>(
    base + '/claims/:claimId/rebase',
    { bodyLimit: 8192 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = claimRebaseInputSchema.safeParse(req.body);
        if (!input.success)
          throw new DocumentError(400, 'INVALID_CLAIM_REBASE');
        return service.rebase(
          req.params.organizationId,
          req.params.operationId,
          req.params.claimId ?? '',
          who,
          input.data,
        );
      }),
  );
  server.post<{ Params: Params }>(
    base + '/claims/:claimId/events',
    { bodyLimit: 8192 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = claimEventInputSchema.safeParse(req.body);
        if (!input.success) throw new DocumentError(400, 'INVALID_CLAIM_EVENT');
        return service.event(
          req.params.organizationId,
          req.params.operationId,
          req.params.claimId ?? '',
          who,
          input.data,
        );
      }),
  );
  server.get<{ Params: Params }>(
    base + '/claims/:claimId/exports/:exportId',
    (req, reply) =>
      bounded(reply, async () => {
        const file = await service.downloadExport(
          req.params.organizationId,
          req.params.operationId,
          req.params.claimId ?? '',
          req.params.exportId ?? '',
          await actor(req, reply),
        );
        reply.header('content-type', file.contentType);
        reply.header(
          'content-disposition',
          `attachment; filename="${file.filename}"`,
        );
        reply.header('content-security-policy', "sandbox; default-src 'none'");
        return reply.send(file.bytes);
      }),
  );
  server.post<{ Params: Params }>(
    base + '/claims/:claimId/export',
    { bodyLimit: 4096 },
    (req, reply) =>
      bounded(reply, async () => {
        const who = await actor(req, reply, true);
        const input = claimExportInputSchema.safeParse(req.body);
        if (!input.success)
          throw new DocumentError(400, 'INVALID_CLAIM_EXPORT');
        const file = await service.export(
          req.params.organizationId,
          req.params.operationId,
          req.params.claimId ?? '',
          who,
          input.data,
        );
        reply.header('content-type', file.contentType);
        reply.header(
          'content-disposition',
          `attachment; filename="${file.filename}"`,
        );
        reply.header('content-security-policy', "sandbox; default-src 'none'");
        return reply.send(file.bytes);
      }),
  );
}

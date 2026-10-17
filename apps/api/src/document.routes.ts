import { createBusinessRequestContext } from './request-context.js';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Auth } from '@reconcile/auth';
import { Prisma, type PrismaClient } from '@reconcile/database';
import { createDocumentService, DocumentError } from '@reconcile/application';
import {
  DOCUMENT_MAX_BYTES,
  documentKindSchema,
  correctionInputSchema,
  documentMetadataInputSchema,
  documentListQuerySchema,
} from '@reconcile/contracts';
import type { PrivateDocumentStorage } from '@reconcile/document-processing';
export function registerDocumentRoutes(
  server: FastifyInstance,
  {
    auth,
    prisma,
    storage,
  }: { auth: Auth; prisma: PrismaClient; storage: PrivateDocumentStorage },
) {
  const service = createDocumentService({ prisma, storage });
  server.addContentTypeParser(
    'application/pdf',
    { parseAs: 'buffer', bodyLimit: DOCUMENT_MAX_BYTES },
    (_request, body, done) => done(null, body),
  );
  type Params = { organizationId: string; documentId?: string };
  const context = createBusinessRequestContext({
    auth,
    prisma,
    mutationBucket: 'document',
  });
  async function bounded(reply: FastifyReply, action: () => Promise<unknown>) {
    try {
      return await action();
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
      return reply.status(503).send({ code: 'DOCUMENT_SERVICE_UNAVAILABLE' });
    }
  }
  const base = '/api/v1/organizations/:organizationId/documents';
  server.get<{
    Params: Params;
    Querystring: {
      limit?: string;
      offset?: string;
      q?: string;
      sort?: string;
      direction?: string;
    };
  }>(base, async (req, reply) =>
    bounded(reply, async () => {
      const actor = await context(req, reply);
      const limit =
        req.query.limit === undefined ? 50 : Number(req.query.limit);
      const offset =
        req.query.offset === undefined ? 0 : Number(req.query.offset);
      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 100000
      )
        throw new DocumentError(400, 'INVALID_PAGINATION');
      const options = documentListQuerySchema.safeParse({
        q: req.query.q,
        sort: req.query.sort,
        direction: req.query.direction,
      });
      if (!options.success)
        throw new DocumentError(400, 'INVALID_DOCUMENT_QUERY');
      return service.list(
        req.params.organizationId,
        actor,
        limit,
        offset,
        options.data,
      );
    }),
  );
  server.patch<{ Params: Params }>(
    base + '/:documentId',
    { bodyLimit: 8192 },
    (req, reply) =>
      bounded(reply, async () => {
        const actor = await context(req, reply, true);
        const input = documentMetadataInputSchema.safeParse(req.body);
        if (!input.success)
          throw new DocumentError(400, 'INVALID_DOCUMENT_METADATA');
        return service.updateMetadata(
          req.params.organizationId,
          req.params.documentId ?? '',
          actor,
          input.data,
        );
      }),
  );
  server.post<{ Params: Params }>(
    base,
    {
      bodyLimit: DOCUMENT_MAX_BYTES,
      onRequest: async (req, reply) => {
        await bounded(reply, async () => {
          await context(req, reply, true);
          if (req.headers['content-type'] !== 'application/pdf')
            throw new DocumentError(415, 'PDF_REQUIRED');
        });
      },
    },
    async (req, reply) =>
      bounded(reply, async () => {
        const actor = await context(req, reply, true);
        if (
          req.headers['content-type'] !== 'application/pdf' ||
          !Buffer.isBuffer(req.body)
        )
          throw new DocumentError(415, 'PDF_REQUIRED');
        if (
          req.body.length < 5 ||
          req.body.length > DOCUMENT_MAX_BYTES ||
          req.body.subarray(0, 5).toString('ascii') !== '%PDF-'
        )
          throw new DocumentError(400, 'INVALID_PDF');
        let filename: string;
        try {
          filename = decodeURIComponent(
            String(req.headers['x-document-filename'] ?? ''),
          );
        } catch {
          throw new DocumentError(400, 'INVALID_FILENAME');
        }
        if (
          !filename ||
          filename.length > 200 ||
          Array.from(filename).some((character) => {
            const code = character.codePointAt(0) ?? 0;
            return (
              code < 32 ||
              code === 127 ||
              character === '/' ||
              character === '\\'
            );
          }) ||
          !filename.toLowerCase().endsWith('.pdf')
        )
          throw new DocumentError(400, 'INVALID_FILENAME');
        const kind = documentKindSchema.safeParse(
          req.headers['x-document-kind'],
        );
        if (!kind.success)
          throw new DocumentError(400, 'INVALID_DOCUMENT_KIND');
        const result = await service.upload(req.params.organizationId, actor, {
          filename,
          kind: kind.data,
          bytes: req.body,
        });
        reply.status(result.created ? 201 : 200);
        return result.document;
      }),
  );
  server.get<{ Params: Params }>(`${base}/:documentId`, async (req, reply) =>
    bounded(reply, async () =>
      service.detail(
        req.params.organizationId,
        req.params.documentId ?? '',
        await context(req, reply),
      ),
    ),
  );
  server.get<{ Params: Params }>(
    `${base}/:documentId/download`,
    async (req, reply) =>
      bounded(reply, async () => {
        const actor = await context(req, reply);
        const result = await service.download(
          req.params.organizationId,
          req.params.documentId ?? '',
          actor,
        );
        reply.header('content-type', 'application/pdf');
        reply.header(
          'content-disposition',
          `attachment; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(result.filename).replace(/'/g, '%27')}`,
        );
        reply.header('content-security-policy', "sandbox; default-src 'none'");
        return reply.send(Buffer.from(result.bytes));
      }),
  );
  server.post<{ Params: Params }>(
    `${base}/:documentId/retry`,
    { bodyLimit: 4096 },
    async (req, reply) =>
      bounded(reply, async () => {
        const actor = await context(req, reply, true);
        reply.status(202);
        return service.retry(
          req.params.organizationId,
          req.params.documentId ?? '',
          actor,
        );
      }),
  );
  server.post<{ Params: Params }>(
    `${base}/:documentId/corrections`,
    { bodyLimit: 8192 },
    async (req, reply) =>
      bounded(reply, async () => {
        const actor = await context(req, reply, true);
        const input = correctionInputSchema.safeParse(req.body);
        if (!input.success) throw new DocumentError(400, 'INVALID_CORRECTION');
        reply.status(201);
        return service.correct(
          req.params.organizationId,
          req.params.documentId ?? '',
          actor,
          input.data,
        );
      }),
  );
}

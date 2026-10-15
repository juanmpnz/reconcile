import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from '@reconcile/auth';
import type { PrismaClient } from '@reconcile/database';
import {
  createDocumentService,
  DocumentError,
  authorizeDocuments,
} from '@reconcile/application';
import {
  DOCUMENT_MAX_BYTES,
  documentKindSchema,
  correctionInputSchema,
} from '@reconcile/contracts';
import type { PrivateDocumentStorage } from '@reconcile/document-processing';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function registerDocumentRoutes(
  server: FastifyInstance,
  {
    auth,
    prisma,
    storage,
  }: { auth: Auth; prisma: PrismaClient; storage: PrivateDocumentStorage },
) {
  const service = createDocumentService({ prisma, storage });
  const requestActors = new WeakMap<object, string>();
  server.addContentTypeParser(
    'application/pdf',
    { parseAs: 'buffer', bodyLimit: DOCUMENT_MAX_BYTES },
    (_request, body, done) => done(null, body),
  );
  type Params = { organizationId: string; documentId?: string };
  async function context(
    request: FastifyRequest<{ Params: Params }>,
    reply: FastifyReply,
    write = false,
  ) {
    reply.header('cache-control', 'private, no-store');
    reply.header('x-content-type-options', 'nosniff');
    const cachedActor = requestActors.get(request);
    if (cachedActor) return cachedActor;
    if (
      !uuid.test(request.params.organizationId) ||
      (request.params.documentId && !uuid.test(request.params.documentId))
    )
      throw new DocumentError(404, 'NOT_FOUND');
    if (write) {
      const origin = request.headers.origin;
      const allowed = new Set([
        new URL(auth.options.baseURL ?? 'http://invalid.local').origin,
        ...(Array.isArray(auth.options.trustedOrigins)
          ? auth.options.trustedOrigins.filter(
              (o): o is string => typeof o === 'string',
            )
          : []),
      ]);
      if (
        !origin ||
        !allowed.has(origin) ||
        request.headers['sec-fetch-site'] === 'cross-site'
      )
        throw new DocumentError(403, 'UNTRUSTED_ORIGIN');
    }
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      query: { disableCookieCache: true },
    });
    if (!session?.user.emailVerified)
      throw new DocumentError(401, 'UNAUTHORIZED');
    await authorizeDocuments(
      prisma,
      request.params.organizationId,
      session.user.id,
      write,
    );
    if (write) {
      const now = BigInt(Date.now());
      const cutoff = now - 60000n;
      const key = `document-mutation:${session.user.id}`;
      const counts = await prisma.$queryRaw<
        { count: number }[]
      >`INSERT INTO auth_rate_limits (id,key,count,"lastRequest") VALUES (${randomUUID()}::uuid,${key},1,${now}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN auth_rate_limits."lastRequest" < ${cutoff} THEN 1 ELSE auth_rate_limits.count+1 END,"lastRequest"=CASE WHEN auth_rate_limits."lastRequest" < ${cutoff} THEN ${now} ELSE auth_rate_limits."lastRequest" END RETURNING count`;
      if ((counts[0]?.count ?? 101) > 100) {
        reply.header('retry-after', '60');
        throw new DocumentError(429, 'RATE_LIMITED');
      }
    }
    requestActors.set(request, session.user.id);
    return session.user.id;
  }
  async function bounded(reply: FastifyReply, action: () => Promise<unknown>) {
    try {
      return await action();
    } catch (error) {
      if (error instanceof DocumentError)
        return reply.status(error.status).send({ code: error.code });
      return reply.status(503).send({ code: 'DOCUMENT_SERVICE_UNAVAILABLE' });
    }
  }
  const base = '/api/v1/organizations/:organizationId/documents';
  server.get<{
    Params: Params;
    Querystring: { limit?: string; offset?: string };
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
      return service.list(req.params.organizationId, actor, limit, offset);
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

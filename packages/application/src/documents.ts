import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@reconcile/database';
import {
  correctionInputSchema,
  documentDetailSchema,
  documentListSchema,
  documentSummarySchema,
  extractionResultSchema,
  documentJobSchema,
  type DocumentKind,
  type CorrectionInput,
} from '@reconcile/contracts';
import {
  extractPdf,
  ExtractionError,
  type PrivateDocumentStorage,
} from '@reconcile/document-processing';
export class DocumentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
type Database = Pick<PrismaClient, 'member'>;
export async function authorizeDocuments(
  db: Database,
  organizationId: string,
  actorId: string,
  write = false,
) {
  const member = await db.member.findUnique({
    where: { organizationId_userId: { organizationId, userId: actorId } },
    include: { user: { select: { emailVerified: true } } },
  });
  if (
    !member ||
    !member.user.emailVerified ||
    !['owner', 'admin', 'analyst', 'viewer'].includes(member.role)
  )
    throw new DocumentError(404, 'NOT_FOUND');
  if (write && member.role === 'viewer')
    throw new DocumentError(403, 'FORBIDDEN');
  return member;
}
function summary(doc: {
  id: string;
  organizationId: string;
  filename: string;
  kind: string;
  sizeBytes: number;
  status: string;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return documentSummarySchema.parse({
    ...doc,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  });
}
export function createDocumentService({
  prisma,
  storage,
}: {
  prisma: PrismaClient;
  storage: PrivateDocumentStorage;
}) {
  async function detail(
    organizationId: string,
    documentId: string,
    actorId: string,
  ) {
    const member = await authorizeDocuments(prisma, organizationId, actorId);
    const doc = await prisma.document.findFirst({
      where: { id: documentId, organizationId },
      include: { runs: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!doc) throw new DocumentError(404, 'NOT_FOUND');
    const run = doc.runs[0];
    const corrections = await prisma.documentCorrection.findMany({
      where: { organizationId, documentId },
      orderBy: { revision: 'asc' },
      take: 1000,
    });
    return documentDetailSchema.parse({
      ...summary(doc),
      sha256: doc.sha256,
      latestRun: run
        ? {
            id: run.id,
            version: run.version,
            status: run.status,
            errorCode: run.errorCode,
            result: run.result
              ? extractionResultSchema.parse(run.result)
              : null,
            createdAt: run.createdAt.toISOString(),
            completedAt: run.completedAt?.toISOString() ?? null,
          }
        : null,
      corrections: corrections.map((c) => ({
        id: c.id,
        revision: c.revision,
        extractionRunId: c.extractionRunId,
        field: c.field,
        value: c.value,
        reason: c.reason,
        actorId: c.actorId,
        createdAt: c.createdAt.toISOString(),
      })),
      capabilities: { canWrite: member.role !== 'viewer' },
    });
  }
  async function newRun(
    tx: Prisma.TransactionClient,
    organizationId: string,
    documentId: string,
    actorId: string,
  ) {
    const updated = await tx.document.update({
      where: { id: documentId },
      data: { runCount: { increment: 1 }, status: 'queued', errorCode: null },
    });
    const run = await tx.extractionRun.create({
      data: { organizationId, documentId, actorId, version: updated.runCount },
    });
    await tx.document.update({
      where: { id: documentId },
      data: { currentRunId: run.id },
    });
    await tx.documentOutbox.create({
      data: { organizationId, documentId, runId: run.id, actorId },
    });
    return run;
  }
  return {
    detail,
    async list(
      organizationId: string,
      actorId: string,
      limit: number,
      offset: number,
    ) {
      await authorizeDocuments(prisma, organizationId, actorId);
      const [items, total] = await prisma.$transaction([
        prisma.document.findMany({
          where: { organizationId },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: limit,
          skip: offset,
        }),
        prisma.document.count({ where: { organizationId } }),
      ]);
      return documentListSchema.parse({
        items: items.map(summary),
        total,
        limit,
        offset,
      });
    },
    async upload(
      organizationId: string,
      actorId: string,
      input: { filename: string; kind: DocumentKind; bytes: Uint8Array },
    ) {
      await authorizeDocuments(prisma, organizationId, actorId, true);
      const sha256 = createHash('sha256').update(input.bytes).digest('hex');
      const existing = await prisma.document.findUnique({
        where: { organizationId_sha256: { organizationId, sha256 } },
      });
      if (existing)
        return {
          created: false,
          document: await detail(organizationId, existing.id, actorId),
        };
      const id = randomUUID();
      const storageKey = `organizations/${organizationId}/documents/${id}/original.pdf`;
      await storage.put(storageKey, input.bytes);
      try {
        await prisma.$transaction(async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId, true);
          if ((await tx.document.count({ where: { organizationId } })) >= 1000)
            throw new DocumentError(409, 'DOCUMENT_LIMIT');
          await tx.document.create({
            data: {
              id,
              organizationId,
              filename: input.filename,
              kind: input.kind,
              sizeBytes: input.bytes.length,
              sha256,
              storageKey,
              uploadedBy: actorId,
            },
          });
          await newRun(tx, organizationId, id, actorId);
          await tx.identityAuditEvent.create({
            data: {
              organizationId,
              actorId,
              action: 'document.uploaded',
              outcome: 'success',
            },
          });
        });
      } catch (error) {
        await storage.remove(storageKey).catch(() => undefined);
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const duplicate = await prisma.document.findUnique({
            where: { organizationId_sha256: { organizationId, sha256 } },
          });
          if (duplicate)
            return {
              created: false,
              document: await detail(organizationId, duplicate.id, actorId),
            };
        }
        throw error;
      }
      return {
        created: true,
        document: await detail(organizationId, id, actorId),
      };
    },
    async download(
      organizationId: string,
      documentId: string,
      actorId: string,
    ) {
      await authorizeDocuments(prisma, organizationId, actorId);
      const doc = await prisma.document.findFirst({
        where: { id: documentId, organizationId },
      });
      if (!doc) throw new DocumentError(404, 'NOT_FOUND');
      const bytes = await storage.get(doc.storageKey);
      if (
        bytes.length !== doc.sizeBytes ||
        createHash('sha256').update(bytes).digest('hex') !== doc.sha256
      )
        throw new DocumentError(503, 'ORIGINAL_INTEGRITY_ERROR');
      await authorizeDocuments(prisma, organizationId, actorId);
      await prisma.identityAuditEvent.create({
        data: {
          organizationId,
          actorId,
          action: 'document.downloaded',
          outcome: 'success',
        },
      });
      return { filename: doc.filename, bytes };
    },
    async retry(organizationId: string, documentId: string, actorId: string) {
      await prisma.$transaction(async (tx) => {
        await authorizeDocuments(tx, organizationId, actorId, true);
        const doc = await tx.document.findFirst({
          where: { id: documentId, organizationId },
        });
        if (!doc) throw new DocumentError(404, 'NOT_FOUND');
        if (!['failed', 'blocked'].includes(doc.status))
          throw new DocumentError(409, 'RETRY_NOT_AVAILABLE');
        const changed = await tx.document.updateMany({
          where: {
            id: documentId,
            organizationId,
            status: doc.status,
            currentRunId: doc.currentRunId,
          },
          data: { status: 'queued' },
        });
        if (changed.count !== 1)
          throw new DocumentError(409, 'RETRY_NOT_AVAILABLE');
        await newRun(tx, organizationId, documentId, actorId);
        await tx.identityAuditEvent.create({
          data: {
            organizationId,
            actorId,
            action: 'document.retried',
            outcome: 'success',
          },
        });
      });
      return detail(organizationId, documentId, actorId);
    },
    async correct(
      organizationId: string,
      documentId: string,
      actorId: string,
      input: CorrectionInput,
    ) {
      const data = correctionInputSchema.parse(input);
      await prisma.$transaction(async (tx) => {
        await authorizeDocuments(tx, organizationId, actorId, true);
        const doc = await tx.document.findFirst({
          where: { id: documentId, organizationId },
        });
        if (!doc) throw new DocumentError(404, 'NOT_FOUND');
        if (
          doc.currentRunId !== data.extractionRunId ||
          !['needs_review', 'ready'].includes(doc.status)
        )
          throw new DocumentError(409, 'STALE_EXTRACTION');
        const reserved = await tx.document.updateMany({
          where: {
            id: documentId,
            organizationId,
            correctionCount: { lt: 1000 },
            currentRunId: data.extractionRunId,
          },
          data: { correctionCount: { increment: 1 } },
        });
        if (reserved.count !== 1)
          throw new DocumentError(409, 'CORRECTION_LIMIT');
        const revision = await tx.document.findUniqueOrThrow({
          where: { id: documentId },
          select: { correctionCount: true },
        });
        await tx.documentCorrection.create({
          data: {
            ...data,
            organizationId,
            documentId,
            actorId,
            revision: revision.correctionCount,
          },
        });
        await tx.identityAuditEvent.create({
          data: {
            organizationId,
            actorId,
            action: 'document.corrected',
            outcome: 'success',
          },
        });
      });
      return detail(organizationId, documentId, actorId);
    },
  };
}
export async function processDocumentRun({
  prisma,
  storage,
  payload,
}: {
  prisma: PrismaClient;
  storage: PrivateDocumentStorage;
  payload: unknown;
}) {
  const job = documentJobSchema.parse(payload);
  const persisted = await prisma.documentOutbox.findUnique({
    where: { id: job.outboxId },
  });
  if (
    !persisted ||
    persisted.organizationId !== job.organizationId ||
    persisted.documentId !== job.documentId ||
    persisted.runId !== job.runId ||
    persisted.actorId !== job.actorId
  )
    throw new DocumentError(400, 'INVALID_JOB');
  if (persisted.completedAt) return;
  const leaseToken = randomUUID();
  const claimedRun = await prisma.$transaction(async (tx) => {
    const claimed = await tx.extractionRun.updateMany({
      where: {
        id: job.runId,
        organizationId: job.organizationId,
        documentId: job.documentId,
        OR: [
          { status: 'queued' },
          { status: 'processing', leaseUntil: { lt: new Date() } },
        ],
      },
      data: {
        status: 'processing',
        attempts: { increment: 1 },
        leaseUntil: new Date(Date.now() + 45000),
        leaseToken,
      },
    });
    if (claimed.count !== 1) return null;
    await tx.document.updateMany({
      where: {
        id: job.documentId,
        organizationId: job.organizationId,
        currentRunId: job.runId,
      },
      data: { status: 'processing', errorCode: null },
    });
    return tx.extractionRun.findUniqueOrThrow({ where: { id: job.runId } });
  });
  if (!claimedRun) return;
  let result: Awaited<ReturnType<typeof extractPdf>> | undefined;
  let status = 'needs_review';
  let errorCode: string | null = null;
  try {
    await authorizeDocuments(prisma, job.organizationId, job.actorId, true);
    if (claimedRun.attempts > 3)
      throw new ExtractionError('PROCESSING_RETRIES_EXHAUSTED');
    const doc = await prisma.document.findFirst({
      where: { id: job.documentId, organizationId: job.organizationId },
    });
    if (!doc) throw new DocumentError(404, 'NOT_FOUND');
    const bytes = await storage.get(doc.storageKey);
    if (createHash('sha256').update(bytes).digest('hex') !== doc.sha256)
      throw new ExtractionError('ORIGINAL_INTEGRITY_ERROR');
    result = await extractPdf(bytes);
    errorCode = result.warnings.includes('OCR_UNSUPPORTED')
      ? 'OCR_UNSUPPORTED'
      : null;
  } catch (error) {
    if (error instanceof DocumentError) {
      status = 'blocked';
      errorCode = 'ACCESS_REVOKED';
    } else if (error instanceof ExtractionError) {
      status = 'failed';
      errorCode = error.code;
    } else if (claimedRun.attempts >= 3) {
      status = 'failed';
      errorCode = 'PROCESSING_RETRIES_EXHAUSTED';
    } else {
      await prisma.$transaction(async (tx) => {
        const changed = await tx.extractionRun.updateMany({
          where: {
            id: job.runId,
            leaseToken,
            status: 'processing',
            leaseUntil: { gt: new Date() },
          },
          data: { status: 'queued', leaseUntil: null, leaseToken: null },
        });
        if (changed.count === 1)
          await tx.document.updateMany({
            where: {
              id: job.documentId,
              organizationId: job.organizationId,
              currentRunId: job.runId,
            },
            data: { status: 'queued', errorCode: 'STORAGE_UNAVAILABLE' },
          });
      });
      throw new DocumentError(503, 'PROCESSING_TEMPORARILY_UNAVAILABLE');
    }
  }
  await prisma.$transaction(async (tx) => {
    try {
      await authorizeDocuments(tx, job.organizationId, job.actorId, true);
    } catch (error) {
      if (!(error instanceof DocumentError)) throw error;
      status = 'blocked';
      errorCode = 'ACCESS_REVOKED';
      result = undefined;
    }
    const changed = await tx.extractionRun.updateMany({
      where: {
        id: job.runId,
        leaseToken,
        status: 'processing',
        leaseUntil: { gt: new Date() },
      },
      data: {
        status,
        errorCode,
        ...(result ? { result } : {}),
        completedAt: new Date(),
        leaseUntil: null,
        leaseToken: null,
      },
    });
    if (changed.count !== 1) return;
    await tx.document.updateMany({
      where: {
        id: job.documentId,
        organizationId: job.organizationId,
        currentRunId: job.runId,
      },
      data: { status, errorCode },
    });
    await tx.documentOutbox.update({
      where: { id: job.outboxId },
      data: { completedAt: new Date() },
    });
    await tx.identityAuditEvent.create({
      data: {
        actorId: job.actorId,
        organizationId: job.organizationId,
        action: 'document.extracted',
        outcome:
          status === 'needs_review'
            ? 'success'
            : status === 'blocked'
              ? 'denied'
              : 'failure',
      },
    });
  });
}

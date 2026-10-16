import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@reconcile/database';
import { deriveAnalysisFacts } from '@reconcile/document-processing';
import {
  evaluateLogistics,
  LOGISTICS_RULE_VERSION,
} from '@reconcile/sector-rules';
import {
  ANALYSIS_PARSER_VERSION,
  analysisDocumentSchema,
  analysisJobSchema,
  analysisRunSchema,
  analysisHistorySchema,
  analysisSnapshotSchema,
  analysisResultSchema,
  operationDetailSchema,
  operationListSchema,
  operationCreateSchema,
  operationListQuerySchema,
  operationUpdateSchema,
  operationDocumentsSchema,
  factRevisionInputSchema,
  extractionResultSchema,
  documentKindSchema,
} from '@reconcile/contracts';
import { authorizeDocuments, DocumentError } from './documents.js';
import { agreementDto } from './agreements.js';
function boundedJson(value: unknown, code: string, maxBytes = 128 * 1024) {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > maxBytes)
    throw new DocumentError(422, code);
}
const hash = (input: unknown) =>
  createHash('sha256').update(JSON.stringify(input)).digest('hex');
type Tx = Prisma.TransactionClient;
async function operation(tx: Tx, organizationId: string, operationId: string) {
  const op = await tx.operation.findFirst({
    where: { id: operationId, organizationId },
  });
  if (!op) throw new DocumentError(404, 'NOT_FOUND');
  return op;
}
export async function collectAnalysisInputs(
  tx: Tx,
  organizationId: string,
  operationId: string,
) {
  const op = await operation(tx, organizationId, operationId);
  const links = await tx.operationDocument.findMany({
    where: { organizationId, operationId },
    orderBy: { documentId: 'asc' },
    include: { document: { include: { currentRun: true } } },
  });
  const selected = await tx.operationAgreementBinding.findMany({
    where: { organizationId, operationId },
    orderBy: { invoiceDocumentId: 'asc' },
    include: { agreement: true },
  });
  const agreementBindings = selected.map((binding) => ({
    invoiceDocumentId: binding.invoiceDocumentId,
    agreementVersionId: binding.agreementVersionId,
    serviceDate: binding.serviceDate,
    route: binding.route,
    distanceKm: binding.distanceKm?.toFixed() ?? null,
    agreement: agreementDto(binding.agreement),
  }));
  const facts = [];
  const sources = [];
  const warnings: string[] = [];
  for (const link of links) {
    const doc = link.document;
    // Explicitly selected immutable agreements supersede mutable facts for their source PDFs.
    if (agreementBindings.some((b) => b.agreement.sourceDocumentId === doc.id))
      continue;
    const run = doc.currentRun;
    const corrections = await tx.documentCorrection.findMany({
      where: {
        organizationId,
        documentId: doc.id,
        extractionRunId: run?.id ?? randomUUID(),
      },
      orderBy: { revision: 'asc' },
    });
    const sourceFingerprint = hash({
      documentId: doc.id,
      sha256: doc.sha256,
      kind: doc.kind,
      runId: run?.id ?? null,
      result: run?.result ?? null,
      corrections,
    });
    const revision = await tx.analysisFactRevision.findFirst({
      where: {
        organizationId,
        operationId,
        documentId: doc.id,
        sourceFingerprint,
      },
      orderBy: { ordinal: 'desc' },
    });
    sources.push({
      documentId: doc.id,
      sourceFingerprint,
      factRevisionId: revision?.id ?? null,
      sha256: doc.sha256,
      extractionRunId: run?.id ?? null,
      extractionVersion: run?.version ?? null,
      correctionRevision: doc.correctionCount,
      ...(doc.metadataVersion > 0
        ? { metadataVersion: doc.metadataVersion }
        : {}),
    });
    if (doc.kind === 'other') {
      warnings.push('UNSUPPORTED_DOCUMENT_KIND:' + doc.id);
      continue;
    }
    if (!run?.result || !['needs_review', 'ready'].includes(run.status)) {
      warnings.push('DOCUMENT_NOT_EXTRACTED:' + doc.id);
      continue;
    }
    const parsed = extractionResultSchema.safeParse(run.result);
    if (!parsed.success) {
      warnings.push('EXTRACTION_UNSUPPORTED:' + doc.id);
      continue;
    }
    try {
      const fact = revision
        ? analysisDocumentSchema.parse(revision.facts)
        : deriveAnalysisFacts({
            documentId: doc.id,
            extractionRunId: run.id,
            kind: documentKindSchema.parse(doc.kind),
            result: parsed.data,
            corrections,
          });
      boundedJson(fact, 'DOCUMENT_FACTS_LIMIT', 16 * 1024);
      facts.push(fact);
    } catch {
      warnings.push('DOCUMENT_FACTS_UNSUPPORTED:' + doc.id);
    }
  }
  if (
    agreementBindings.length &&
    facts.some(
      (f) =>
        f.kind === 'invoice' &&
        !agreementBindings.some((b) => b.invoiceDocumentId === f.documentId),
    )
  ) {
    warnings.push('UNBOUND_INVOICES_REQUIRE_EXPLICIT_AGREEMENT_SELECTION');
  }
  for (const binding of agreementBindings.filter(
    (b, i, all) =>
      all.findIndex((v) => v.agreementVersionId === b.agreementVersionId) === i,
  )) {
    const agreement = binding.agreement;
    sources.push({
      documentId: agreement.sourceDocumentId,
      sourceFingerprint: hash(agreement),
      factRevisionId: null,
      sha256: agreement.sourceSha256,
      extractionRunId: agreement.sourceExtractionRunId,
      extractionVersion: null,
      correctionRevision: agreement.sourceCorrectionRevision,
      metadataVersion: agreement.sourceMetadataVersion,
    });
  }
  const fingerprint = hash({
    ...(agreementBindings.length ? { agreementBindings } : {}),
    operationReference: op.reference,
    revision: op.revision,
    parserVersion: ANALYSIS_PARSER_VERSION,
    ruleVersion: LOGISTICS_RULE_VERSION,
    sources,
  });
  return {
    op,
    links,
    facts,
    warnings,
    fingerprint,
    agreementBindings,
    snapshot: analysisSnapshotSchema.parse({
      organizationId,
      operationReference: op.reference,
      documents: facts,
      ...(agreementBindings.length ? { operationId, agreementBindings } : {}),
    }),
    sources,
  };
}
function runDto(
  run: Awaited<ReturnType<PrismaClient['analysisRun']['findFirstOrThrow']>>,
  fingerprint: string,
) {
  return analysisRunSchema.parse({
    ...run,
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    stale: run.fingerprint !== fingerprint,
  });
}
export function createAnalysisService({ prisma }: { prisma: PrismaClient }) {
  async function detail(
    organizationId: string,
    operationId: string,
    actorId: string,
  ) {
    return prisma.$transaction(
      async (tx) => {
        const member = await authorizeDocuments(tx, organizationId, actorId);
        const data = await collectAnalysisInputs(
          tx,
          organizationId,
          operationId,
        );
        const runs = await tx.analysisRun.findMany({
          where: { organizationId, operationId },
          orderBy: { version: 'desc' },
          take: 5,
        });
        const factRevisions = await tx.analysisFactRevision.findMany({
          where: { organizationId, operationId },
          orderBy: { ordinal: 'desc' },
          take: 100,
        });
        return operationDetailSchema.parse({
          ...data.op,
          createdAt: data.op.createdAt.toISOString(),
          updatedAt: data.op.updatedAt.toISOString(),
          documentIds: data.links.map((l) => l.documentId),
          facts: data.facts,
          agreementBindings: data.agreementBindings,
          factRevisions: factRevisions.map((r) => ({
            id: r.id,
            documentId: r.documentId,
            actorId: r.actorId,
            reason: r.reason,
            ordinal: r.ordinal,
            createdAt: r.createdAt.toISOString(),
          })),
          fingerprint: data.fingerprint,
          warnings: data.warnings,
          analyses: runs.map((r) => runDto(r, data.fingerprint)),
          capabilities: { canWrite: member.role !== 'viewer' },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  return {
    detail,
    async history(
      organizationId: string,
      operationId: string,
      actorId: string,
      limit = 25,
      offset = 0,
    ) {
      return prisma.$transaction(
        async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId);
          const current = await collectAnalysisInputs(
            tx,
            organizationId,
            operationId,
          );
          const rows = await tx.analysisRun.findMany({
            where: { organizationId, operationId },
            orderBy: { version: 'desc' },
            take: limit,
            skip: offset,
            select: {
              id: true,
              operationId: true,
              organizationId: true,
              version: true,
              status: true,
              errorCode: true,
              fingerprint: true,
              parserVersion: true,
              ruleVersion: true,
              createdAt: true,
              completedAt: true,
            },
          });
          const total = await tx.analysisRun.count({
            where: { organizationId, operationId },
          });
          return analysisHistorySchema.parse({
            items: rows.map((r) => ({
              ...r,
              stale: r.fingerprint !== current.fingerprint,
              createdAt: r.createdAt.toISOString(),
              completedAt: r.completedAt?.toISOString() ?? null,
            })),
            total,
            limit,
            offset,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async list(
      organizationId: string,
      actorId: string,
      limit = 50,
      offset = 0,
      options: unknown = {},
    ) {
      const query = operationListQuerySchema.parse(options);
      const literal = query.q.replace(/[\\%_]/g, '\\$&');
      return prisma.$transaction(
        async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId);
          const where: Prisma.OperationWhereInput = {
            organizationId,
            ...(query.q
              ? {
                  OR: [
                    { name: { contains: literal, mode: 'insensitive' } },
                    { reference: { contains: literal, mode: 'insensitive' } },
                  ],
                }
              : {}),
          };
          const items = await tx.operation.findMany({
            where,
            orderBy: [{ [query.sort]: query.direction }, { id: 'asc' }],
            take: limit,
            skip: offset,
          });
          const total = await tx.operation.count({ where });
          return operationListSchema.parse({
            items: items.map((i) => ({
              ...i,
              createdAt: i.createdAt.toISOString(),
              updatedAt: i.updatedAt.toISOString(),
            })),
            total,
            limit,
            offset,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async create(organizationId: string, actorId: string, input: unknown) {
      const data = operationCreateSchema.parse(input);
      const op = await prisma.$transaction(async (tx) => {
        await authorizeDocuments(tx, organizationId, actorId, true);
        if ((await tx.operation.count({ where: { organizationId } })) >= 1000)
          throw new DocumentError(409, 'OPERATION_LIMIT');
        try {
          return await tx.operation.create({
            data: { organizationId, ...data },
          });
        } catch (error) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          )
            throw new DocumentError(409, 'REFERENCE_EXISTS');
          throw error;
        }
      });
      return detail(organizationId, op.id, actorId);
    },
    async update(
      organizationId: string,
      operationId: string,
      actorId: string,
      input: unknown,
    ) {
      const data = operationUpdateSchema.parse(input);
      try {
        await prisma.$transaction(
          async (tx) => {
            await authorizeDocuments(tx, organizationId, actorId, true);
            await operation(tx, organizationId, operationId);
            await tx.$queryRaw`SELECT id FROM operations WHERE id = ${operationId}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
            const current = await collectAnalysisInputs(
              tx,
              organizationId,
              operationId,
            );
            if (current.fingerprint !== data.expectedFingerprint)
              throw new DocumentError(409, 'STALE_OPERATION');
            if (
              current.op.name === data.name &&
              current.op.reference === data.reference
            )
              return;
            if (
              await tx.analysisRun.count({
                where: {
                  organizationId,
                  operationId,
                  status: { in: ['queued', 'processing'] },
                },
              })
            )
              throw new DocumentError(409, 'ANALYSIS_ACTIVE');
            const changed = await tx.operation.update({
              where: { id: operationId },
              data: {
                name: data.name,
                reference: data.reference,
                revision: { increment: 1 },
              },
            });
            await tx.identityAuditEvent.create({
              data: {
                organizationId,
                actorId,
                action: 'operation.updated',
                outcome: 'success',
                details: {
                  operationId,
                  revision: changed.revision,
                  before: {
                    name: current.op.name,
                    reference: current.op.reference,
                  },
                  after: { name: changed.name, reference: changed.reference },
                },
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          throw new DocumentError(409, 'REFERENCE_EXISTS');
        throw error;
      }
      return detail(organizationId, operationId, actorId);
    },
    async link(
      organizationId: string,
      operationId: string,
      actorId: string,
      input: unknown,
    ) {
      const { documentIds, expectedFingerprint } =
        operationDocumentsSchema.parse(input);
      await prisma.$transaction(
        async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId, true);
          await operation(tx, organizationId, operationId);
          await tx.$queryRaw`SELECT id FROM operations WHERE id = ${operationId}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
          const current = await collectAnalysisInputs(
            tx,
            organizationId,
            operationId,
          );
          if (current.fingerprint !== expectedFingerprint)
            throw new DocumentError(409, 'STALE_OPERATION');
          const count = await tx.document.count({
            where: { organizationId, id: { in: documentIds } },
          });
          if (count !== documentIds.length)
            throw new DocumentError(404, 'NOT_FOUND');
          const before = current.links.map((l) => l.documentId).sort(),
            after = [...documentIds].sort();
          if (JSON.stringify(before) === JSON.stringify(after)) return;
          if (
            await tx.analysisRun.count({
              where: {
                organizationId,
                operationId,
                status: { in: ['queued', 'processing'] },
              },
            })
          )
            throw new DocumentError(409, 'ANALYSIS_ACTIVE');
          const changed = await tx.operation.update({
            where: { id: operationId },
            data: { revision: { increment: 1 } },
          });
          await tx.operationAgreementBinding.deleteMany({
            where: {
              organizationId,
              operationId,
              invoiceDocumentId: { notIn: documentIds },
            },
          });
          await tx.operationDocument.deleteMany({
            where: {
              organizationId,
              operationId,
              documentId: { notIn: documentIds },
            },
          });
          await tx.operationDocument.createMany({
            data: documentIds
              .filter((id) => !before.includes(id))
              .map((documentId) => ({
                organizationId,
                operationId,
                documentId,
              })),
          });
          await tx.identityAuditEvent.create({
            data: {
              organizationId,
              actorId,
              action: 'operation.documents.updated',
              outcome: 'success',
              details: {
                operationId,
                revision: changed.revision,
                before: { documentIds: before },
                after: { documentIds: after },
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return detail(organizationId, operationId, actorId);
    },
    async revise(
      organizationId: string,
      operationId: string,
      actorId: string,
      input: unknown,
    ) {
      const data = factRevisionInputSchema.parse(input);
      boundedJson(data.document, 'DOCUMENT_FACTS_LIMIT', 16 * 1024);
      await prisma.$transaction(
        async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId, true);
          await operation(tx, organizationId, operationId);
          await tx.operation.update({
            where: { id: operationId },
            data: { revision: { increment: 0 } },
          });
          const current = await collectAnalysisInputs(
            tx,
            organizationId,
            operationId,
          );
          if (current.fingerprint !== data.expectedFingerprint)
            throw new DocumentError(409, 'STALE_FACTS');
          const source = current.sources.find(
            (s) => s.documentId === data.document.documentId,
          );
          const original = current.facts.find(
            (f) => f.documentId === data.document.documentId,
          );
          if (
            !source ||
            !original ||
            original.extractionRunId !== data.document.extractionRunId ||
            original.kind !== data.document.kind
          )
            throw new DocumentError(400, 'INVALID_FACT_SOURCE');
          const doc = current.links.find(
            (l) => l.documentId === data.document.documentId,
          )?.document;
          const pages = extractionResultSchema.parse(
            doc?.currentRun?.result,
          ).pages;
          const evidence = [
            ...data.document.evidence,
            ...data.document.lines.flatMap((l) => l.evidence),
            ...data.document.excludedServices.flatMap((s) => s.evidence),
          ];
          if (
            evidence.some(
              (e) =>
                e.documentId !== original.documentId ||
                e.extractionRunId !== original.extractionRunId ||
                !pages.some(
                  (p) => p.page === e.page && p.text.includes(e.snippet),
                ),
            )
          )
            throw new DocumentError(400, 'INVALID_EVIDENCE');
          if (
            (await tx.analysisFactRevision.count({
              where: { organizationId, operationId },
            })) >= 1000
          )
            throw new DocumentError(409, 'FACT_REVISION_LIMIT');
          const id = randomUUID();
          const mark = (e: (typeof evidence)[number]) => ({
            ...e,
            revisionId: id,
          });
          const facts = {
            ...data.document,
            revisionId: id,
            evidence: data.document.evidence.map(mark),
            lines: data.document.lines.map((l) => ({
              ...l,
              evidence: l.evidence.map(mark),
            })),
            excludedServices: data.document.excludedServices.map((s) => ({
              ...s,
              evidence: s.evidence.map(mark),
            })),
            warnings: [
              ...new Set([...data.document.warnings, 'HUMAN_REVIEWED_FACTS']),
            ],
          };
          const reserved = await tx.operation.update({
            where: { id: operationId },
            data: { revision: { increment: 1 } },
          });
          await tx.analysisFactRevision.create({
            data: {
              id,
              organizationId,
              operationId,
              documentId: original.documentId,
              sourceFingerprint: source.sourceFingerprint,
              ordinal: reserved.revision,
              facts,
              actorId,
              reason: data.reason,
            },
          });
          await tx.identityAuditEvent.create({
            data: {
              organizationId,
              actorId,
              action: 'analysis.facts.revised',
              outcome: 'success',
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return detail(organizationId, operationId, actorId);
    },
    async request(
      organizationId: string,
      operationId: string,
      actorId: string,
      idempotencyKey: string,
    ) {
      const id = await prisma.$transaction(
        async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId, true);
          await operation(tx, organizationId, operationId);
          await tx.operation.update({
            where: { id: operationId },
            data: { revision: { increment: 0 } },
          });
          const existing = await tx.analysisRun.findUnique({
            where: {
              organizationId_operationId_idempotencyKey: {
                organizationId,
                operationId,
                idempotencyKey,
              },
            },
          });
          if (existing) return existing.id;
          const current = await collectAnalysisInputs(
            tx,
            organizationId,
            operationId,
          );
          if (
            (await tx.analysisRun.count({
              where: { organizationId, operationId },
            })) >= 1000
          )
            throw new DocumentError(409, 'ANALYSIS_LIMIT');
          boundedJson(current.snapshot, 'ANALYSIS_INPUT_LIMIT');
          const updated = await tx.operation.update({
            where: { id: operationId },
            data: { runCount: { increment: 1 } },
          });
          const run = await tx.analysisRun.create({
            data: {
              organizationId,
              operationId,
              actorId,
              idempotencyKey,
              version: updated.runCount,
              fingerprint: current.fingerprint,
              parserVersion: ANALYSIS_PARSER_VERSION,
              ruleVersion: LOGISTICS_RULE_VERSION,
              snapshot: current.snapshot,
              sources: current.sources,
              inputWarnings: current.warnings,
            },
          });
          await tx.analysisOutbox.create({
            data: { organizationId, operationId, runId: run.id, actorId },
          });
          await tx.identityAuditEvent.create({
            data: {
              organizationId,
              actorId,
              action: 'analysis.requested',
              outcome: 'success',
            },
          });
          return run.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return this.run(organizationId, operationId, id, actorId);
    },
    async run(
      organizationId: string,
      operationId: string,
      runId: string,
      actorId: string,
    ) {
      return prisma.$transaction(
        async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId);
          const current = await collectAnalysisInputs(
            tx,
            organizationId,
            operationId,
          );
          const run = await tx.analysisRun.findFirst({
            where: { id: runId, organizationId, operationId },
          });
          if (!run) throw new DocumentError(404, 'NOT_FOUND');
          return runDto(run, current.fingerprint);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
  };
}
export async function processAnalysisRun({
  prisma,
  payload,
}: {
  prisma: PrismaClient;
  payload: unknown;
}) {
  const job = analysisJobSchema.parse(payload);
  const outbox = await prisma.analysisOutbox.findUnique({
    where: { id: job.outboxId },
  });
  if (
    !outbox ||
    outbox.organizationId !== job.organizationId ||
    outbox.operationId !== job.operationId ||
    outbox.runId !== job.runId ||
    outbox.actorId !== job.actorId
  )
    throw new DocumentError(400, 'INVALID_JOB');
  if (outbox.completedAt) return;
  const leaseToken = randomUUID();
  const claimed = await prisma.analysisRun.updateMany({
    where: {
      id: job.runId,
      organizationId: job.organizationId,
      operationId: job.operationId,
      OR: [
        { status: 'queued' },
        { status: 'processing', leaseUntil: { lt: new Date() } },
      ],
    },
    data: {
      status: 'processing',
      attempts: { increment: 1 },
      leaseToken,
      leaseUntil: new Date(Date.now() + 45000),
    },
  });
  if (claimed.count !== 1) return;
  const run = await prisma.analysisRun.findUniqueOrThrow({
    where: { id: job.runId },
  });
  let result: ReturnType<typeof evaluateLogistics> | undefined;
  let status = 'completed';
  let errorCode: string | null = null;
  try {
    await authorizeDocuments(prisma, job.organizationId, job.actorId, true);
    if (run.attempts > 3)
      throw new DocumentError(422, 'ANALYSIS_RETRIES_EXHAUSTED');
    if (
      run.ruleVersion !== LOGISTICS_RULE_VERSION ||
      run.parserVersion !== ANALYSIS_PARSER_VERSION
    )
      throw new DocumentError(422, 'RULE_VERSION_UNAVAILABLE');
    result = analysisResultSchema.parse(
      evaluateLogistics(analysisSnapshotSchema.parse(run.snapshot)),
    );
    boundedJson(result, 'ANALYSIS_RESULT_LIMIT');
  } catch (error) {
    result = undefined;
    status =
      (error instanceof DocumentError && error.code === 'NOT_FOUND') ||
      (error instanceof DocumentError && error.code === 'FORBIDDEN')
        ? 'blocked'
        : 'failed';
    errorCode =
      status === 'blocked'
        ? 'ACCESS_REVOKED'
        : error instanceof DocumentError
          ? error.code
          : 'ANALYSIS_FAILED';
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
    const changed = await tx.analysisRun.updateMany({
      where: {
        id: run.id,
        organizationId: job.organizationId,
        leaseToken,
        status: 'processing',
        leaseUntil: { gt: new Date() },
      },
      data: {
        status,
        errorCode,
        ...(result ? { result } : {}),
        completedAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
      },
    });
    if (changed.count !== 1) return;
    await tx.analysisOutbox.update({
      where: { id: job.outboxId },
      data: { completedAt: new Date() },
    });
    await tx.identityAuditEvent.create({
      data: {
        organizationId: job.organizationId,
        actorId: job.actorId,
        action: 'analysis.completed',
        outcome: status === 'completed' ? 'success' : 'denied',
      },
    });
  });
}

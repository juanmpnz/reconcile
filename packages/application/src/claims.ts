import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@reconcile/database';
import { collectAnalysisInputs } from './analysis.js';
import { authorizeDocuments, DocumentError } from './documents.js';
import {
  analysisResultSchema,
  analysisRunSchema,
  extractionResultSchema,
  analysisSnapshotSchema,
  findingDecisionInputSchema,
  claimCreateInputSchema,
  claimDraftInputSchema,
  claimEventInputSchema,
  claimExportInputSchema,
  claimRebaseInputSchema,
  findingDecisionSchema,
  claimDetailSchema,
  claimSummarySchema,
  operationReviewSchema,
} from '@reconcile/contracts';
type Tx = Prisma.TransactionClient;
const date = (value: Date) => value.toISOString();
const decisionDto = (row: {
  id: string;
  runId: string;
  findingIndex: number;
  action: string;
  reason: string;
  actorId: string;
  ordinal: number;
  createdAt: Date;
}) => findingDecisionSchema.parse({ ...row, createdAt: date(row.createdAt) });
const positive = (value: string | null) =>
  value !== null && /^\d+(?:\.\d+)?$/.test(value) && /[1-9]/.test(value);
const clarificationCodes = new Set([
  'AGREEMENT_MISSING',
  'AGREEMENT_AMBIGUOUS',
  'CURRENCY_UNVERIFIABLE',
  'SERVICE_SCOPE_UNVERIFIABLE',
  'SERVICE_NOT_VERIFIABLE',
  'SERVICE_EVIDENCE_MISSING',
  'PRICE_UNVERIFIABLE',
  'QUANTITY_UNVERIFIABLE',
  'UNKNOWN_SERVICE',
  'LINES_MISSING',
  'LINE_INCOMPLETE',
  'SERVICE_NOT_AGREED',
  'UNIT_MISMATCH',
  'PERFORMANCE_UNVERIFIABLE',
]);
const correctionCodes = new Set([
  'EXCLUDED_SERVICE',
  'EXCLUDED_SERVICE_OTHER_PROVIDER',
  'PRICE_OR_QUANTITY_DIFFERENCE',
]);
async function lock(tx: Tx, org: string, op: string, actor: string) {
  await authorizeDocuments(tx, org, actor, true);
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM operations WHERE id=${op}::uuid AND "organizationId"=${org}::uuid FOR UPDATE`;
  if (rows.length !== 1) throw new DocumentError(404, 'NOT_FOUND');
  return collectAnalysisInputs(tx, org, op);
}
async function sourceFor(
  tx: Tx,
  org: string,
  op: string,
  runId: string,
  index: number,
  fingerprint: string,
) {
  const run = await tx.analysisRun.findFirst({
    where: { id: runId, organizationId: org, operationId: op },
  });
  if (!run) throw new DocumentError(404, 'NOT_FOUND');
  if (run.status !== 'completed' || run.fingerprint !== fingerprint)
    throw new DocumentError(409, 'STALE_ANALYSIS');
  const result = analysisResultSchema.parse(run.result),
    snapshot = analysisSnapshotSchema.parse(run.snapshot);
  const finding = result.findings[index];
  if (!finding) throw new DocumentError(400, 'FINDING_NOT_FOUND');
  const doc = snapshot.documents.find(
    (d) => d.documentId === finding.documentId,
  );
  if (!doc || doc.kind !== 'invoice')
    throw new DocumentError(422, 'INVOICE_SOURCE_REQUIRED');
  const decision = await tx.findingDecision.findFirst({
    where: { organizationId: org, operationId: op, runId, findingIndex: index },
    orderBy: { ordinal: 'desc' },
  });
  if (!decision || decision.action !== 'confirm')
    throw new DocumentError(409, 'CONFIRMED_REVIEW_REQUIRED');
  let kind: 'correction' | 'clarification';
  let amount: string | null = null;
  if (
    finding.status === 'confirmed' &&
    correctionCodes.has(finding.code) &&
    positive(finding.difference) &&
    finding.currency &&
    doc.provider
  ) {
    kind = 'correction';
    amount = finding.difference;
  } else if (
    ['probable', 'not-verifiable'].includes(finding.status) &&
    clarificationCodes.has(finding.code)
  ) {
    kind = 'clarification';
  } else throw new DocumentError(422, 'FINDING_NOT_CLAIMABLE');
  const documents = await tx.document.findMany({
    where: {
      organizationId: org,
      id: {
        in: [
          ...new Set([
            doc.documentId,
            ...finding.evidence.map((e) => e.documentId),
          ]),
        ],
      },
    },
    select: { id: true, filename: true, sha256: true },
  });
  const sourceMetadata = analysisRunSchema.shape.sources.parse(run.sources);
  const documentMetadata = [];
  for (const document of documents) {
    const normalized = snapshot.documents.find(
      (d) => d.documentId === document.id,
    );
    const provenance = sourceMetadata.find((s) => s.documentId === document.id);
    let invoiceReference: string | null = null;
    if (normalized) {
      const extraction = await tx.extractionRun.findFirst({
        where: {
          organizationId: org,
          documentId: document.id,
          id: normalized.extractionRunId,
        },
      });
      const result = extractionResultSchema.safeParse(extraction?.result);
      invoiceReference = result.success
        ? (result.data.fields.find((f) => f.name === 'documentNumber')?.value ??
          null)
        : null;
      const correction = await tx.documentCorrection.findFirst({
        where: {
          organizationId: org,
          documentId: document.id,
          extractionRunId: normalized.extractionRunId,
          field: 'documentNumber',
          revision: { lte: provenance?.correctionRevision ?? 0 },
        },
        orderBy: { revision: 'desc' },
      });
      if (correction) invoiceReference = correction.value;
    }
    documentMetadata.push({ ...document, invoiceReference });
  }
  return {
    documentId: doc.documentId,
    provider: doc.provider ?? 'Proveedor por confirmar',
    currency: finding.currency,
    kind,
    amount,
    data: {
      runId,
      findingIndex: index,
      fingerprint,
      finding,
      snapshot,
      decision: decisionDto(decision),
      sources: run.sources,
      ruleVersion: run.ruleVersion,
      parserVersion: run.parserVersion,
      runVersion: run.version,
      inputWarnings: run.inputWarnings,
      documents: documentMetadata,
    },
  };
}
function initialDraft(source: Awaited<ReturnType<typeof sourceFor>>) {
  const { finding, snapshot } = source.data;
  return {
    subject:
      `${source.kind === 'correction' ? 'Solicitud de revisión' : 'Solicitud de aclaración'} — ${snapshot.operationReference}`.slice(
        0,
        200,
      ),
    body: `Operación: ${snapshot.operationReference}\nProveedor: ${source.provider}\nFactura/documento: ${source.data.documents.find((d) => d.id === source.documentId)?.invoiceReference ?? source.data.documents.find((d) => d.id === source.documentId)?.filename ?? 'Referencia pendiente'}\nConcepto: ${finding.service}\n\n${source.kind === 'correction' ? `Solicitamos revisar y, si corresponde, corregir o abonar ${source.amount} ${source.currency}.` : 'Solicitamos aclaración y documentación de respaldo; no se determina un importe reclamable.'}\n\nMotivo observado: ${finding.explanation}\n\nRespaldo: ${source.data.documents.map((d) => d.filename).join(', ')}. Las páginas y fragmentos completos se incluyen en el dossier JSON.\nNo acredita aprobación contable ni recuperación de fondos.`,
  };
}
async function audit(
  tx: Tx,
  org: string,
  op: string,
  actor: string,
  action: string,
  details: Prisma.InputJsonObject,
) {
  await tx.identityAuditEvent.create({
    data: {
      organizationId: org,
      actorId: actor,
      action,
      outcome: 'success',
      details: { operationId: op, ...details },
    },
  });
}
export function createClaimService({ prisma }: { prisma: PrismaClient }) {
  async function readClaim(tx: Tx, org: string, op: string, id: string) {
    const claim = await tx.claim.findFirst({
      where: { id, organizationId: org, operationId: op },
      include: {
        sources: { orderBy: { version: 'desc' }, take: 10 },
        drafts: { orderBy: { version: 'desc' }, take: 100 },
        events: { orderBy: { version: 'desc' }, take: 100 },
      },
    });
    if (!claim) throw new DocumentError(404, 'NOT_FOUND');
    return claim;
  }
  type ClaimRow = Awaited<ReturnType<typeof readClaim>>;
  function currentSource(c: ClaimRow) {
    const source = c.sources.find((s) => s.version === c.sourceVersion);
    if (!source) throw new DocumentError(503, 'CLAIM_SOURCE_UNAVAILABLE');
    const parsed = claimDetailSchema.shape.sources.element.shape.data.parse(
      source.data,
    );
    return parsed;
  }
  function summary(
    c: ClaimRow,
    fingerprint: string,
    latest: { id: string; action: string } | null,
  ) {
    return claimSummarySchema.parse({
      ...c,
      amount: c.amount?.toFixed() ?? null,
      stale:
        currentSource(c).fingerprint !== fingerprint ||
        latest?.id !== currentSource(c).decision.id ||
        latest?.action !== 'confirm',
      createdAt: date(c.createdAt),
      updatedAt: date(c.updatedAt),
    });
  }
  async function detail(org: string, op: string, id: string, actor: string) {
    return prisma.$transaction(
      async (tx) => {
        const member = await authorizeDocuments(tx, org, actor);
        const current = await collectAnalysisInputs(tx, org, op);
        const c = await readClaim(tx, org, op, id);
        const source = currentSource(c);
        const latest = await tx.findingDecision.findFirst({
          where: {
            organizationId: org,
            operationId: op,
            runId: c.runId,
            findingIndex: c.findingIndex,
          },
          orderBy: { ordinal: 'desc' },
          select: { id: true, action: true },
        });
        return claimDetailSchema.parse({
          ...summary(c, current.fingerprint, latest),
          finding: source.finding,
          snapshot: source.snapshot,
          sourceFingerprint: source.fingerprint,
          decision: source.decision,
          drafts: c.drafts.map((d) => ({ ...d, createdAt: date(d.createdAt) })),
          events: c.events.map((e) => ({
            ...e,
            occurredAt: date(e.occurredAt),
            createdAt: date(e.createdAt),
          })),
          sources: c.sources.map((s) => ({
            ...s,
            createdAt: date(s.createdAt),
          })),
          exports: (
            await tx.claimExport.findMany({
              where: { organizationId: org, operationId: op, claimId: id },
              orderBy: { version: 'desc' },
              take: 100,
              select: {
                id: true,
                version: true,
                format: true,
                sha256: true,
                actorId: true,
                createdAt: true,
              },
            })
          ).map((e) => ({ ...e, createdAt: date(e.createdAt) })),
          capabilities: { canWrite: member.role !== 'viewer' },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async function mutable(
    tx: Tx,
    org: string,
    op: string,
    id: string,
    actor: string,
    expectedVersion: number,
  ) {
    const current = await lock(tx, org, op, actor);
    await tx.$queryRaw`SELECT id FROM claims WHERE id=${id}::uuid AND "organizationId"=${org}::uuid AND "operationId"=${op}::uuid FOR UPDATE`;
    const c = await readClaim(tx, org, op, id);
    if (c.version !== expectedVersion)
      throw new DocumentError(409, 'STALE_CLAIM');
    if (c.version >= 100) throw new DocumentError(409, 'CLAIM_VERSION_LIMIT');
    return { current, c };
  }
  async function assertCurrent(
    tx: Tx,
    org: string,
    op: string,
    c: ClaimRow,
    fingerprint: string,
  ) {
    const src = currentSource(c);
    await sourceFor(tx, org, op, c.runId, c.findingIndex, fingerprint);
    const latest = await tx.findingDecision.findFirst({
      where: {
        organizationId: org,
        operationId: op,
        runId: c.runId,
        findingIndex: c.findingIndex,
      },
      orderBy: { ordinal: 'desc' },
    });
    if (latest?.id !== src.decision.id)
      throw new DocumentError(409, 'REVIEW_CHANGED');
    return src;
  }
  return {
    detail,
    async downloadExport(
      org: string,
      op: string,
      id: string,
      exportId: string,
      actor: string,
    ) {
      await authorizeDocuments(prisma, org, actor);
      const file = await prisma.claimExport.findFirst({
        where: {
          id: exportId,
          organizationId: org,
          operationId: op,
          claimId: id,
        },
      });
      if (!file) throw new DocumentError(404, 'NOT_FOUND');
      await authorizeDocuments(prisma, org, actor);
      if (createHash('sha256').update(file.bytes).digest('hex') !== file.sha256)
        throw new DocumentError(503, 'EXPORT_INTEGRITY_ERROR');
      return {
        bytes: Buffer.from(file.bytes),
        filename: `reclamo-${id}-v${file.version}.${file.format === 'text' ? 'txt' : 'json'}`,
        contentType:
          file.format === 'text'
            ? 'text/plain; charset=utf-8'
            : 'application/json; charset=utf-8',
      };
    },
    async review(org: string, op: string, actor: string) {
      return prisma.$transaction(
        async (tx) => {
          const member = await authorizeDocuments(tx, org, actor);
          const current = await collectAnalysisInputs(tx, org, op);
          const decisions = await tx.findingDecision.findMany({
            where: { organizationId: org, operationId: op },
            orderBy: { ordinal: 'desc' },
            take: 1000,
          });
          const rows = await tx.claim.findMany({
            where: { organizationId: org, operationId: op },
            orderBy: { createdAt: 'desc' },
            take: 100,
          });
          const fingerprints = await tx.$queryRaw<
            {
              id: string;
              fingerprint: string;
              sourceDecisionId: string;
              latestDecisionId: string | null;
              latestAction: string | null;
            }[]
          >`SELECT c.id, s.data->>'fingerprint' AS fingerprint, s.data->'decision'->>'id' AS "sourceDecisionId", latest.id::text AS "latestDecisionId", latest.action AS "latestAction" FROM claims c JOIN claim_sources s ON s."claimId"=c.id AND s.version=c."sourceVersion" LEFT JOIN LATERAL (SELECT d.id,d.action FROM finding_decisions d WHERE d."organizationId"=c."organizationId" AND d."operationId"=c."operationId" AND d."runId"=c."runId" AND d."findingIndex"=c."findingIndex" ORDER BY d.ordinal DESC LIMIT 1) latest ON true WHERE c."organizationId"=${org}::uuid AND c."operationId"=${op}::uuid`;
          const claims = rows.map((c) =>
            claimSummarySchema.parse({
              ...c,
              amount: c.amount?.toFixed() ?? null,
              stale:
                fingerprints.find((s) => s.id === c.id)?.fingerprint !==
                  current.fingerprint ||
                fingerprints.find((s) => s.id === c.id)?.latestDecisionId !==
                  fingerprints.find((s) => s.id === c.id)?.sourceDecisionId ||
                fingerprints.find((s) => s.id === c.id)?.latestAction !==
                  'confirm',
              createdAt: date(c.createdAt),
              updatedAt: date(c.updatedAt),
            }),
          );
          return operationReviewSchema.parse({
            organizationId: org,
            operationId: op,
            version: current.op.reviewVersion,
            fingerprint: current.fingerprint,
            decisions: decisions.map(decisionDto),
            claims,
            capabilities: { canWrite: member.role !== 'viewer' },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async decide(
      org: string,
      op: string,
      runId: string,
      actor: string,
      input: unknown,
    ) {
      const data = findingDecisionInputSchema.parse(input);
      await prisma.$transaction(
        async (tx) => {
          const current = await lock(tx, org, op, actor);
          if (
            current.op.reviewVersion !== data.expectedVersion ||
            current.fingerprint !== data.expectedFingerprint
          )
            throw new DocumentError(409, 'STALE_REVIEW');
          const run = await tx.analysisRun.findFirst({
            where: { id: runId, organizationId: org, operationId: op },
          });
          if (!run) throw new DocumentError(404, 'NOT_FOUND');
          if (
            run.status !== 'completed' ||
            run.fingerprint !== current.fingerprint
          )
            throw new DocumentError(409, 'STALE_ANALYSIS');
          const finding = analysisResultSchema.parse(run.result).findings[
            data.findingIndex
          ];
          if (!finding) throw new DocumentError(400, 'FINDING_NOT_FOUND');
          const source = analysisSnapshotSchema
            .parse(run.snapshot)
            .documents.find(
              (document) => document.documentId === finding.documentId,
            );
          if (!source || source.kind !== 'invoice')
            throw new DocumentError(422, 'INVOICE_SOURCE_REQUIRED');
          if (current.op.reviewVersion >= 1000)
            throw new DocumentError(409, 'REVIEW_LIMIT');
          const updated = await tx.operation.update({
            where: { id: op },
            data: { reviewVersion: { increment: 1 } },
          });
          await tx.findingDecision.create({
            data: {
              organizationId: org,
              operationId: op,
              runId,
              findingIndex: data.findingIndex,
              action: data.action,
              reason: data.reason,
              actorId: actor,
              ordinal: updated.reviewVersion,
            },
          });
          await audit(tx, org, op, actor, 'finding.reviewed', {
            runId,
            findingIndex: data.findingIndex,
            action: data.action,
            ordinal: updated.reviewVersion,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return this.review(org, op, actor);
    },
    async create(org: string, op: string, actor: string, input: unknown) {
      const data = claimCreateInputSchema.parse(input);
      const id = await prisma.$transaction(
        async (tx) => {
          const current = await lock(tx, org, op, actor);
          if (
            current.op.reviewVersion !== data.expectedVersion ||
            current.fingerprint !== data.expectedFingerprint
          )
            throw new DocumentError(409, 'STALE_REVIEW');
          const src = await sourceFor(
            tx,
            org,
            op,
            data.runId,
            data.findingIndex,
            current.fingerprint,
          );
          const existing = await tx.claim.findUnique({
            where: {
              organizationId_operationId_documentId: {
                organizationId: org,
                operationId: op,
                documentId: src.documentId,
              },
            },
          });
          if (existing) return existing.id;
          if (
            (await tx.claim.count({
              where: { organizationId: org, operationId: op },
            })) >= 100
          )
            throw new DocumentError(409, 'CLAIM_LIMIT');
          const claim = await tx.claim.create({
            data: {
              organizationId: org,
              operationId: op,
              documentId: src.documentId,
              runId: data.runId,
              findingIndex: data.findingIndex,
              kind: src.kind,
              provider: src.provider,
              amount: src.amount,
              currency: src.currency,
            },
          });
          await tx.claimSource.create({
            data: {
              organizationId: org,
              operationId: op,
              claimId: claim.id,
              version: 1,
              data: src.data,
              actorId: actor,
              reason: 'Fuente inicial revisada',
            },
          });
          await tx.claimDraft.create({
            data: {
              organizationId: org,
              operationId: op,
              claimId: claim.id,
              version: 1,
              sourceVersion: 1,
              ...initialDraft(src),
              actorId: actor,
              reason: 'Borrador inicial revisado',
            },
          });
          await tx.operation.update({
            where: { id: op },
            data: { reviewVersion: { increment: 1 } },
          });
          await audit(tx, org, op, actor, 'claim.created', {
            claimId: claim.id,
            runId: data.runId,
            findingIndex: data.findingIndex,
          });
          return claim.id;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return detail(org, op, id, actor);
    },
    async edit(
      org: string,
      op: string,
      id: string,
      actor: string,
      input: unknown,
    ) {
      const data = claimDraftInputSchema.parse(input);
      await prisma.$transaction(
        async (tx) => {
          const { c, current } = await mutable(
            tx,
            org,
            op,
            id,
            actor,
            data.expectedVersion,
          );
          if (!['draft', 'exported'].includes(c.status))
            throw new DocumentError(409, 'CLAIM_ALREADY_SENT');
          await assertCurrent(tx, org, op, c, current.fingerprint);
          await tx.claimDraft.create({
            data: {
              organizationId: org,
              operationId: op,
              claimId: id,
              version: c.version + 1,
              sourceVersion: c.sourceVersion,
              recipientEmail: data.recipientEmail,
              subject: data.subject,
              body: data.body,
              reason: data.reason,
              actorId: actor,
            },
          });
          await tx.claim.update({
            where: { id },
            data: { version: { increment: 1 }, status: 'draft' },
          });
          await audit(tx, org, op, actor, 'claim.draft.updated', {
            claimId: id,
            version: c.version + 1,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return detail(org, op, id, actor);
    },
    async rebase(
      org: string,
      op: string,
      id: string,
      actor: string,
      input: unknown,
    ) {
      const data = claimRebaseInputSchema.parse(input);
      await prisma.$transaction(
        async (tx) => {
          const { c, current } = await mutable(
            tx,
            org,
            op,
            id,
            actor,
            data.expectedVersion,
          );
          if (!['draft', 'exported'].includes(c.status))
            throw new DocumentError(409, 'CLAIM_ALREADY_SENT');
          if (
            current.op.reviewVersion !== data.expectedReviewVersion ||
            current.fingerprint !== data.expectedFingerprint
          )
            throw new DocumentError(409, 'STALE_REVIEW');
          if (c.sourceVersion >= 10)
            throw new DocumentError(409, 'CLAIM_SOURCE_VERSION_LIMIT');
          const src = await sourceFor(
            tx,
            org,
            op,
            data.runId,
            data.findingIndex,
            current.fingerprint,
          );
          if (src.documentId !== c.documentId)
            throw new DocumentError(409, 'CLAIM_DOCUMENT_MISMATCH');
          await tx.claimSource.create({
            data: {
              organizationId: org,
              operationId: op,
              claimId: id,
              version: c.sourceVersion + 1,
              data: src.data,
              actorId: actor,
              reason: data.reason,
            },
          });
          await tx.claimDraft.create({
            data: {
              organizationId: org,
              operationId: op,
              claimId: id,
              version: c.version + 1,
              sourceVersion: c.sourceVersion + 1,
              ...initialDraft(src),
              actorId: actor,
              reason: data.reason,
            },
          });
          await tx.claim.update({
            where: { id },
            data: {
              version: { increment: 1 },
              sourceVersion: { increment: 1 },
              runId: data.runId,
              findingIndex: data.findingIndex,
              kind: src.kind,
              provider: src.provider,
              amount: src.amount,
              currency: src.currency,
              status: 'draft',
            },
          });
          await tx.operation.update({
            where: { id: op },
            data: { reviewVersion: { increment: 1 } },
          });
          await audit(tx, org, op, actor, 'claim.rebased', {
            claimId: id,
            runId: data.runId,
            findingIndex: data.findingIndex,
            version: c.version + 1,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return detail(org, op, id, actor);
    },
    async event(
      org: string,
      op: string,
      id: string,
      actor: string,
      input: unknown,
    ) {
      const data = claimEventInputSchema.parse(input);
      await prisma.$transaction(
        async (tx) => {
          const { c, current } = await mutable(
            tx,
            org,
            op,
            id,
            actor,
            data.expectedVersion,
          );
          const at = new Date(data.occurredAt);
          if (at.getTime() > Date.now())
            throw new DocumentError(400, 'FUTURE_EVENT');
          const sent = await tx.claimEvent.findFirst({
            where: { claimId: id, status: 'sent' },
            orderBy: { version: 'asc' },
          });
          const last = await tx.claimEvent.findFirst({
            where: { claimId: id, status: { not: 'exported' } },
            orderBy: { version: 'desc' },
          });
          if (at < c.createdAt || (last && at < last.occurredAt))
            throw new DocumentError(400, 'EVENT_DATE_OUT_OF_ORDER');
          if (['resolved', 'rejected'].includes(c.status))
            throw new DocumentError(409, 'CLAIM_CLOSED');
          if (data.status === 'sent') {
            if (
              !['draft', 'exported'].includes(c.status) ||
              data.recipientConfirmed !== true ||
              !c.drafts[0]?.recipientEmail
            )
              throw new DocumentError(400, 'SENT_CONFIRMATION_REQUIRED');
            await assertCurrent(tx, org, op, c, current.fingerprint);
          } else {
            if (!sent || at < sent.occurredAt)
              throw new DocumentError(400, 'SENT_EVENT_REQUIRED');
          }
          if (data.status === 'follow_up' && !data.dueDate)
            throw new DocumentError(400, 'FOLLOW_UP_DATE_REQUIRED');
          if (['resolved', 'rejected'].includes(data.status) && !data.outcome)
            throw new DocumentError(400, 'RESOLUTION_OUTCOME_REQUIRED');
          if (
            (data.status === 'rejected' && data.outcome !== 'rejected') ||
            (data.status === 'resolved' && data.outcome === 'rejected')
          )
            throw new DocumentError(400, 'RESOLUTION_OUTCOME_MISMATCH');
          await tx.claimEvent.create({
            data: {
              organizationId: org,
              operationId: op,
              claimId: id,
              version: c.version + 1,
              status: data.status,
              reason: data.reason,
              actorId: actor,
              occurredAt: at,
              dueDate: data.dueDate,
              outcome: data.outcome ?? null,
            },
          });
          await tx.claim.update({
            where: { id },
            data: {
              version: { increment: 1 },
              status: data.status,
              dueDate: data.dueDate,
            },
          });
          await audit(tx, org, op, actor, 'claim.followup.recorded', {
            claimId: id,
            version: c.version + 1,
            status: data.status,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      return detail(org, op, id, actor);
    },
    async export(
      org: string,
      op: string,
      id: string,
      actor: string,
      input: unknown,
    ) {
      const data = claimExportInputSchema.parse(input);
      return prisma.$transaction(
        async (tx) => {
          const { c, current } = await mutable(
            tx,
            org,
            op,
            id,
            actor,
            data.expectedVersion,
          );
          if (!['draft', 'exported'].includes(c.status))
            throw new DocumentError(409, 'CLAIM_ALREADY_SENT');
          const src = await assertCurrent(tx, org, op, c, current.fingerprint);
          const draft = c.drafts[0];
          if (!draft) throw new DocumentError(503, 'CLAIM_DRAFT_UNAVAILABLE');
          const exportedAt = new Date();
          const dossier = {
            format: 'reconcile-claim-v1',
            claimId: id,
            claimVersion: c.version + 1,
            draftId: draft.id,
            draftVersion: draft.version,
            sourceVersion: c.sourceVersion,
            recipientEmail: draft.recipientEmail,
            subject: draft.subject,
            body: draft.body,
            source: src,
            exportedBy: actor,
            exportedAt: exportedAt.toISOString(),
            history: {
              drafts: c.drafts.map((d) => ({
                id: d.id,
                version: d.version,
                sourceVersion: d.sourceVersion,
                actorId: d.actorId,
                createdAt: d.createdAt,
                reason: d.reason,
              })),
              events: c.events,
              sourceVersions: c.sources.map((s) => ({
                version: s.version,
                actorId: s.actorId,
                reason: s.reason,
                createdAt: s.createdAt,
              })),
            },
            notice:
              'Exportado; no enviado. No acredita recuperación ni aprobación contable.',
          };
          const text = `Destinatario: ${draft.recipientEmail ?? 'Pendiente de confirmar'}\nAsunto: ${draft.subject}\n\n${draft.body}\n\nExportado; no enviado. Análisis ${src.runId}; fuente versión ${c.sourceVersion}.\n`;
          const bytes = Buffer.from(
            data.format === 'text' ? text : JSON.stringify(dossier, null, 2),
            'utf8',
          );
          if (bytes.length > 512 * 1024)
            throw new DocumentError(422, 'EXPORT_LIMIT');
          const artifact = await tx.claimExport.create({
            data: {
              organizationId: org,
              operationId: op,
              claimId: id,
              version: c.version + 1,
              sourceVersion: c.sourceVersion,
              draftId: draft.id,
              draftVersion: draft.version,
              format: data.format,
              bytes,
              sha256: createHash('sha256').update(bytes).digest('hex'),
              actorId: actor,
              createdAt: exportedAt,
            },
          });
          await tx.claimEvent.create({
            data: {
              organizationId: org,
              operationId: op,
              claimId: id,
              version: c.version + 1,
              status: 'exported',
              reason: 'Exportación manual ' + data.format,
              actorId: actor,
              occurredAt: new Date(),
            },
          });
          await tx.claim.update({
            where: { id },
            data: { version: { increment: 1 }, status: 'exported' },
          });
          await audit(tx, org, op, actor, 'claim.exported', {
            claimId: id,
            version: c.version + 1,
            format: data.format,
            exportId: artifact.id,
            sha256: artifact.sha256,
            draftId: draft.id,
            draftVersion: draft.version,
            sourceVersion: c.sourceVersion,
            exportedAt: exportedAt.toISOString(),
          });
          return {
            bytes,
            filename: `reclamo-${id}.${data.format === 'text' ? 'txt' : 'json'}`,
            contentType:
              data.format === 'text'
                ? 'text/plain; charset=utf-8'
                : 'application/json; charset=utf-8',
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
  };
}

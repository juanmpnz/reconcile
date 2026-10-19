import { Prisma, type PrismaClient } from '@reconcile/database';
import { deriveAnalysisFacts } from '@reconcile/document-processing';
import {
  agreementCreateSchema,
  agreementVersionSchema,
  agreementListSchema,
  agreementListQuerySchema,
  operationAgreementsSchema,
  extractionResultSchema,
  agreementApplicabilitySchema,
  type AgreementTerms,
  type AnalysisDocumentInput,
} from '@reconcile/contracts';
import { authorizeDocuments, DocumentError } from './documents.js';
import { collectAnalysisInputs } from './analysis.js';

export function normalizeAgreementApplicability(
  source: AnalysisDocumentInput['applicability'],
  evidence: AnalysisDocumentInput['evidence'],
  provider: string | null,
  service: string | null,
): NonNullable<AgreementTerms['applicability']> {
  const unknown = { state: 'unknown', value: null, evidence: [] };
  return agreementApplicabilitySchema.parse({
    provider: provider
      ? { state: 'restricted', value: provider, evidence }
      : (source?.provider ?? unknown),
    service:
      service && service !== 'unknown'
        ? { state: 'restricted', value: service, evidence }
        : (source?.service ?? unknown),
    contractingParty: source?.contractingParty ?? unknown,
    origin: source?.origin ?? unknown,
    destination: source?.destination ?? unknown,
    transportMode: source?.transportMode ?? unknown,
    equipmentType: source?.equipmentType ?? unknown,
    dateBasis: source?.dateBasis ?? 'unknown',
    restrictions: source?.restrictions ?? [],
  });
}
export function agreementDto(
  row: Awaited<
    ReturnType<PrismaClient['agreementVersion']['findFirstOrThrow']>
  >,
) {
  return agreementVersionSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
  });
}
export function createAgreementService({ prisma }: { prisma: PrismaClient }) {
  return {
    async list(
      organizationId: string,
      actorId: string,
      limit = 50,
      offset = 0,
      options: unknown = {},
    ) {
      const query = agreementListQuerySchema.parse(options);
      return prisma.$transaction(
        async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId);
          const columns = {
            provider: 'provider',
            title: 'title',
            service: 'service',
            validFrom: 'validFrom',
            validUntil: 'validUntil',
            createdAt: 'createdAt',
          } as const;
          const order = Prisma.raw(
            '"' +
              columns[query.sort] +
              '" ' +
              (query.direction === 'asc' ? 'ASC' : 'DESC') +
              ' NULLS LAST,id ASC',
          );
          const projection = Prisma.sql`WITH projected AS (SELECT id,name AS title,"createdAt",terms->>'provider' AS provider,terms->>'service' AS service,terms->>'validFrom' AS "validFrom",terms->>'validUntil' AS "validUntil" FROM agreement_versions WHERE "organizationId"=${organizationId}::uuid), filtered AS (SELECT * FROM projected WHERE ${query.q}='' OR strpos(lower(concat_ws(' ',title,provider,service)),lower(${query.q}))>0)`;
          const ids = await tx.$queryRaw<{ id: string }[]>(
            Prisma.sql`${projection} SELECT id FROM filtered ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`,
          );
          const counts = await tx.$queryRaw<{ total: bigint }[]>(
            Prisma.sql`${projection} SELECT count(*) AS total FROM filtered`,
          );
          const rows = await tx.agreementVersion.findMany({
            where: { organizationId, id: { in: ids.map((i) => i.id) } },
          });
          const byId = new Map(rows.map((r) => [r.id, r]));
          return agreementListSchema.parse({
            items: ids.map((i) => {
              const row = byId.get(i.id);
              if (!row)
                throw new DocumentError(503, 'AGREEMENT_LIST_UNAVAILABLE');
              return agreementDto(row);
            }),
            total: Number(counts[0]?.total ?? 0),
            limit,
            offset,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async detail(organizationId: string, actorId: string, id: string) {
      await authorizeDocuments(prisma, organizationId, actorId);
      const row = await prisma.agreementVersion.findFirst({
        where: { organizationId, id },
      });
      if (!row) throw new DocumentError(404, 'NOT_FOUND');
      return agreementDto(row);
    },
    async create(organizationId: string, actorId: string, input: unknown) {
      const data = agreementCreateSchema.parse(input);
      return prisma.$transaction(
        async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId, true);
          await tx.$queryRaw`SELECT id FROM organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
          if (
            (await tx.agreementVersion.count({ where: { organizationId } })) >=
            1000
          )
            throw new DocumentError(409, 'AGREEMENT_LIMIT');
          // Serialize with document metadata changes and extraction scheduling.
          await tx.$queryRaw`SELECT id FROM documents WHERE id = ${data.sourceDocumentId}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
          const doc = await tx.document.findFirst({
            where: { organizationId, id: data.sourceDocumentId },
            include: { currentRun: true },
          });
          if (!doc) throw new DocumentError(404, 'NOT_FOUND');
          if (!['tariff', 'quotation'].includes(doc.kind))
            throw new DocumentError(422, 'AGREEMENT_SOURCE_KIND');
          const run = doc.currentRun;
          if (!run || !['ready', 'needs_review'].includes(run.status))
            throw new DocumentError(422, 'AGREEMENT_SOURCE_NOT_EXTRACTED');
          const result = extractionResultSchema.safeParse(run.result);
          if (!result.success)
            throw new DocumentError(422, 'AGREEMENT_SOURCE_NOT_EXTRACTED');
          const pricingEvidence =
            data.terms.pricing.type === 'line-items'
              ? []
              : data.terms.pricing.type === 'distance-bands'
                ? data.terms.pricing.bands.flatMap((b) => b.evidence)
                : data.terms.pricing.evidence;
          const applicability = data.terms.applicability;
          const conditionEvidence = applicability
            ? [
                applicability.provider,
                applicability.contractingParty,
                applicability.origin,
                applicability.destination,
                applicability.service,
                applicability.transportMode,
                applicability.equipmentType,
                ...applicability.restrictions,
              ].flatMap((condition) => condition?.evidence ?? [])
            : [];
          const lineEvidence =
            data.terms.lines?.flatMap((line) => line.evidence) ?? [];
          if (
            [
              ...data.terms.evidence,
              ...pricingEvidence,
              ...conditionEvidence,
              ...lineEvidence,
              ...(data.terms.references?.flatMap(
                (reference) => reference.evidence,
              ) ?? []),
            ].some(
              (e) =>
                e.documentId !== doc.id ||
                e.extractionRunId !== run.id ||
                !result.data.pages.some(
                  (p) => p.page === e.page && p.text.includes(e.snippet),
                ),
            )
          )
            throw new DocumentError(422, 'INVALID_AGREEMENT_EVIDENCE');
          if (data.operationId) {
            const op = await tx.operation.findFirst({
              where: { organizationId, id: data.operationId },
            });
            if (!op) throw new DocumentError(404, 'NOT_FOUND');
          }
          const sourceCorrections = await tx.documentCorrection.findMany({
            where: {
              organizationId,
              documentId: doc.id,
              extractionRunId: run.id,
            },
            orderBy: { revision: 'asc' },
          });
          const sourceFacts = deriveAnalysisFacts({
            documentId: doc.id,
            extractionRunId: run.id,
            kind: doc.kind === 'quotation' ? 'quotation' : 'tariff',
            result: result.data,
            corrections: sourceCorrections,
          });
          // Immutable publication cannot erase operational restrictions present in its source.
          const references = [
            ...(sourceFacts.references ?? []),
            ...(data.terms.references ?? []),
          ].filter(
            (reference, index, all) =>
              all.findIndex(
                (other) =>
                  other.type === reference.type &&
                  other.value === reference.value,
              ) === index,
          );
          const row = await tx.agreementVersion.create({
            data: {
              organizationId,
              name: data.name,
              scope: data.scope,
              operationId: data.operationId,
              sourceDocumentId: doc.id,
              sourceExtractionRunId: run.id,
              sourceSha256: doc.sha256,
              sourceMetadataVersion: doc.metadataVersion,
              sourceCorrectionRevision: doc.correctionCount,
              terms: {
                ...data.terms,
                references,
                applicability:
                  data.terms.applicability ??
                  normalizeAgreementApplicability(
                    sourceFacts.applicability,
                    data.terms.evidence.map((e) => ({
                      ...e,
                      revisionId: null,
                    })),
                    data.terms.provider,
                    data.terms.service,
                  ),
              },
              actorId,
              reason: data.reason,
            },
          });
          await tx.identityAuditEvent.create({
            data: {
              organizationId,
              actorId,
              action: 'agreement.created',
              outcome: 'success',
              details: {
                agreementVersionId: row.id,
                sourceDocumentId: doc.id,
                scope: data.scope,
                operationId: data.operationId,
              },
            },
          });
          return agreementDto(row);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
    async select(
      organizationId: string,
      operationId: string,
      actorId: string,
      input: unknown,
    ) {
      const data = operationAgreementsSchema.parse(input);
      await prisma.$transaction(
        async (tx) => {
          await authorizeDocuments(tx, organizationId, actorId, true);
          await tx.$queryRaw`SELECT id FROM operations WHERE id = ${operationId}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE`;
          const current = await collectAnalysisInputs(
            tx,
            organizationId,
            operationId,
          );
          if (current.fingerprint !== data.expectedFingerprint)
            throw new DocumentError(409, 'STALE_OPERATION');
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
          for (const binding of data.bindings) {
            const invoice = current.links.find(
              (l) => l.documentId === binding.invoiceDocumentId,
            )?.document;
            if (!invoice || invoice.kind !== 'invoice')
              throw new DocumentError(422, 'INVALID_AGREEMENT_INVOICE');
            const row = await tx.agreementVersion.findFirst({
              where: { organizationId, id: binding.agreementVersionId },
            });
            if (!row) throw new DocumentError(404, 'NOT_FOUND');
            const agreement = agreementDto(row);
            if (binding.invoiceDocumentId === agreement.sourceDocumentId)
              throw new DocumentError(422, 'AGREEMENT_SELF_SOURCE');
            if (
              agreement.scope === 'spot' &&
              agreement.operationId !== operationId
            )
              throw new DocumentError(422, 'AGREEMENT_OPERATION_MISMATCH');
            // Selection records an authorized choice, never proof of applicability.
            // The versioned engine retains unknown and contradictory conditions.
          }
          const previous = await tx.operationAgreementBinding.findMany({
            where: { organizationId, operationId },
          });
          const contexts = (bindings: typeof data.bindings) =>
            [...bindings].sort((a, b) =>
              a.invoiceDocumentId.localeCompare(b.invoiceDocumentId),
            );
          const before = contexts(
            previous.map((b) => ({
              invoiceDocumentId: b.invoiceDocumentId,
              agreementVersionId: b.agreementVersionId,
              serviceDate: b.serviceDate,
              route: b.route,
              distanceKm: b.distanceKm?.toFixed() ?? null,
            })),
          );
          const after = contexts(
            data.bindings.map((b) => ({
              ...b,
              distanceKm:
                b.distanceKm === null
                  ? null
                  : new Prisma.Decimal(b.distanceKm).toFixed(),
            })),
          );
          if (JSON.stringify(before) === JSON.stringify(after)) return;
          await tx.operationAgreementBinding.deleteMany({
            where: { organizationId, operationId },
          });
          await tx.operationAgreementBinding.createMany({
            data: after.map((b) => {
              const unchanged = before.some(
                (old) => JSON.stringify(old) === JSON.stringify(b),
              );
              const prior = unchanged
                ? previous.find(
                    (old) => old.invoiceDocumentId === b.invoiceDocumentId,
                  )
                : undefined;
              return {
                ...b,
                organizationId,
                operationId,
                selectedBy: prior ? prior.selectedBy : actorId,
                selectedAt: prior ? prior.selectedAt : new Date(),
                selectionReason: prior ? prior.selectionReason : data.reason,
              };
            }),
          });
          const changed = await tx.operation.update({
            where: { id: operationId },
            data: { revision: { increment: 1 } },
          });
          await tx.identityAuditEvent.create({
            data: {
              organizationId,
              actorId,
              action: 'operation.agreements.updated',
              outcome: 'success',
              details: {
                operationId,
                revision: changed.revision,
                reason: data.reason,
                before,
                after,
              },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
    },
  };
}

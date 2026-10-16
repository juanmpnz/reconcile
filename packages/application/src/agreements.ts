import { Prisma, type PrismaClient } from '@reconcile/database';
import {
  agreementCreateSchema,
  agreementVersionSchema,
  agreementListSchema,
  agreementListQuerySchema,
  operationAgreementsSchema,
  extractionResultSchema,
} from '@reconcile/contracts';
import { authorizeDocuments, DocumentError } from './documents.js';
import { collectAnalysisInputs } from './analysis.js';

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
            data.terms.pricing.type === 'distance-bands'
              ? data.terms.pricing.bands.flatMap((b) => b.evidence)
              : data.terms.pricing.evidence;
          if (
            [...data.terms.evidence, ...pricingEvidence].some(
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
              terms: data.terms,
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
            if (
              binding.serviceDate < agreement.terms.validFrom ||
              binding.serviceDate > agreement.terms.validUntil
            )
              throw new DocumentError(422, 'AGREEMENT_OUTSIDE_VALIDITY');
            if (
              binding.route.trim().toLocaleLowerCase() !==
              agreement.terms.route.trim().toLocaleLowerCase()
            )
              throw new DocumentError(422, 'AGREEMENT_ROUTE_MISMATCH');
            if (
              agreement.terms.pricing.type !== 'fixed-trip' &&
              (binding.distanceKm === null ||
                new Prisma.Decimal(binding.distanceKm).lte(0))
            )
              throw new DocumentError(422, 'AGREEMENT_DISTANCE_REQUIRED');
            const fact = current.facts.find((f) => f.documentId === invoice.id);
            const normalize = (v: string) =>
              v.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
            if (
              fact?.provider &&
              normalize(fact.provider) !== normalize(agreement.terms.provider)
            )
              throw new DocumentError(422, 'AGREEMENT_PROVIDER_MISMATCH');
            if (fact?.currency && fact.currency !== agreement.terms.currency)
              throw new DocumentError(422, 'AGREEMENT_CURRENCY_MISMATCH');
            if (fact?.serviceDate && fact.serviceDate !== binding.serviceDate)
              throw new DocumentError(422, 'AGREEMENT_DATE_MISMATCH');
            if (
              fact?.route &&
              normalize(fact.route) !== normalize(binding.route)
            )
              throw new DocumentError(422, 'AGREEMENT_ROUTE_MISMATCH');
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
            data: data.bindings.map((b) => ({
              ...b,
              organizationId,
              operationId,
            })),
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

import { Prisma, type PrismaClient } from '@reconcile/database';
import { dashboardSchema } from '@reconcile/contracts';
import { authorizeDocuments } from './documents.js';
/** All-organization counts. Findings intentionally describe historical persisted results, not current validity. */
export async function getOrganizationDashboard(
  prisma: PrismaClient,
  organizationId: string,
  actorId: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await authorizeDocuments(tx, organizationId, actorId);
      const operations = await tx.$queryRaw<
        { status: string; count: bigint }[]
      >`SELECT COALESCE(r.status,'not_analyzed') AS status,count(*) AS count FROM operations o LEFT JOIN LATERAL (SELECT status FROM analysis_runs WHERE "organizationId"=o."organizationId" AND "operationId"=o.id ORDER BY version DESC LIMIT 1) r ON true WHERE o."organizationId"=${organizationId}::uuid GROUP BY COALESCE(r.status,'not_analyzed')`;
      const withoutCompletedAnalysis = await tx.operation.count({
        where: { organizationId, analyses: { none: { status: 'completed' } } },
      });
      const documents = await tx.document.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      });
      const claims = await tx.claim.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      });
      const findings = await tx.$queryRaw<
        { status: string; count: bigint }[]
      >`SELECT finding->>'status' AS status,count(*) AS count FROM operations o JOIN LATERAL (SELECT result FROM analysis_runs WHERE "organizationId"=o."organizationId" AND "operationId"=o.id AND status='completed' ORDER BY version DESC LIMIT 1) r ON true CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.result->'findings','[]'::jsonb)) finding WHERE o."organizationId"=${organizationId}::uuid GROUP BY finding->>'status'`;
      const humanConfirmed = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT count(*) AS count FROM operations o JOIN LATERAL (SELECT id,result FROM analysis_runs WHERE "organizationId"=o."organizationId" AND "operationId"=o.id AND status='completed' ORDER BY version DESC LIMIT 1) r ON true CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.result->'findings','[]'::jsonb)) WITH ORDINALITY f(finding,ordinal) JOIN LATERAL (SELECT action FROM finding_decisions WHERE "organizationId"=o."organizationId" AND "operationId"=o.id AND "runId"=r.id AND "findingIndex"=f.ordinal-1 ORDER BY ordinal DESC LIMIT 1) decision ON true WHERE o."organizationId"=${organizationId}::uuid AND f.finding->>'status' IN ('confirmed','probable') AND decision.action='confirm'`;
      const pendingDocuments = await tx.document.findMany({
        where: {
          organizationId,
          status: { in: ['needs_review', 'failed', 'blocked'] },
        },
        select: { id: true, filename: true, status: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        take: 5,
      });
      const pendingOperations = await tx.$queryRaw<
        { id: string; reference: string; name: string; status: string }[]
      >`SELECT o.id,o.reference,o.name,COALESCE(r.status,'not_analyzed') AS status FROM operations o LEFT JOIN LATERAL (SELECT status FROM analysis_runs WHERE "organizationId"=o."organizationId" AND "operationId"=o.id ORDER BY version DESC LIMIT 1) r ON true WHERE o."organizationId"=${organizationId}::uuid AND COALESCE(r.status,'not_analyzed')<>'completed' ORDER BY o."updatedAt" DESC,o.id ASC LIMIT 5`;
      const pendingClaims = await tx.claim.findMany({
        where: { organizationId, status: { notIn: ['resolved', 'rejected'] } },
        select: {
          id: true,
          operationId: true,
          provider: true,
          status: true,
          dueDate: true,
        },
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { updatedAt: 'desc' },
          { id: 'asc' },
        ],
        take: 5,
      });
      const byLatestAnalysis = {
        not_analyzed: 0,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        blocked: 0,
      };
      for (const row of operations)
        if (Object.hasOwn(byLatestAnalysis, row.status))
          Reflect.set(byLatestAnalysis, row.status, Number(row.count));
      const byDocumentStatus = {
        queued: 0,
        processing: 0,
        needs_review: 0,
        ready: 0,
        failed: 0,
        blocked: 0,
      };
      for (const row of documents)
        if (Object.hasOwn(byDocumentStatus, row.status))
          Reflect.set(byDocumentStatus, row.status, row._count._all);
      const byClaimStatus = {
        draft: 0,
        exported: 0,
        sent: 0,
        in_review: 0,
        follow_up: 0,
        resolved: 0,
        rejected: 0,
      };
      for (const row of claims)
        if (Object.hasOwn(byClaimStatus, row.status))
          Reflect.set(byClaimStatus, row.status, row._count._all);
      const findingCounts = new Map(
        findings.map((row) => [row.status, Number(row.count)]),
      );
      return dashboardSchema.parse({
        organizationId,
        generatedAt: new Date().toISOString(),
        scope: 'all_organization_records',
        operations: {
          withoutCompletedAnalysis,
          total: operations.reduce((n, r) => n + Number(r.count), 0),
          byLatestAnalysis,
        },
        documents: {
          total: documents.reduce((n, r) => n + r._count._all, 0),
          byStatus: byDocumentStatus,
        },
        claims: {
          total: claims.reduce((n, r) => n + r._count._all, 0),
          open: claims
            .filter((r) => !['resolved', 'rejected'].includes(r.status))
            .reduce((n, r) => n + r._count._all, 0),
          byStatus: byClaimStatus,
        },
        findings: {
          scope: 'latest_completed_per_operation',
          includesHistorical: true,
          humanConfirmations: Number(humanConfirmed[0]?.count ?? 0),
          confirmed: findingCounts.get('confirmed') ?? 0,
          probable: findingCounts.get('probable') ?? 0,
          notVerifiable: findingCounts.get('not-verifiable') ?? 0,
          matched: findingCounts.get('matched') ?? 0,
        },
        pending: {
          documents: pendingDocuments,
          operations: pendingOperations,
          claims: pendingClaims,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { dashboardSchema } from '@reconcile/contracts';
import { useIdentityFixture, body } from './support/identity-fixture.js';
/** Metrics acceptance arranges persisted counter fixtures directly; it does not claim document/financial engine E2E. */
describe('organization dashboard aggregates through actual identity, PostgreSQL and HTTP', () => {
  const fixture = useIdentityFixture({ addressPrefix: '198.18.2' });
  const { prisma, verifiedUser, organization, request, invite, accept } =
    fixture;
  const endpoint = (org: string) => `/api/v1/organizations/${org}/dashboard`;
  it('counts all organization records, latest completed results and latest human decisions without historical double counting', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    await prisma.operation.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        organizationId: org,
        name: 'Counter fixture ' + i,
        reference: 'COUNTER-' + i,
      })),
    });
    const operation = await prisma.operation.create({
      data: {
        organizationId: org,
        name: 'Results fixture',
        reference: 'RESULTS',
      },
    });
    const findingStatuses = [
      'confirmed',
      'probable',
      'matched',
      'not-verifiable',
    ];
    const run = async (version: number, status: string, statuses: string[]) =>
      prisma.analysisRun.create({
        data: {
          organizationId: org,
          operationId: operation.id,
          actorId: (
            await prisma.user.findUniqueOrThrow({
              where: { email: owner.email },
            })
          ).id,
          version,
          idempotencyKey: randomUUID(),
          fingerprint: 'a'.repeat(64),
          parserVersion: 'counter-fixture',
          ruleVersion: 'counter-fixture',
          snapshot: {},
          sources: [],
          inputWarnings: [],
          status,
          result: { findings: statuses.map((status) => ({ status })) },
        },
      });
    await run(
      1,
      'completed',
      Array.from({ length: 10 }, () => 'confirmed'),
    );
    const completed = await run(2, 'completed', findingStatuses);
    await run(3, 'failed', []);
    const actor = await prisma.user.findUniqueOrThrow({
      where: { email: owner.email },
    });
    await prisma.findingDecision.createMany({
      data: [
        {
          organizationId: org,
          operationId: operation.id,
          runId: completed.id,
          actorId: actor.id,
          findingIndex: 0,
          action: 'confirm',
          reason: 'Counter fixture',
          ordinal: 1,
        },
        {
          organizationId: org,
          operationId: operation.id,
          runId: completed.id,
          actorId: actor.id,
          findingIndex: 0,
          action: 'dismiss',
          reason: 'Later counter fixture',
          ordinal: 2,
        },
        {
          organizationId: org,
          operationId: operation.id,
          runId: completed.id,
          actorId: actor.id,
          findingIndex: 1,
          action: 'confirm',
          reason: 'Counter fixture',
          ordinal: 3,
        },
      ],
    });
    const statuses = [
      'queued',
      'processing',
      'needs_review',
      'ready',
      'failed',
      'blocked',
      'needs_review',
    ];
    const claimStatuses = [
      'draft',
      'exported',
      'sent',
      'in_review',
      'follow_up',
      'resolved',
      'rejected',
    ];
    for (const [index, status] of statuses.entries()) {
      const doc = await prisma.document.create({
        data: {
          organizationId: org,
          filename: `Counter-${index}.pdf`,
          kind: 'invoice',
          status,
          sizeBytes: 5,
          sha256: String(index).padStart(64, '0'),
          storageKey: `counter-fixture/${org}/${index}`,
          uploadedBy: actor.id,
        },
      });
      await prisma.claim.create({
        data: {
          organizationId: org,
          operationId: operation.id,
          documentId: doc.id,
          runId: completed.id,
          findingIndex: 0,
          kind: 'clarification',
          provider: 'Counter fixture',
          status: claimStatuses[index] ?? 'draft',
        },
      });
    }
    const response = await request(endpoint(org), owner);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    const dashboard = dashboardSchema.parse(body(response));
    expect(dashboard.organizationId).toBe(org);
    expect(dashboard.scope).toBe('all_organization_records');
    expect(dashboard.operations.total).toBe(56);
    expect(dashboard.operations.withoutCompletedAnalysis).toBe(55);
    expect(dashboard.operations.byLatestAnalysis.not_analyzed).toBe(55);
    expect(dashboard.operations.byLatestAnalysis.failed).toBe(1);
    expect(dashboard.documents.total).toBe(7);
    expect(dashboard.documents.byStatus.needs_review).toBe(2);
    expect(dashboard.documents.byStatus.failed).toBe(1);
    expect(dashboard.documents.byStatus.blocked).toBe(1);
    expect(dashboard.claims.total).toBe(7);
    expect(dashboard.claims.open).toBe(5);
    expect(dashboard.findings).toEqual({
      scope: 'latest_completed_per_operation',
      includesHistorical: true,
      confirmed: 1,
      probable: 1,
      matched: 1,
      notVerifiable: 1,
      humanConfirmations: 1,
    });
    expect(dashboard.pending.operations).toHaveLength(5);
    expect(dashboard.pending.documents).toHaveLength(4);
    expect(dashboard.pending.claims).toHaveLength(5);
    expect(
      dashboard.pending.claims.every(
        (c) => !['resolved', 'rejected'].includes(c.status),
      ),
    ).toBe(true);
    const page = await request(
      `/api/v1/organizations/${org}/operations?limit=1`,
      owner,
    );
    expect(body(page).total).toBe(56);
    const pageItems = body(page).items;
    expect(Array.isArray(pageItems) && pageItems.length).toBe(1);
    const other = await verifiedUser();
    const otherOrg = await organization(other);
    const empty = dashboardSchema.parse(
      body(await request(endpoint(otherOrg), other)),
    );
    expect(empty.operations.total).toBe(0);
    expect(empty.documents.total).toBe(0);
    expect(empty.claims.total).toBe(0);
    expect(empty.findings.confirmed).toBe(0);
    expect(empty.pending.operations).toEqual([]);
  });
  it('allows current verified viewers but denies anonymous, foreign and revoked membership access', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const viewer = await verifiedUser();
    expect(
      (await accept(viewer, await invite(owner, org, viewer))).statusCode,
    ).toBe(200);
    expect((await request(endpoint(org), viewer)).statusCode).toBe(200);
    const foreign = await verifiedUser();
    await organization(foreign);
    expect((await request(endpoint(org), foreign)).statusCode).toBe(404);
    expect(
      (await fixture.app.inject({ method: 'GET', url: endpoint(org) }))
        .statusCode,
    ).toBe(401);
    expect((await request(endpoint('invalid'), owner)).statusCode).toBe(404);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: viewer.email },
    });
    await prisma.member.deleteMany({
      where: { organizationId: org, userId: user.id },
    });
    expect((await request(endpoint(org), viewer)).statusCode).toBe(404);
  });
});

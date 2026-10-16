import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { operationListSchema, agreementListSchema } from '@reconcile/contracts';
import { useIdentityFixture, body } from './support/identity-fixture.js';
describe('global operation and agreement list queries through real HTTP identity and PostgreSQL', () => {
  const fixture = useIdentityFixture({ addressPrefix: '198.18.3' });
  const { prisma, request, verifiedUser, organization } = fixture;
  it('searches and sorts the complete tenant operation set before pagination, treats wildcards literally and rejects unsupported columns', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    await prisma.operation.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        organizationId: org,
        reference: 'OP-' + String(i).padStart(3, '0'),
        name: i === 59 ? 'Unique 100%_target' : 'Ordinary ' + i,
      })),
    });
    const endpoint = `/api/v1/organizations/${org}/operations`;
    const found = operationListSchema.parse(
      body(
        await request(
          endpoint + '?q=' + encodeURIComponent('100%_target') + '&limit=25',
          owner,
        ),
      ),
    );
    expect(found.total).toBe(1);
    expect(found.items[0]?.reference).toBe('OP-059');
    const page = operationListSchema.parse(
      body(
        await request(
          endpoint + '?sort=reference&direction=asc&limit=25&offset=50',
          owner,
        ),
      ),
    );
    expect(page.total).toBe(60);
    expect(page.items).toHaveLength(10);
    expect(page.items[0]?.reference).toBe('OP-050');
    const desc = operationListSchema.parse(
      body(
        await request(
          endpoint + '?sort=reference&direction=desc&limit=25',
          owner,
        ),
      ),
    );
    expect(desc.items[0]?.reference).toBe('OP-059');
    expect(
      (await request(endpoint + '?sort=fingerprint', owner)).statusCode,
    ).toBe(400);
    expect(
      (await request(endpoint + '?direction=sideways', owner)).statusCode,
    ).toBe(400);
    const foreign = await verifiedUser();
    const foreignOrg = await organization(foreign);
    expect(
      operationListSchema.parse(
        body(
          await request(
            `/api/v1/organizations/${foreignOrg}/operations?q=target`,
            foreign,
          ),
        ),
      ).total,
    ).toBe(0);
    expect((await request(endpoint + '?q=target', foreign)).statusCode).toBe(
      404,
    );
  });
  it('searches reviewed agreement JSON fields globally and sorts dates/names with stable pagination and tenant isolation', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: owner.email },
    });
    const documentId = randomUUID(),
      runId = randomUUID();
    await prisma.document.create({
      data: {
        id: documentId,
        organizationId: org,
        filename: 'List fixture.pdf',
        kind: 'tariff',
        sizeBytes: 5,
        sha256: 'b'.repeat(64),
        storageKey: 'list-fixture/' + documentId,
        uploadedBy: user.id,
      },
    });
    await prisma.extractionRun.create({
      data: {
        id: runId,
        organizationId: org,
        documentId,
        actorId: user.id,
        version: 1,
        status: 'ready',
      },
    });
    const evidence = [
      {
        documentId,
        extractionRunId: runId,
        page: 1,
        snippet: 'Explicit list query fixture',
      },
    ];
    await prisma.agreementVersion.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        organizationId: org,
        name:
          i === 59
            ? 'Unique 100%_title'
            : 'Agreement ' + String(i).padStart(3, '0'),
        scope: 'reusable',
        sourceDocumentId: documentId,
        sourceExtractionRunId: runId,
        sourceSha256: 'b'.repeat(64),
        sourceMetadataVersion: 0,
        sourceCorrectionRevision: 0,
        actorId: user.id,
        reason: 'List query fixture',
        terms: {
          agreementBasis: 'accepted',
          provider: i === 59 ? 'Needle Provider' : 'Ordinary',
          currency: 'EUR',
          validFrom: i === 59 ? '2026-02-01' : '2026-01-01',
          validUntil: '2026-12-31',
          route: 'Fixture route',
          service: 'pickup',
          pricing: { type: 'fixed-trip', amount: '1', evidence },
          evidence,
        },
      })),
    });
    const endpoint = `/api/v1/organizations/${org}/agreements`;
    const found = agreementListSchema.parse(
      body(await request(endpoint + '?q=needle&limit=25', owner)),
    );
    expect(found.total).toBe(1);
    expect(found.items[0]?.terms.provider).toBe('Needle Provider');
    const literal = agreementListSchema.parse(
      body(
        await request(
          endpoint + '?q=' + encodeURIComponent('100%_title'),
          owner,
        ),
      ),
    );
    expect(literal.total).toBe(1);
    const dates = agreementListSchema.parse(
      body(
        await request(
          endpoint + '?sort=validFrom&direction=desc&limit=25',
          owner,
        ),
      ),
    );
    expect(dates.total).toBe(60);
    expect(dates.items[0]?.terms.validFrom).toBe('2026-02-01');
    const first = agreementListSchema.parse(
      body(
        await request(endpoint + '?sort=title&direction=asc&limit=25', owner),
      ),
    );
    const second = agreementListSchema.parse(
      body(
        await request(
          endpoint + '?sort=title&direction=asc&limit=25&offset=25',
          owner,
        ),
      ),
    );
    expect(first.items).toHaveLength(25);
    expect(second.items).toHaveLength(25);
    expect(
      first.items.some((a) => second.items.some((b) => a.id === b.id)),
    ).toBe(false);
    expect((await request(endpoint + '?sort=terms', owner)).statusCode).toBe(
      400,
    );
    const foreign = await verifiedUser();
    const foreignOrg = await organization(foreign);
    expect(
      agreementListSchema.parse(
        body(
          await request(
            `/api/v1/organizations/${foreignOrg}/agreements?q=needle`,
            foreign,
          ),
        ),
      ).total,
    ).toBe(0);
    expect((await request(endpoint, foreign)).statusCode).toBe(404);
  });
});

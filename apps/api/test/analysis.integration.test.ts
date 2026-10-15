import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { processAnalysisRun } from '@reconcile/application';
import { parseServiceConfig } from '@reconcile/config';
import {
  documentDetailSchema,
  operationDetailSchema,
  analysisRunSchema,
  type OperationDetail,
} from '@reconcile/contracts';
import { createPrivateDocumentStorage } from '@reconcile/document-processing';
import { startDocumentProcessing } from '@reconcile/worker/documents';
import { startAnalysisProcessing } from '@reconcile/worker/analyses';
import {
  useIdentityFixture,
  body,
  type Browser,
} from './support/identity-fixture.js';
import { makePdf } from './support/pdf-fixture.js';

const source = (name: string) =>
  readFileSync(
    new URL(
      `../../../fixtures/logistics/source-documents/${name}.pdf`,
      import.meta.url,
    ),
  );
const originals = [
  { name: 'carrier-invoice', kind: 'invoice' },
  { name: 'transport-invoice', kind: 'invoice' },
  { name: 'carrier-agreement', kind: 'tariff' },
  { name: 'pickup-record', kind: 'operational' },
] as const;

describe('explainable analysis with actual uploaded PDFs, identity, PostgreSQL, S3 and Redis', () => {
  let storage: ReturnType<typeof createPrivateDocumentStorage>;
  let documents: ReturnType<typeof startDocumentProcessing>;
  let analyses: ReturnType<typeof startAnalysisProcessing>;
  const fixture = useIdentityFixture({
    addressPrefix: '192.0.2',
    beforeCleanup: async () => {
      if (analyses) await analyses.close();
      if (documents) await documents.close();
      if (storage) {
        for (const document of await fixture.prisma.document.findMany({
          where: { organizationId: { in: [...fixture.organizationIds] } },
        }))
          await storage.remove(document.storageKey);
        storage.close();
      }
    },
  });
  const {
    prisma,
    request,
    verifiedUser,
    organization,
    invite,
    accept,
    rejected,
  } = fixture;
  const base = (org: string, operation?: string) =>
    `/api/v1/organizations/${org}/operations${operation ? `/${operation}` : ''}`;
  beforeAll(async () => {
    const config = parseServiceConfig(process.env);
    storage = createPrivateDocumentStorage(config);
    documents = startDocumentProcessing({
      prisma,
      storage,
      redisUrl: config.REDIS_URL,
      autoDispatch: false,
    });
    analyses = startAnalysisProcessing({
      prisma,
      redisUrl: config.REDIS_URL,
      autoDispatch: false,
    });
    await documents.worker.waitUntilReady();
    await analyses.worker.waitUntilReady();
    await documents.worker.pause(true);
    await analyses.worker.pause(true);
  });
  async function upload(
    org: string,
    actor: Browser,
    bytes: Buffer,
    filename: string,
    kind = 'invoice',
  ) {
    const response = await fixture.app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org}/documents`,
      remoteAddress: actor.address,
      headers: {
        origin: fixture.origin,
        cookie: [...actor.cookies]
          .map(([key, value]) => `${key}=${value}`)
          .join('; '),
        'content-type': 'application/pdf',
        'x-document-filename': encodeURIComponent(filename),
        'x-document-kind': kind,
      },
      payload: bytes,
    });
    expect(response.statusCode, response.body).toBe(201);
    const doc = documentDetailSchema.parse(body(response));
    const intent = await prisma.documentOutbox.findFirstOrThrow({
      where: { documentId: doc.id },
    });
    await documents.process({
      outboxId: intent.id,
      organizationId: org,
      documentId: doc.id,
      runId: intent.runId,
      actorId: intent.actorId,
    });
    return doc.id;
  }
  async function putDocuments(
    org: string,
    operation: string,
    actor: Browser,
    documentIds: string[],
  ) {
    const current = await request(base(org, operation), actor);
    const expectedFingerprint =
      current.statusCode === 200
        ? operationDetailSchema.parse(body(current)).fingerprint
        : '0'.repeat(64);
    return fixture.app.inject({
      method: 'PUT',
      url: `${base(org, operation)}/documents`,
      remoteAddress: actor.address,
      headers: {
        origin: fixture.origin,
        cookie: [...actor.cookies]
          .map(([key, value]) => `${key}=${value}`)
          .join('; '),
      },
      payload: { documentIds, expectedFingerprint },
    });
  }
  async function detail(org: string, operation: string, actor: Browser) {
    const response = await request(base(org, operation), actor);
    expect(response.statusCode, response.body).toBe(200);
    return operationDetailSchema.parse(body(response));
  }
  async function operationWith(
    org: string,
    actor: Browser,
    ids: string[],
    reference = 'OP-DEMO-062',
  ) {
    const response = await request(base(org), actor, {
      reference,
      name: 'Synthetic analysis acceptance',
    });
    expect(response.statusCode, response.body).toBe(201);
    const operation = operationDetailSchema.parse(body(response));
    const linked = await putDocuments(org, operation.id, actor, ids);
    expect(linked.statusCode, linked.body).toBe(200);
    return detail(org, operation.id, actor);
  }
  async function dossier(org: string, actor: Browser) {
    const ids: string[] = [];
    for (const item of originals)
      ids.push(
        await upload(
          org,
          actor,
          source(item.name),
          `${item.name}.pdf`,
          item.kind,
        ),
      );
    return operationWith(org, actor, ids);
  }
  async function enqueue(
    org: string,
    operation: string,
    actor: Browser,
    idempotencyKey = randomUUID(),
  ) {
    const response = await request(`${base(org, operation)}/analyses`, actor, {
      idempotencyKey,
    });
    expect([200, 202], response.body).toContain(response.statusCode);
    return analysisRunSchema.parse(body(response));
  }
  async function jobFor(runId: string) {
    const intent = await prisma.analysisOutbox.findFirstOrThrow({
      where: { runId },
    });
    return {
      outboxId: intent.id,
      organizationId: intent.organizationId,
      operationId: intent.operationId,
      runId: intent.runId,
      actorId: intent.actorId,
    };
  }
  async function completed(
    org: string,
    operation: string,
    actor: Browser,
    runId?: string,
  ) {
    const run = runId ? { id: runId } : await enqueue(org, operation, actor);
    await analyses.process(await jobFor(run.id));
    const response = await request(
      `${base(org, operation)}/analyses/${run.id}`,
      actor,
    );
    expect(response.statusCode, response.body).toBe(200);
    const result = analysisRunSchema.parse(body(response));
    expect(result.status).toBe('completed');
    if (!result.result)
      throw new Error('Actual comparison must persist findings');
    return result;
  }
  function fact(operation: OperationDetail, kind: string, provider?: string) {
    const value = operation.facts.find(
      (item) => item.kind === kind && (!provider || item.provider === provider),
    );
    if (!value) throw new Error('Missing actual parsed facts');
    return value;
  }

  it('extracts source facts and compares the 62 USD pickup with four-document evidence, once per run', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const operation = await dossier(org, owner);
    expect(operation.facts).toHaveLength(4);
    const carrier = fact(operation, 'invoice', 'Faro Ocean Demo');
    expect(carrier.lines.map((line) => line.amount)).toEqual([
      '150.00',
      '62.00',
    ]);
    const initial = await enqueue(org, operation.id, owner);
    expect(initial.status).toBe('queued');
    expect(initial.result).toBeNull();
    const analyzed = await completed(org, operation.id, owner, initial.id);
    const pickup = analyzed.result?.findings.find(
      (item) => item.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER',
    );
    expect(pickup).toMatchObject({
      documentId: carrier.documentId,
      status: 'confirmed',
      expected: '0',
      invoiced: '62.00',
      difference: '62',
      currency: 'USD',
    });
    expect(new Set(pickup?.evidence.map((item) => item.documentId)).size).toBe(
      4,
    );
    for (const evidence of pickup?.evidence ?? []) {
      expect(operation.documentIds).toContain(evidence.documentId);
      expect(evidence.page).toBe(1);
      expect(evidence.snippet.length).toBeGreaterThan(0);
    }
    expect(
      analyzed.result?.findings.some((item) => item.code === 'PRICE_MATCH'),
    ).toBe(false);
    await analyses.process(await jobFor(initial.id));
    expect((await detail(org, operation.id, owner)).analyses).toHaveLength(1);
    expect(
      (await completed(org, operation.id, owner, initial.id)).result,
    ).toEqual(analyzed.result);
  });

  it('does not manufacture an agreed price from an invoice alone or an expired agreement', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const invoice = await upload(
      org,
      owner,
      makePdf([
        'DEMO - sin validez comercial',
        'CARRIER INVOICE',
        'Provider: Faro Ocean Demo',
        'Operation reference: OP-DEMO-062',
        'Currency: USD',
        'Total: 212.00',
        'Route: Port A',
        'Ocean handling 1 service 150.00 150.00',
        'Pickup - Warehouse A to Port A 1 trip 62.00 62.00',
        'Tax amount: 0.00 USD',
        'Service date: 2026-10-10',
        'Service reference: PICK-DEMO-001',
      ]),
      'carrier.pdf',
    );
    const operation = await operationWith(org, owner, [invoice]);
    const missing = await completed(org, operation.id, owner);
    expect(
      missing.result?.findings.filter(
        (item) => item.code === 'AGREEMENT_MISSING',
      ),
    ).toHaveLength(2);
    expect(
      missing.result?.findings.some((item) => item.status === 'confirmed'),
    ).toBe(false);
    const agreement = await upload(
      org,
      owner,
      makePdf([
        'DEMO - sin validez comercial',
        'CARRIER AGREEMENT',
        'Provider: Faro Ocean Demo',
        'Operation reference: OP-DEMO-062',
        'Currency: USD',
        'Valid from: 2026-09-01',
        'Valid until: 2026-09-30',
        'Ocean handling: 1 service at 150.00 USD.',
        'Scope: Port A handling for one demo container.',
        'Excludes pickup Warehouse A to Port A; ordered separately from Ruta Norte Demo.',
        'Demo agreement accepted 2026-09-01. Not an internal estimate.',
      ]),
      'expired.pdf',
      'tariff',
    );
    expect(
      (await putDocuments(org, operation.id, owner, [invoice, agreement]))
        .statusCode,
    ).toBe(200);
    const expired = await completed(org, operation.id, owner);
    expect(
      expired.result?.findings.filter(
        (item) => item.code === 'AGREEMENT_MISSING',
      ),
    ).toHaveLength(2);
  });

  it('does not convert currencies or merge pickups from different service trams', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const invoice = await upload(
      org,
      owner,
      makePdf([
        'DEMO - sin validez comercial',
        'CARRIER INVOICE',
        'Provider: Faro Ocean Demo',
        'Operation reference: OP-DEMO-062',
        'Currency: USD',
        'Total: 212.00',
        'Route: Port A',
        'Ocean handling 1 service 150.00 150.00',
        'Pickup - Warehouse A to Port A 1 trip 62.00 62.00',
        'Tax amount: 0.00 USD',
        'Service date: 2026-10-10',
        'Service reference: PICK-DEMO-001',
      ]),
      'carrier.pdf',
    );
    const euroAgreement = await upload(
      org,
      owner,
      makePdf([
        'DEMO - sin validez comercial',
        'CARRIER AGREEMENT',
        'Provider: Faro Ocean Demo',
        'Operation reference: OP-DEMO-062',
        'Currency: EUR',
        'Valid from: 2026-10-01',
        'Valid until: 2026-10-31',
        'Ocean handling: 1 service at 150.00 EUR.',
        'Scope: Port A handling for one demo container.',
        'Excludes pickup Warehouse A to Port A; ordered separately from Ruta Norte Demo.',
        'Demo agreement accepted 2026-10-01. Not an internal estimate.',
      ]),
      'euro-agreement.pdf',
      'tariff',
    );
    const operation = await operationWith(org, owner, [invoice, euroAgreement]);
    const currency = await completed(org, operation.id, owner);
    expect(
      currency.result?.findings.filter(
        (item) => item.code === 'CURRENCY_UNVERIFIABLE',
      ),
    ).toHaveLength(2);
    expect(
      currency.result?.findings.every((item) => item.difference === null),
    ).toBe(true);
    const agreement = await upload(
      org,
      owner,
      source('carrier-agreement'),
      'carrier-agreement.pdf',
      'tariff',
    );
    const transport = await upload(
      org,
      owner,
      makePdf([
        'DEMO - sin validez comercial',
        'TRANSPORT INVOICE',
        'Provider: Ruta Norte Demo',
        'Operation reference: OP-DEMO-062',
        'Currency: USD',
        'Total: 62.00',
        'Pickup - Port A to Warehouse B 1 trip 62.00 62.00',
        'Tax amount: 0.00 USD',
        'Service date: 2026-10-10',
        'Service reference: PICK-DEMO-002',
      ]),
      'different-tram.pdf',
    );
    const record = await upload(
      org,
      owner,
      source('pickup-record'),
      'pickup-record.pdf',
      'operational',
    );
    expect(
      (
        await putDocuments(org, operation.id, owner, [
          invoice,
          agreement,
          transport,
          record,
        ])
      ).statusCode,
    ).toBe(200);
    const distinct = await completed(org, operation.id, owner);
    expect(
      distinct.result?.findings.some(
        (item) => item.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER',
      ),
    ).toBe(false);
    expect(
      distinct.result?.findings.some(
        (item) => item.code === 'EXCLUDED_SERVICE',
      ),
    ).toBe(true);
  });

  it('checks each line even when opposite differences cancel in the invoice total', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const invoice = await upload(
      org,
      owner,
      makePdf([
        'DEMO - sin validez comercial',
        'CARRIER INVOICE',
        'Provider: Faro Ocean Demo',
        'Operation reference: OP-DEMO-062',
        'Currency: USD',
        'Total: 300.00',
        'Route: Port A',
        'Ocean handling 1 service 160.00 160.00',
        'Ocean handling 1 service 140.00 140.00',
        'Tax amount: 0.00 USD',
        'Service date: 2026-10-10',
      ]),
      'offset-lines.pdf',
    );
    const agreement = await upload(
      org,
      owner,
      source('carrier-agreement'),
      'agreement.pdf',
      'tariff',
    );
    const operation = await operationWith(org, owner, [invoice, agreement]);
    const analyzed = await completed(org, operation.id, owner);
    const differences = analyzed.result?.findings.filter(
      (item) => item.code === 'PRICE_OR_QUANTITY_DIFFERENCE',
    );
    expect(differences?.map((item) => item.difference)).toEqual(['10', '-10']);
    expect(
      analyzed.result?.findings.some(
        (item) => item.code === 'TOTAL_INCONSISTENT',
      ),
    ).toBe(false);
    expect(
      analyzed.result?.findings.some((item) => item.code === 'PRICE_MATCH'),
    ).toBe(false);
  });

  it('leaves a matching invoice price without a financial approval or fabricated discrepancy', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const invoice = await upload(
      org,
      owner,
      makePdf([
        'DEMO - sin validez comercial',
        'CARRIER INVOICE',
        'Provider: Faro Ocean Demo',
        'Operation reference: OP-DEMO-062',
        'Currency: USD',
        'Total: 150.00',
        'Route: Port A',
        'Ocean handling 1 service 150.00 150.00',
        'Tax amount: 0.00 USD',
        'Service date: 2026-10-10',
      ]),
      'correct-invoice.pdf',
    );
    const agreement = await upload(
      org,
      owner,
      source('carrier-agreement'),
      'agreement.pdf',
      'tariff',
    );
    const operation = await operationWith(org, owner, [invoice, agreement]);
    const analyzed = await completed(org, operation.id, owner);
    expect(analyzed.result?.findings).toHaveLength(1);
    expect(analyzed.result?.findings[0]).toMatchObject({
      code: 'PRICE_MATCH',
      status: 'matched',
      difference: '0',
    });
    expect(analyzed.result?.findings[0]?.explanation).toContain('prestación');
  });

  it('keeps prior snapshots immutable and marks them stale after source corrections and link changes', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const operation = await dossier(org, owner);
    const carrier = fact(operation, 'invoice', 'Faro Ocean Demo');
    const oldQueued = await enqueue(org, operation.id, owner);
    const correction = await request(
      `/api/v1/organizations/${org}/documents/${carrier.documentId}/corrections`,
      owner,
      {
        extractionRunId: carrier.extractionRunId,
        field: 'total',
        value: '211.00',
        reason: 'Synthetic correction preserving history',
      },
    );
    expect(correction.statusCode, correction.body).toBe(201);
    const changed = await detail(org, operation.id, owner);
    expect(changed.fingerprint).not.toBe(oldQueued.fingerprint);
    const old = await completed(org, operation.id, owner, oldQueued.id);
    expect(
      old.snapshot.documents.find(
        (item) => item.documentId === carrier.documentId,
      )?.total,
    ).toBe('212.00');
    expect(old.stale).toBe(true);
    expect(fact(changed, 'invoice', 'Faro Ocean Demo').total).toBe('211.00');
    const historical = analysisRunSchema.parse(
      body(
        await request(`${base(org, operation.id)}/analyses/${old.id}`, owner),
      ),
    );
    expect(historical.stale).toBe(true);
    expect(historical.snapshot).toEqual(old.snapshot);
    expect(historical.result).toEqual(old.result);
    const next = await completed(org, operation.id, owner);
    expect(next.id).not.toBe(old.id);
    expect(next.version).toBe(old.version + 1);
    expect(
      next.result?.findings.some((item) => item.code === 'TOTAL_INCONSISTENT'),
    ).toBe(true);
    expect((await putDocuments(org, operation.id, owner, [])).statusCode).toBe(
      200,
    );
    const unlinked = analysisRunSchema.parse(
      body(
        await request(`${base(org, operation.id)}/analyses/${next.id}`, owner),
      ),
    );
    expect(unlinked.stale).toBe(true);
    expect(unlinked.snapshot.documents).toHaveLength(4);
  });

  it('enforces tenant, fresh membership, viewer and resource identity on operation and analysis routes', async () => {
    const owner = await verifiedUser();
    const outsider = await verifiedUser();
    const viewer = await verifiedUser();
    const org = await organization(owner);
    const otherOrg = await organization(outsider);
    expect(
      (await accept(viewer, await invite(owner, org, viewer))).statusCode,
    ).toBe(200);
    const operation = await dossier(org, owner);
    const run = await completed(org, operation.id, owner);
    expect(
      (await detail(org, operation.id, viewer)).capabilities.canWrite,
    ).toBe(false);
    expect(
      (await request(`${base(org, operation.id)}/analyses/${run.id}`, viewer))
        .statusCode,
    ).toBe(200);
    expect(
      (
        await request(base(org), viewer, {
          reference: 'VIEWER',
          name: 'Denied',
        })
      ).statusCode,
    ).toBe(403);
    expect((await putDocuments(org, operation.id, viewer, [])).statusCode).toBe(
      403,
    );
    expect(
      (
        await request(`${base(org, operation.id)}/analyses`, viewer, {
          idempotencyKey: randomUUID(),
        })
      ).statusCode,
    ).toBe(403);
    const carrier = fact(operation, 'invoice', 'Faro Ocean Demo');
    expect(
      (
        await request(`${base(org, operation.id)}/fact-revisions`, viewer, {
          expectedFingerprint: operation.fingerprint,
          document: carrier,
          reason: 'Viewer mutation probe',
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          `${base(org, operation.id)}/analyses`,
          owner,
          { idempotencyKey: randomUUID() },
          'https://hostile.example.invalid',
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          `${base(org, operation.id)}/analyses`,
          owner,
          { idempotencyKey: randomUUID() },
          null,
        )
      ).statusCode,
    ).toBe(403);
    const foreign = await operationWith(otherOrg, outsider, []);
    for (const endpoint of [
      base(org),
      base(org, operation.id),
      `${base(org, operation.id)}/analyses/${run.id}`,
      base(otherOrg, operation.id),
      `${base(otherOrg, foreign.id)}/analyses/${run.id}`,
    ])
      rejected(await request(endpoint, outsider));
    rejected(
      await putDocuments(otherOrg, foreign.id, outsider, operation.documentIds),
    );
    const membership = await prisma.member.findFirstOrThrow({
      where: { organizationId: org, user: { email: viewer.email } },
    });
    expect(
      (
        await request('/api/auth/organization/remove-member', owner, {
          organizationId: org,
          memberIdOrEmail: membership.id,
        })
      ).statusCode,
    ).toBe(200);
    rejected(await request(base(org, operation.id), viewer));
    rejected(
      await request(`${base(org, operation.id)}/analyses/${run.id}`, viewer),
    );
    expect((await detail(otherOrg, foreign.id, outsider)).documentIds).toEqual(
      [],
    );
  });

  it('rejects stale or forged fact revisions and preserves human review provenance', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const operation = await dossier(org, owner);
    const carrier = fact(operation, 'invoice', 'Faro Ocean Demo');
    const path = `${base(org, operation.id)}/fact-revisions`;
    const input = {
      expectedFingerprint: operation.fingerprint,
      document: carrier,
      reason: 'Synthetic review with traceable source',
    };
    expect(
      (
        await request(path, owner, {
          ...input,
          document: { ...carrier, extractionRunId: randomUUID() },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request(path, owner, {
          ...input,
          document: {
            ...carrier,
            evidence: [
              {
                documentId: carrier.documentId,
                extractionRunId: carrier.extractionRunId,
                page: 1,
                snippet:
                  'This text is fabricated and does not exist in the PDF.',
                revisionId: null,
              },
            ],
          },
        })
      ).statusCode,
    ).toBe(400);
    const response = await request(path, owner, {
      ...input,
      document: { ...carrier, total: '211.00' },
    });
    expect(response.statusCode, response.body).toBe(200);
    const revised = operationDetailSchema.parse(body(response));
    const reviewedCarrier = fact(revised, 'invoice', 'Faro Ocean Demo');
    expect(reviewedCarrier.total).toBe('211.00');
    expect(reviewedCarrier.revisionId).not.toBeNull();
    expect(
      reviewedCarrier.evidence.every(
        (item) => item.revisionId === reviewedCarrier.revisionId,
      ),
    ).toBe(true);
    expect((await request(path, owner, input)).statusCode).toBe(409);
    const run = await completed(org, operation.id, owner);
    expect(
      run.snapshot.documents.find(
        (item) => item.documentId === carrier.documentId,
      )?.revisionId,
    ).toBe(reviewedCarrier.revisionId);
    expect(
      run.result?.findings.some((item) => item.code === 'TOTAL_INCONSISTENT'),
    ).toBe(true);
  });

  it('blocks a queued analysis after its author is revoked, while an authorized owner can create a new run', async () => {
    const owner = await verifiedUser();
    const analyst = await verifiedUser();
    const org = await organization(owner);
    expect(
      (await accept(analyst, await invite(owner, org, analyst, 'analyst')))
        .statusCode,
    ).toBe(200);
    const operation = await dossier(org, owner);
    const queued = await enqueue(org, operation.id, analyst);
    const member = await prisma.member.findFirstOrThrow({
      where: { organizationId: org, user: { email: analyst.email } },
    });
    expect(
      (
        await request('/api/auth/organization/remove-member', owner, {
          organizationId: org,
          memberIdOrEmail: member.id,
        })
      ).statusCode,
    ).toBe(200);
    await analyses.process(await jobFor(queued.id));
    const blocked = analysisRunSchema.parse(
      body(
        await request(
          `${base(org, operation.id)}/analyses/${queued.id}`,
          owner,
        ),
      ),
    );
    expect(blocked.status).toBe('blocked');
    expect(blocked.errorCode).toBe('ACCESS_REVOKED');
    expect(blocked.result).toBeNull();
    rejected(
      await request(
        `${base(org, operation.id)}/analyses/${queued.id}`,
        analyst,
      ),
    );
    const replacement = await completed(org, operation.id, owner);
    expect(replacement.id).not.toBe(queued.id);
    expect(replacement.version).toBe(queued.version + 1);
    expect(
      replacement.result?.findings.some(
        (item) => item.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER',
      ),
    ).toBe(true);
  });

  it('fences an expired worker after a replacement commits the immutable analysis', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const operation = await dossier(org, owner);
    const queued = await enqueue(org, operation.id, owner);
    const job = await jobFor(queued.id);
    let reachedCommit = false;
    let releaseCommit: (() => void) | undefined;
    const delayedCommit = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    // Fault injection only delays the transaction boundary. Identity, reads, engine and both commits use real services.
    const delayedPrisma = new Proxy(prisma, {
      get(target, property) {
        if (property === '$transaction')
          return async (...args: Parameters<typeof prisma.$transaction>) => {
            reachedCommit = true;
            await delayedCommit;
            return target.$transaction(...args);
          };
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const stale = processAnalysisRun({ prisma: delayedPrisma, payload: job });
    try {
      await expect.poll(() => reachedCommit, { timeout: 10000 }).toBe(true);
      await prisma.analysisRun.update({
        where: { id: queued.id },
        data: { leaseUntil: new Date(Date.now() - 1000) },
      });
      const winner = await completed(org, operation.id, owner, queued.id);
      releaseCommit?.();
      await stale;
      const final = analysisRunSchema.parse(
        body(
          await request(
            `${base(org, operation.id)}/analyses/${queued.id}`,
            owner,
          ),
        ),
      );
      expect(final.status).toBe('completed');
      expect(final.result).toEqual(winner.result);
      expect(final.completedAt).toBe(winner.completedAt);
      expect(
        (
          await prisma.analysisRun.findUniqueOrThrow({
            where: { id: queued.id },
          })
        ).attempts,
      ).toBe(2);
      expect(
        await prisma.identityAuditEvent.count({
          where: { organizationId: org, action: 'analysis.completed' },
        }),
      ).toBe(1);
    } finally {
      releaseCommit?.();
      await stale;
    }
  });

  it('persists recovery attempts across failed commit deliveries and stops after the durable retry budget', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const operation = await dossier(org, owner);
    const queued = await enqueue(org, operation.id, owner);
    const job = await jobFor(queued.id);
    // Declared persistence fault at commit; extraction, membership, snapshot and comparison remain real.
    const unavailableCommit = new Proxy(prisma, {
      get(target, property) {
        if (property === '$transaction')
          return async () => {
            throw new Error('Synthetic commit transport unavailable');
          };
        const value: unknown = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    for (let attempt = 1; attempt <= 3; attempt++) {
      await expect(
        processAnalysisRun({ prisma: unavailableCommit, payload: job }),
      ).rejects.toThrow('Synthetic commit transport unavailable');
      const persisted = await prisma.analysisRun.findUniqueOrThrow({
        where: { id: queued.id },
      });
      expect(persisted.attempts).toBe(attempt);
      expect(persisted.result).toBeNull();
      await prisma.analysisRun.update({
        where: { id: queued.id },
        data: { leaseUntil: new Date(Date.now() - 1000) },
      });
    }
    await analyses.process(job);
    const failed = analysisRunSchema.parse(
      body(
        await request(
          `${base(org, operation.id)}/analyses/${queued.id}`,
          owner,
        ),
      ),
    );
    expect(failed.status).toBe('failed');
    expect(failed.errorCode).toBe('ANALYSIS_RETRIES_EXHAUSTED');
    expect(failed.result).toBeNull();
    expect(
      (
        await prisma.analysisOutbox.findUniqueOrThrow({
          where: { id: job.outboxId },
        })
      ).completedAt,
    ).not.toBeNull();
    const attempts = (
      await prisma.analysisRun.findUniqueOrThrow({ where: { id: queued.id } })
    ).attempts;
    await analyses.process(job);
    expect(
      (await prisma.analysisRun.findUniqueOrThrow({ where: { id: queued.id } }))
        .attempts,
    ).toBe(attempts);
  });

  it('deduplicates HTTP requests and recovers an analysis published to Redis then lost', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const operation = await dossier(org, owner);
    const key = randomUUID();
    const first = await enqueue(org, operation.id, owner, key);
    const repeated = await enqueue(org, operation.id, owner, key);
    expect(repeated.id).toBe(first.id);
    const job = await jobFor(first.id);
    await expect(
      analyses.process({ ...job, organizationId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'INVALID_JOB' });
    await analyses.dispatch();
    const published = await analyses.queue.getJob(job.outboxId);
    expect(published).toBeDefined();
    if (!published)
      throw new Error('Actual dispatcher must publish durable intent');
    await published.remove();
    await prisma.analysisOutbox.update({
      where: { id: job.outboxId },
      data: { lastEnqueuedAt: new Date(Date.now() - 120000) },
    });
    await analyses.dispatch();
    expect(await analyses.queue.getJob(job.outboxId)).toBeDefined();
    await analyses.worker.resume();
    try {
      await expect
        .poll(
          async () =>
            analysisRunSchema.parse(
              body(
                await request(
                  `${base(org, operation.id)}/analyses/${first.id}`,
                  owner,
                ),
              ),
            ).status,
          { timeout: 20000, interval: 100 },
        )
        .toBe('completed');
      expect(
        (
          await prisma.analysisOutbox.findUniqueOrThrow({
            where: { id: job.outboxId },
          })
        ).completedAt,
      ).not.toBeNull();
      expect((await detail(org, operation.id, owner)).analyses).toHaveLength(1);
    } finally {
      await analyses.worker.pause(true);
    }
  });
  it('edits the same operation, protects optimistic writes and records before/after without changing snapshots', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const op = await dossier(org, owner);
    const old = await completed(org, op.id, owner);
    async function patch(
      actor: Browser,
      input: Record<string, unknown>,
      origin = fixture.origin,
      organizationId = org,
      operationId = op.id,
    ) {
      return fixture.app.inject({
        method: 'PATCH',
        url: base(organizationId, operationId),
        remoteAddress: actor.address,
        headers: {
          origin,
          cookie: [...actor.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        },
        payload: input,
      });
    }
    const edited = await patch(owner, {
      name: 'Expediente corregido',
      reference: 'OP-UPDATED',
      expectedFingerprint: op.fingerprint,
    });
    expect(edited.statusCode, edited.body).toBe(200);
    const next = operationDetailSchema.parse(body(edited));
    expect(next.id).toBe(op.id);
    expect(next.documentIds).toEqual(op.documentIds);
    expect(next.reference).toBe('OP-UPDATED');
    expect(next.analyses[0]?.stale).toBe(true);
    expect(next.analyses[0]?.snapshot).toEqual(old.snapshot);
    const event = await prisma.identityAuditEvent.findFirstOrThrow({
      where: { organizationId: org, action: 'operation.updated' },
    });
    expect(event.details).toMatchObject({
      operationId: op.id,
      before: { name: op.name, reference: op.reference },
      after: { name: next.name, reference: next.reference },
      revision: next.revision,
    });
    expect(
      (
        await patch(owner, {
          name: 'Lost draft',
          reference: 'STALE',
          expectedFingerprint: op.fingerprint,
        })
      ).statusCode,
    ).toBe(409);
    const staleLinks = await fixture.app.inject({
      method: 'PUT',
      url: base(org, op.id) + '/documents',
      headers: {
        origin: fixture.origin,
        cookie: [...owner.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      payload: { documentIds: [], expectedFingerprint: op.fingerprint },
    });
    expect(staleLinks.statusCode).toBe(409);
    expect((await detail(org, op.id, owner)).documentIds).toEqual(
      op.documentIds,
    );
    const noOp = await patch(owner, {
      name: next.name,
      reference: next.reference,
      expectedFingerprint: next.fingerprint,
    });
    expect(operationDetailSchema.parse(body(noOp)).revision).toBe(
      next.revision,
    );
    expect(
      await prisma.identityAuditEvent.count({
        where: { organizationId: org, action: 'operation.updated' },
      }),
    ).toBe(1);
    const other = await operationWith(org, owner, [], 'OCCUPIED');
    const duplicate = await patch(owner, {
      name: next.name,
      reference: other.reference,
      expectedFingerprint: next.fingerprint,
    });
    expect(duplicate.statusCode).toBe(409);
    expect(body(duplicate).code).toBe('REFERENCE_EXISTS');
    const restored = await patch(owner, {
      name: next.name,
      reference: 'OP-DEMO-062',
      expectedFingerprint: next.fingerprint,
    });
    expect(restored.statusCode).toBe(200);
    const restoredOp = operationDetailSchema.parse(body(restored));
    expect(
      (await completed(org, op.id, owner)).result?.findings.some(
        (f) =>
          f.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER' && f.difference === '62',
      ),
    ).toBe(true);
    const originalId = op.documentIds[0];
    if (!originalId) throw new Error('Original document required');
    const beforeUnlink = await request(
      `/api/v1/organizations/${org}/documents/${originalId}/download`,
      owner,
    );
    expect(beforeUnlink.statusCode).toBe(200);
    const removed = await putDocuments(org, op.id, owner, []);
    expect(removed.statusCode).toBe(200);
    const empty = operationDetailSchema.parse(body(removed));
    expect(empty.documentIds).toEqual([]);
    const afterUnlink = await request(
      `/api/v1/organizations/${org}/documents/${originalId}/download`,
      owner,
    );
    expect(afterUnlink.statusCode).toBe(200);
    expect(afterUnlink.rawPayload).toEqual(beforeUnlink.rawPayload);
    const immutableAfterUnlink = analysisRunSchema.parse(
      body(await request(`${base(org, op.id)}/analyses/${old.id}`, owner)),
    );
    expect(immutableAfterUnlink.snapshot).toEqual(old.snapshot);
    expect(immutableAfterUnlink.result).toEqual(old.result);
    expect(
      await prisma.document.count({
        where: { organizationId: org, id: { in: op.documentIds } },
      }),
    ).toBe(4);
    expect(
      (await putDocuments(org, op.id, owner, op.documentIds)).statusCode,
    ).toBe(200);
    const audit = await prisma.identityAuditEvent.findFirstOrThrow({
      where: { organizationId: org, action: 'operation.documents.updated' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.details).toHaveProperty('operationId', op.id);
    const live = await detail(org, op.id, owner);
    const viewer = await verifiedUser();
    expect(
      (await accept(viewer, await invite(owner, org, viewer))).statusCode,
    ).toBe(200);
    expect(
      (
        await patch(viewer, {
          name: 'Denied',
          reference: live.reference,
          expectedFingerprint: live.fingerprint,
        })
      ).statusCode,
    ).toBe(403);
    const foreign = await verifiedUser();
    const foreignOrg = await organization(foreign);
    expect(
      (
        await request(base(foreignOrg), foreign, {
          name: 'Other tenant same reference',
          reference: live.reference,
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await patch(
          foreign,
          {
            name: 'Denied',
            reference: live.reference,
            expectedFingerprint: live.fingerprint,
          },
          fixture.origin,
          foreignOrg,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await patch(
          owner,
          {
            name: 'Denied',
            reference: live.reference,
            expectedFingerprint: live.fingerprint,
          },
          'https://hostile.invalid',
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await patch(owner, {
          name: '',
          reference: live.reference,
          expectedFingerprint: live.fingerprint,
        })
      ).statusCode,
    ).toBe(400);
    const named = await patch(owner, {
      name: 'Solo nombre corregido',
      reference: live.reference,
      expectedFingerprint: live.fingerprint,
    });
    expect(named.statusCode).toBe(200);
    const nameOnly = operationDetailSchema.parse(body(named));
    expect(nameOnly.reference).toBe(live.reference);
    expect(nameOnly.analyses.every((r) => r.stale)).toBe(true);
    expect(nameOnly.analyses[0]?.snapshot).toEqual(live.analyses[0]?.snapshot);
    const queued = await enqueue(org, op.id, owner);
    const blocked = await patch(owner, {
      name: 'During analysis',
      reference: nameOnly.reference,
      expectedFingerprint: nameOnly.fingerprint,
    });
    expect(blocked.statusCode).toBe(409);
    expect(body(blocked).code).toBe('ANALYSIS_ACTIVE');
    expect((await putDocuments(org, op.id, owner, [])).statusCode).toBe(409);
    await completed(org, op.id, owner, queued.id);
    const raceBefore = await detail(org, op.id, owner);
    const raceResponses = await Promise.all([
      patch(owner, {
        name: 'Concurrent metadata edit',
        reference: raceBefore.reference,
        expectedFingerprint: raceBefore.fingerprint,
      }),
      fixture.app.inject({
        method: 'PUT',
        url: base(org, op.id) + '/documents',
        remoteAddress: owner.address,
        headers: {
          origin: fixture.origin,
          cookie: [...owner.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        },
        payload: {
          documentIds: [],
          expectedFingerprint: raceBefore.fingerprint,
        },
      }),
    ]);
    expect(raceResponses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const raceAfter = await detail(org, op.id, owner);
    expect(raceAfter.revision).toBe(raceBefore.revision + 1);
    const immutableAfterRace = analysisRunSchema.parse(
      body(await request(`${base(org, op.id)}/analyses/${old.id}`, owner)),
    );
    expect(immutableAfterRace.snapshot).toEqual(old.snapshot);
    expect(immutableAfterRace.result).toEqual(old.result);
    expect(restoredOp.id).toBe(op.id);
  });
});

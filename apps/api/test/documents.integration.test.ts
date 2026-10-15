import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseServiceConfig } from '@reconcile/config';
import {
  DOCUMENT_MAX_BYTES,
  documentDetailSchema,
  documentListSchema,
} from '@reconcile/contracts';
import { createPrivateDocumentStorage } from '@reconcile/document-processing';
import { startDocumentProcessing } from '@reconcile/worker/documents';
import {
  useIdentityFixture,
  body,
  type Browser,
} from './support/identity-fixture.js';
import { makePdf } from './support/pdf-fixture.js';

const carrierPdf = readFileSync(
  new URL(
    '../../../fixtures/logistics/source-documents/carrier-invoice.pdf',
    import.meta.url,
  ),
);
const operationalPdf = readFileSync(
  new URL(
    '../../../fixtures/logistics/source-documents/pickup-record.pdf',
    import.meta.url,
  ),
);

describe('private document intake and actual PDF processing through real services', () => {
  let storage: ReturnType<typeof createPrivateDocumentStorage>;
  let runtime: ReturnType<typeof startDocumentProcessing>;
  const fixture = useIdentityFixture({
    addressPrefix: '198.51.100',
    beforeCleanup: async () => {
      if (runtime) await runtime.close();
      if (storage) {
        const documents = await fixture.prisma.document.findMany({
          where: { organizationId: { in: [...fixture.organizationIds] } },
        });
        for (const document of documents)
          await storage.remove(document.storageKey);
        storage.close();
      }
    },
  });
  const {
    prisma,
    verifiedUser,
    organization,
    request,
    invite,
    accept,
    rejected,
  } = fixture;
  const path = (organizationId: string, documentId?: string) =>
    `/api/v1/organizations/${organizationId}/documents${documentId ? `/${documentId}` : ''}`;

  beforeAll(async () => {
    const config = parseServiceConfig(process.env);
    storage = createPrivateDocumentStorage(config);
    runtime = startDocumentProcessing({
      prisma,
      storage,
      redisUrl: config.REDIS_URL,
      autoDispatch: false,
    });
    await runtime.worker.waitUntilReady();
    await runtime.worker.pause(true);
  });

  async function upload(
    organizationId: string,
    actor: Browser,
    bytes: Buffer = carrierPdf,
    filename = 'carrier-invoice.pdf',
    headers: Record<string, string> = {},
  ) {
    return fixture.app.inject({
      method: 'POST',
      url: path(organizationId),
      remoteAddress: actor.address,
      headers: {
        origin: fixture.origin,
        cookie: [...actor.cookies]
          .map(([key, value]) => `${key}=${value}`)
          .join('; '),
        'content-type': 'application/pdf',
        'x-document-filename': encodeURIComponent(filename),
        'x-document-kind': 'invoice',
        ...headers,
      },
      payload: bytes,
    });
  }
  async function created(
    organizationId: string,
    actor: Browser,
    bytes: Buffer = carrierPdf,
    filename?: string,
  ) {
    const response = await upload(organizationId, actor, bytes, filename);
    expect(response.statusCode, response.body).toBe(201);
    return documentDetailSchema.parse(body(response));
  }
  async function detail(
    organizationId: string,
    documentId: string,
    actor: Browser,
  ) {
    const response = await request(path(organizationId, documentId), actor);
    expect(response.statusCode, response.body).toBe(200);
    return documentDetailSchema.parse(body(response));
  }
  async function jobFor(documentId: string) {
    const outbox = await prisma.documentOutbox.findFirstOrThrow({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
    });
    return {
      outboxId: outbox.id,
      organizationId: outbox.organizationId,
      documentId: outbox.documentId,
      runId: outbox.runId,
      actorId: outbox.actorId,
    };
  }
  async function processDocument(documentId: string) {
    await runtime.process(await jobFor(documentId));
  }

  it('persists upload intent, reads private original bytes, extracts actual page evidence and appends corrections', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const initial = await created(org, owner);
    expect(initial.status).toBe('queued');
    expect(initial.latestRun?.version).toBe(1);
    expect(initial.sha256).toBe(
      createHash('sha256').update(carrierPdf).digest('hex'),
    );
    const job = await jobFor(initial.id);
    const pending = await prisma.documentOutbox.findUniqueOrThrow({
      where: { id: job.outboxId },
    });
    expect(pending.lastEnqueuedAt).toBeNull();
    expect(pending.completedAt).toBeNull();
    const original = await request(`${path(org, initial.id)}/download`, owner);
    expect(original.statusCode, original.body).toBe(200);
    expect(original.rawPayload).toEqual(carrierPdf);
    expect(original.headers['content-type']).toContain('application/pdf');
    expect(original.headers['content-disposition']).toContain('attachment;');
    expect(original.headers['x-content-type-options']).toBe('nosniff');
    expect(original.headers['content-security-policy']).toContain('sandbox');
    const stored = await prisma.document.findUniqueOrThrow({
      where: { id: initial.id },
    });
    expect(stored.storageKey).toBe(
      `organizations/${org}/documents/${initial.id}/original.pdf`,
    );
    const config = parseServiceConfig(process.env);
    const anonymousStorage = await fetch(
      `${config.S3_ENDPOINT}/${config.S3_BUCKET}/${stored.storageKey}`,
    );
    expect([401, 403, 404]).toContain(anonymousStorage.status);
    await runtime.process(job);
    const extracted = await detail(org, initial.id, owner);
    expect(extracted.status).toBe('needs_review');
    const run = extracted.latestRun;
    expect(run).not.toBeNull();
    if (!run?.result)
      throw new Error('Actual PDF extraction must persist a result');
    expect(run.result.engine).toBe('pdfjs-text-v1');
    expect(
      run.result.pages.some((page) => page.text.includes('CAR-DEMO-001')),
    ).toBe(true);
    const total = run.result.fields.find((field) => field.name === 'total');
    expect(total?.value).toBe('212.00');
    expect(total?.evidence?.page).toBe(1);
    expect(total?.evidence?.snippet).toContain('212.00');
    expect(run.result.warnings).toContain('HUMAN_REVIEW_REQUIRED');
    const originalResult = structuredClone(run.result);
    const correction = await request(
      `${path(org, initial.id)}/corrections`,
      owner,
      {
        extractionRunId: run.id,
        field: 'total',
        value: '211.00',
        reason: 'Synthetic human review correction',
      },
    );
    expect(correction.statusCode, correction.body).toBe(201);
    const secondCorrection = await request(
      `${path(org, initial.id)}/corrections`,
      owner,
      {
        extractionRunId: run.id,
        field: 'total',
        value: '210.00',
        reason: 'Synthetic second review',
      },
    );
    expect(secondCorrection.statusCode, secondCorrection.body).toBe(201);
    const reviewed = await detail(org, initial.id, owner);
    expect(reviewed.latestRun?.result).toEqual(originalResult);
    expect(reviewed.corrections.map((item) => item.revision)).toEqual([1, 2]);
    expect(reviewed.corrections.map((item) => item.value)).toEqual([
      '211.00',
      '210.00',
    ]);
    expect(
      reviewed.corrections.every(
        (item) =>
          item.extractionRunId === run.id && item.actorId === job.actorId,
      ),
    ).toBe(true);
    await runtime.process(job);
    await runtime.process(job);
    expect(
      await prisma.extractionRun.count({ where: { documentId: initial.id } }),
    ).toBe(1);
    expect(
      await prisma.identityAuditEvent.count({
        where: { organizationId: org, action: 'document.extracted' },
      }),
    ).toBe(1);
    expect(
      (await request(`${path(org, initial.id)}/download`, owner)).rawPayload,
    ).toEqual(carrierPdf);
    expect(JSON.stringify(reviewed)).not.toContain(stored.storageKey);
  });

  it('deduplicates concurrent same-tenant bytes without disclosing another tenant duplicate', async () => {
    const alice = await verifiedUser();
    const bob = await verifiedUser();
    const orgA = await organization(alice);
    const orgB = await organization(bob);
    const responses = await Promise.all([
      upload(orgA, alice),
      upload(orgA, alice),
    ]);
    expect(responses.map((item) => item.statusCode).sort()).toEqual([200, 201]);
    const ids = responses.map(
      (item) => documentDetailSchema.parse(body(item)).id,
    );
    expect(new Set(ids).size).toBe(1);
    expect(
      await prisma.document.count({ where: { organizationId: orgA } }),
    ).toBe(1);
    expect(
      await prisma.documentOutbox.count({ where: { organizationId: orgA } }),
    ).toBe(1);
    const independent = await created(orgB, bob);
    expect(independent.id).not.toBe(ids[0]);
    expect(independent.sha256).toBe(
      createHash('sha256').update(carrierPdf).digest('hex'),
    );
  });

  it('rejects invalid intake before creating document or outbox intent', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const oversized = Buffer.alloc(DOCUMENT_MAX_BYTES + 1, 32);
    oversized.write('%PDF-1.7');
    const inputs = [
      {
        bytes: Buffer.from('not a PDF'),
        name: 'invalid.pdf',
        headers: {},
        status: 400,
      },
      {
        bytes: carrierPdf,
        name: 'carrier.pdf',
        headers: { 'content-type': 'text/plain' },
        status: 415,
      },
      { bytes: oversized, name: 'large.pdf', headers: {}, status: 413 },
      {
        bytes: carrierPdf,
        name: 'bad\r\nInjected.pdf',
        headers: {},
        status: 400,
      },
      {
        bytes: carrierPdf,
        name: 'carrier.pdf',
        headers: { 'x-document-filename': '%ZZ' },
        status: 400,
      },
      {
        bytes: carrierPdf,
        name: 'carrier.pdf',
        headers: { 'x-document-kind': 'unsupported' },
        status: 400,
      },
      {
        bytes: carrierPdf,
        name: '../../traversal.pdf',
        headers: {},
        status: 400,
      },
      {
        bytes: carrierPdf,
        name: 'carrier.pdf',
        headers: { origin: 'https://evil.example.invalid' },
        status: 403,
      },
    ];
    for (const input of inputs) {
      const response = await upload(
        org,
        owner,
        input.bytes,
        input.name,
        input.headers,
      );
      expect(response.statusCode, response.body).toBe(input.status);
    }
    expect(
      await prisma.document.count({ where: { organizationId: org } }),
    ).toBe(0);
    expect(
      await prisma.documentOutbox.count({ where: { organizationId: org } }),
    ).toBe(0);
  });

  it('enforces tenant, current membership and viewer permissions on every document route', async () => {
    const owner = await verifiedUser();
    const outsider = await verifiedUser();
    const viewer = await verifiedUser();
    const org = await organization(owner);
    const otherOrg = await organization(outsider);
    expect(
      (await accept(viewer, await invite(owner, org, viewer, 'viewer')))
        .statusCode,
    ).toBe(200);
    const doc = await created(org, owner);
    await processDocument(doc.id);
    const current = await detail(org, doc.id, owner);
    if (!current.latestRun) throw new Error('Expected latest extraction');
    const correction = {
      extractionRunId: current.latestRun.id,
      field: 'total',
      value: '999.00',
      reason: 'Unauthorized mutation probe',
    };
    expect((await detail(org, doc.id, viewer)).capabilities.canWrite).toBe(
      false,
    );
    expect(
      (await request(`${path(org, doc.id)}/download`, viewer)).rawPayload,
    ).toEqual(carrierPdf);
    expect((await upload(org, viewer)).statusCode).toBe(403);
    expect(
      (await request(`${path(org, doc.id)}/corrections`, viewer, correction))
        .statusCode,
    ).toBe(403);
    expect(
      (await request(`${path(org, doc.id)}/retry`, viewer, {})).statusCode,
    ).toBe(403);
    for (const [organizationId, actor] of [
      [org, outsider],
      [otherOrg, outsider],
    ] as const) {
      for (const suffix of ['', '/download'])
        rejected(
          await request(`${path(organizationId, doc.id)}${suffix}`, actor),
        );
      rejected(
        await request(
          `${path(organizationId, doc.id)}/corrections`,
          actor,
          correction,
        ),
      );
      rejected(
        await request(`${path(organizationId, doc.id)}/retry`, actor, {}),
      );
    }
    rejected(await request(path(org), outsider));
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
    for (const endpoint of [
      path(org),
      path(org, doc.id),
      `${path(org, doc.id)}/download`,
    ])
      rejected(await request(endpoint, viewer));
    rejected(await upload(org, viewer));
    rejected(
      await request(`${path(org, doc.id)}/corrections`, viewer, correction),
    );
    rejected(await request(`${path(org, doc.id)}/retry`, viewer, {}));
    expect(
      await prisma.documentCorrection.count({ where: { documentId: doc.id } }),
    ).toBe(0);
  });

  it('reports malformed and textless PDF limits honestly and retains original bytes', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const malformed = Buffer.from('%PDF-1.7\ntruncated synthetic file');
    const bad = await created(org, owner, malformed, 'truncated.pdf');
    await processDocument(bad.id);
    const failed = await detail(org, bad.id, owner);
    expect(failed.status).toBe('failed');
    expect(failed.latestRun?.result).toBeNull();
    expect(failed.errorCode).toBe('PDF_INVALID');
    expect(
      (await request(`${path(org, bad.id)}/download`, owner)).rawPayload,
    ).toEqual(malformed);
    const blank = await created(org, owner, makePdf([]), 'textless.pdf');
    await processDocument(blank.id);
    const noText = await detail(org, blank.id, owner);
    expect(noText.status).toBe('needs_review');
    expect(noText.errorCode).toBe('OCR_UNSUPPORTED');
    expect(
      noText.latestRun?.result?.fields.every(
        (field) => field.value === null && field.status === 'missing',
      ),
    ).toBe(true);
    const operational = await created(
      org,
      owner,
      operationalPdf,
      'pickup-record.pdf',
    );
    await processDocument(operational.id);
    const missing = await detail(org, operational.id, owner);
    const total = missing.latestRun?.result?.fields.find(
      (field) => field.name === 'total',
    );
    expect(total?.value).toBeNull();
    expect(total?.status).toBe('missing');
    expect(total?.evidence).toBeNull();
  });

  it('blocks revoked queued actors, rejects forged job scope and retries as a new authorized immutable run', async () => {
    const owner = await verifiedUser();
    const analyst = await verifiedUser();
    const org = await organization(owner);
    expect(
      (await accept(analyst, await invite(owner, org, analyst, 'analyst')))
        .statusCode,
    ).toBe(200);
    const initial = await created(org, analyst);
    const job = await jobFor(initial.id);
    await expect(
      runtime.process({ ...job, organizationId: randomUUID() }),
    ).rejects.toMatchObject({ code: 'INVALID_JOB' });
    expect((await detail(org, initial.id, owner)).status).toBe('queued');
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
    await runtime.process(job);
    const blocked = await detail(org, initial.id, owner);
    expect(blocked.status).toBe('blocked');
    expect(blocked.errorCode).toBe('ACCESS_REVOKED');
    expect(blocked.latestRun?.result).toBeNull();
    const retry = await request(`${path(org, initial.id)}/retry`, owner, {});
    expect(retry.statusCode, retry.body).toBe(202);
    const queued = documentDetailSchema.parse(body(retry));
    expect(queued.latestRun?.version).toBe(2);
    expect(queued.latestRun?.id).not.toBe(job.runId);
    expect(
      (await request(`${path(org, initial.id)}/retry`, owner, {})).statusCode,
    ).toBe(409);
    await processDocument(initial.id);
    expect((await detail(org, initial.id, owner)).status).toBe('needs_review');
    expect(
      (
        await prisma.extractionRun.findUniqueOrThrow({
          where: { id: job.runId },
        })
      ).status,
    ).toBe('blocked');
    expect(
      (
        await request(`${path(org, initial.id)}/corrections`, owner, {
          extractionRunId: job.runId,
          field: 'total',
          value: '1',
          reason: 'Stale run probe',
        })
      ).statusCode,
    ).toBe(409);
  });

  it('recovers durable intent after the published Redis job is lost and processes through BullMQ', async () => {
    const owner = await verifiedUser();
    const org = await organization(owner);
    const doc = await created(org, owner);
    const job = await jobFor(doc.id);
    await runtime.dispatch();
    const published = await runtime.queue.getJob(job.outboxId);
    expect(published).toBeDefined();
    if (!published)
      throw new Error('Production dispatcher must publish the outbox job');
    await published.remove();
    await prisma.documentOutbox.update({
      where: { id: job.outboxId },
      data: { lastEnqueuedAt: new Date(Date.now() - 120000) },
    });
    await runtime.dispatch();
    expect(await runtime.queue.getJob(job.outboxId)).toBeDefined();
    await runtime.worker.resume();
    try {
      await expect
        .poll(async () => (await detail(org, doc.id, owner)).status, {
          timeout: 20000,
          interval: 100,
        })
        .toBe('needs_review');
      expect(
        (
          await prisma.documentOutbox.findUniqueOrThrow({
            where: { id: job.outboxId },
          })
        ).completedAt,
      ).not.toBeNull();
      expect(
        await prisma.extractionRun.count({ where: { documentId: doc.id } }),
      ).toBe(1);
    } finally {
      await runtime.worker.pause(true);
    }
    const list = await request(path(org), owner);
    expect(list.statusCode, list.body).toBe(200);
    expect(
      documentListSchema
        .parse(body(list))
        .items.some(
          (item) => item.id === doc.id && item.status === 'needs_review',
        ),
    ).toBe(true);
  });
});

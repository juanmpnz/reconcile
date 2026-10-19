import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { createPrivateDocumentStorage } from '@reconcile/document-processing';
import { parseServiceConfig } from '@reconcile/config';
import { processDocumentRun, processAnalysisRun } from '@reconcile/application';
import {
  documentDetailSchema,
  operationDetailSchema,
  analysisRunSchema,
  operationReviewSchema,
  claimDetailSchema,
} from '@reconcile/contracts';
import {
  useIdentityFixture,
  body,
  type Browser,
} from './support/identity-fixture.js';
describe('reviewed claims through actual identity, PDF extraction, persisted analysis and HTTP', () => {
  let storage: ReturnType<typeof createPrivateDocumentStorage>;
  const f = useIdentityFixture({
    addressPrefix: '198.18.0',
    beforeCleanup: async () => {
      if (storage) {
        for (const d of await f.prisma.document.findMany({
          where: { organizationId: { in: [...f.organizationIds] } },
        }))
          await storage.remove(d.storageKey);
        storage.close();
      }
    },
  });
  const { prisma, request, verifiedUser, organization, invite, accept } = f;
  const base = (org: string, op: string) =>
    `/api/v1/organizations/${org}/operations/${op}`;
  beforeAll(() => {
    storage = createPrivateDocumentStorage(parseServiceConfig(process.env));
  });
  async function mutate(
    method: 'PATCH' | 'PUT',
    url: string,
    actor: Browser,
    payload: Record<string, unknown>,
  ) {
    return f.app.inject({
      method,
      url,
      remoteAddress: actor.address,
      headers: {
        origin: f.origin,
        cookie: [...actor.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      payload,
    });
  }
  async function review(org: string, op: string, actor: Browser) {
    const r = await request(base(org, op) + '/review', actor);
    expect(r.statusCode, r.body).toBe(200);
    return operationReviewSchema.parse(body(r));
  }
  async function analyzed(org: string, op: string, actor: Browser) {
    const r = await request(base(org, op) + '/analyses', actor, {
      idempotencyKey: randomUUID(),
    });
    expect(r.statusCode, r.body).toBe(202);
    const run = analysisRunSchema.parse(body(r));
    const outbox = await prisma.analysisOutbox.findFirstOrThrow({
      where: { runId: run.id },
    });
    await processAnalysisRun({
      prisma,
      payload: {
        outboxId: outbox.id,
        organizationId: org,
        operationId: op,
        runId: run.id,
        actorId: outbox.actorId,
      },
    });
    return analysisRunSchema.parse(
      body(await request(base(org, op) + `/analyses/${run.id}`, actor)),
    );
  }
  async function dossier() {
    const owner = await verifiedUser(),
      org = await organization(owner);
    const docs: string[] = [];
    for (const [name, kind] of [
      ['carrier-invoice', 'invoice'],
      ['transport-invoice', 'invoice'],
      ['carrier-agreement', 'tariff'],
      ['pickup-record', 'operational'],
    ]) {
      const bytes = readFileSync(
        new URL(
          `../../../fixtures/logistics/source-documents/${name}.pdf`,
          import.meta.url,
        ),
      );
      const response = await f.app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${org}/documents`,
        remoteAddress: owner.address,
        headers: {
          origin: f.origin,
          cookie: [...owner.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          'content-type': 'application/pdf',
          'x-document-kind': kind,
          'x-document-filename': name + '.pdf',
        },
        payload: bytes,
      });
      expect(response.statusCode, response.body).toBe(201);
      const doc = documentDetailSchema.parse(body(response));
      docs.push(doc.id);
      const outbox = await prisma.documentOutbox.findFirstOrThrow({
        where: { documentId: doc.id },
      });
      await processDocumentRun({
        prisma,
        storage,
        payload: {
          outboxId: outbox.id,
          organizationId: org,
          documentId: doc.id,
          runId: outbox.runId,
          actorId: outbox.actorId,
        },
      });
    }
    const op = operationDetailSchema.parse(
      body(
        await request(`/api/v1/organizations/${org}/operations`, owner, {
          name: 'Reviewed claim test',
          reference: 'OP-DEMO-062',
        }),
      ),
    );
    const linked = await mutate('PUT', base(org, op.id) + '/documents', owner, {
      documentIds: docs,
      expectedFingerprint: op.fingerprint,
    });
    expect(linked.statusCode, linked.body).toBe(200);
    const run = await analyzed(org, op.id, owner);
    const index =
      run.result?.findings.findIndex(
        (x) => x.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER',
      ) ?? -1;
    expect(index).toBeGreaterThanOrEqual(0);
    return { owner, org, op: op.id, run, index };
  }
  async function confirm(
    org: string,
    op: string,
    runId: string,
    index: number,
    actor: Browser,
  ) {
    const r = await review(org, op, actor);
    const response = await request(
      base(org, op) + `/analyses/${runId}/decisions`,
      actor,
      {
        findingIndex: index,
        action: 'confirm',
        reason: 'Operador revisó las fuentes del mismo servicio',
        expectedVersion: r.version,
        expectedFingerprint: r.fingerprint,
      },
    );
    expect(response.statusCode, response.body).toBe(200);
    return operationReviewSchema.parse(body(response));
  }
  async function create(
    org: string,
    op: string,
    runId: string,
    index: number,
    actor: Browser,
  ) {
    const r = await review(org, op, actor);
    const response = await request(base(org, op) + '/claims', actor, {
      runId,
      findingIndex: index,
      expectedVersion: r.version,
      expectedFingerprint: r.fingerprint,
    });
    expect(response.statusCode, response.body).toBe(201);
    return claimDetailSchema.parse(body(response));
  }
  it('rejects a persisted legacy tariff finding as a financial review target without changing review history', async () => {
    const { owner, org, op, run, index } = await dossier();
    const tariff = run.snapshot.documents.find(
      (document) => document.kind === 'agreement',
    );
    const result = run.result;
    if (!tariff || !result)
      throw new Error('Synthetic legacy fixture requires agreement and result');
    // Model an older engine result that incorrectly targeted a reference source.
    // The API must not trust the finding shape as authority to review a tariff.
    await prisma.analysisRun.update({
      where: { id: run.id },
      data: {
        result: {
          ...result,
          findings: result.findings.map((finding, findingIndex) =>
            findingIndex === index
              ? { ...finding, documentId: tariff.documentId }
              : finding,
          ),
        },
      },
    });
    const before = await review(org, op, owner);
    const auditCount = await prisma.identityAuditEvent.count({
      where: { organizationId: org, action: 'finding.reviewed' },
    });
    const response = await request(
      base(org, op) + `/analyses/${run.id}/decisions`,
      owner,
      {
        findingIndex: index,
        action: 'confirm',
        reason: 'Attempt to review a legacy reference-source finding',
        expectedVersion: before.version,
        expectedFingerprint: before.fingerprint,
      },
    );
    expect(response.statusCode, response.body).toBe(422);
    expect(body(response).code).toBe('INVOICE_SOURCE_REQUIRED');
    const after = await review(org, op, owner);
    expect(after.version).toBe(before.version);
    expect(after.decisions).toEqual(before.decisions);
    expect(after.claims).toEqual(before.claims);
    expect(
      await prisma.identityAuditEvent.count({
        where: { organizationId: org, action: 'finding.reviewed' },
      }),
    ).toBe(auditCount);
  });

  it('keeps append-only human reviews, authoritative 62 USD draft, versioned exports and explicit manual follow-up', async () => {
    const { owner, org, op, run, index } = await dossier();
    const first = await review(org, op, owner);
    expect(
      (
        await request(base(org, op) + '/claims', owner, {
          runId: run.id,
          findingIndex: index,
          expectedVersion: first.version,
          expectedFingerprint: first.fingerprint,
        })
      ).statusCode,
    ).toBe(409);
    await confirm(org, op, run.id, index, owner);
    expect(
      analysisRunSchema.parse(
        body(await request(base(org, op) + `/analyses/${run.id}`, owner)),
      ).stale,
    ).toBe(false);
    let c = await create(org, op, run.id, index, owner);
    expect(c.amount).toBe('62');
    expect(c.kind).toBe('correction');
    expect(c.status).toBe('draft');
    expect(c.drafts[0]?.body).toContain('62');
    expect((await create(org, op, run.id, index, owner)).id).toBe(c.id);
    expect(await prisma.claim.count({ where: { organizationId: org } })).toBe(
      1,
    );
    const edit = await mutate(
      'PATCH',
      base(org, op) + `/claims/${c.id}`,
      owner,
      {
        expectedVersion: c.version,
        recipientEmail: 'billing@example.invalid',
        subject: 'Revisión de recogida',
        body: 'Solicitamos revisión de 62 USD con el respaldo adjunto.',
        reason: 'Redacción revisada manualmente',
      },
    );
    expect(edit.statusCode, edit.body).toBe(200);
    c = claimDetailSchema.parse(body(edit));
    expect(c.drafts).toHaveLength(2);
    expect(
      (
        await mutate('PATCH', base(org, op) + `/claims/${c.id}`, owner, {
          expectedVersion: 1,
          recipientEmail: null,
          subject: 'Stale',
          body: 'Stale',
          reason: 'Stale',
        })
      ).statusCode,
    ).toBe(409);
    const editPayload = {
      expectedVersion: c.version,
      recipientEmail: 'billing@example.invalid',
      subject: 'Borrador concurrente',
      body: 'Revisión de 62 USD.',
      reason: 'Control de concurrencia',
    };
    const edits = await Promise.all([
      mutate('PATCH', base(org, op) + `/claims/${c.id}`, owner, editPayload),
      mutate('PATCH', base(org, op) + `/claims/${c.id}`, owner, {
        ...editPayload,
        subject: 'Otro borrador concurrente',
      }),
    ]);
    expect(edits.map((e) => e.statusCode).sort()).toEqual([200, 409]);
    c = claimDetailSchema.parse(
      body(await request(base(org, op) + `/claims/${c.id}`, owner)),
    );
    const exportedDraft = c.drafts[0];
    const exported = await request(
      base(org, op) + `/claims/${c.id}/export`,
      owner,
      { expectedVersion: c.version, format: 'dossier' },
    );
    expect(exported.statusCode, exported.body).toBe(200);
    expect(exported.headers['content-disposition']).toContain('attachment');
    expect(exported.headers['cache-control']).toContain('no-store');
    expect(exported.body).toContain('reconcile-claim-v1');
    expect(exported.body).not.toMatch(/https?:\/\//);
    c = claimDetailSchema.parse(
      body(await request(base(org, op) + `/claims/${c.id}`, owner)),
    );
    expect(c.status).toBe('exported');
    const raceVersion = c.version;
    const exportRace = await Promise.all([
      mutate('PATCH', base(org, op) + `/claims/${c.id}`, owner, {
        expectedVersion: raceVersion,
        recipientEmail: 'billing@example.invalid',
        subject: 'Concurrent export edit',
        body: '62 USD reviewed',
        reason: 'Race edit versus export',
      }),
      request(base(org, op) + `/claims/${c.id}/export`, owner, {
        expectedVersion: raceVersion,
        format: 'text',
      }),
    ]);
    expect(exportRace.map((e) => e.statusCode).sort()).toEqual([200, 409]);
    c = claimDetailSchema.parse(
      body(await request(base(org, op) + `/claims/${c.id}`, owner)),
    );
    const artifact = c.exports.find((e) => e.format === 'dossier');
    if (!artifact) throw new Error('Persisted export required');
    const download = await request(
      base(org, op) + `/claims/${c.id}/exports/${artifact.id}`,
      owner,
    );
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload).toEqual(exported.rawPayload);
    expect(createHash('sha256').update(download.rawPayload).digest('hex')).toBe(
      artifact.sha256,
    );
    const dossierJson: unknown = JSON.parse(exported.body);
    expect(dossierJson).toMatchObject({
      draftId: exportedDraft?.id,
      draftVersion: exportedDraft?.version,
      source: {
        ruleVersion: run.ruleVersion,
        parserVersion: run.parserVersion,
        runVersion: run.version,
        documents: expect.arrayContaining([
          expect.objectContaining({
            filename: 'carrier-invoice.pdf',
            invoiceReference: 'CAR-DEMO-001',
          }),
        ]),
      },
    });
    expect(await prisma.claimExport.count({ where: { claimId: c.id } })).toBe(
      c.exports.length,
    );
    expect(c.events.some((e) => e.status === 'sent')).toBe(false);
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/events`, owner, {
          expectedVersion: c.version,
          status: 'sent',
          reason: 'Invalid historical date',
          occurredAt: '2000-01-01T00:00:00.000Z',
          dueDate: null,
          recipientConfirmed: true,
        })
      ).statusCode,
    ).toBe(400);
    const now = new Date().toISOString();
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/events`, owner, {
          expectedVersion: c.version,
          status: 'sent',
          reason: 'Registro manual',
          occurredAt: now,
          dueDate: null,
          recipientConfirmed: false,
        })
      ).statusCode,
    ).toBe(400);
    const sent = await request(
      base(org, op) + `/claims/${c.id}/events`,
      owner,
      {
        expectedVersion: c.version,
        status: 'sent',
        reason: 'Enviado manualmente por el operador fuera de Reconcile',
        occurredAt: now,
        dueDate: null,
        recipientConfirmed: true,
      },
    );
    expect(sent.statusCode, sent.body).toBe(200);
    c = claimDetailSchema.parse(body(sent));
    expect(c.status).toBe('sent');
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/export`, owner, {
          expectedVersion: c.version,
          format: 'text',
        })
      ).statusCode,
    ).toBe(409);
    const sentReview = await review(org, op, owner);
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/rebase`, owner, {
          expectedVersion: c.version,
          expectedReviewVersion: sentReview.version,
          expectedFingerprint: sentReview.fingerprint,
          runId: run.id,
          findingIndex: index,
          reason: 'Not allowed after sent',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/events`, owner, {
          expectedVersion: c.version,
          status: 'follow_up',
          reason: 'Missing date',
          occurredAt: now,
          dueDate: null,
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/events`, owner, {
          expectedVersion: c.version,
          status: 'in_review',
          reason: 'Future invalid',
          occurredAt: '2099-01-01T00:00:00.000Z',
          dueDate: null,
        })
      ).statusCode,
    ).toBe(400);
    const follow = await request(
      base(org, op) + `/claims/${c.id}/events`,
      owner,
      {
        expectedVersion: c.version,
        status: 'follow_up',
        reason: 'Esperando respuesta del proveedor',
        occurredAt: now,
        dueDate: '2026-01-01',
      },
    );
    expect(follow.statusCode, follow.body).toBe(200);
    c = claimDetailSchema.parse(body(follow));
    expect(c.dueDate).toBe('2026-01-01');
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/events`, owner, {
          expectedVersion: c.version,
          status: 'rejected',
          reason: 'Contradictory outcome must fail',
          occurredAt: now,
          dueDate: null,
          outcome: 'corrected',
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/events`, owner, {
          expectedVersion: c.version,
          status: 'resolved',
          reason: 'Contradictory outcome must fail',
          occurredAt: now,
          dueDate: null,
          outcome: 'rejected',
        })
      ).statusCode,
    ).toBe(400);
    const resolved = await request(
      base(org, op) + `/claims/${c.id}/events`,
      owner,
      {
        expectedVersion: c.version,
        status: 'resolved',
        reason:
          'Proveedor confirmó revisión; registro manual sin afirmar recuperación',
        occurredAt: now,
        dueDate: null,
        outcome: 'corrected',
      },
    );
    expect(resolved.statusCode, resolved.body).toBe(200);
    expect(claimDetailSchema.parse(body(resolved)).status).toBe('resolved');
    expect(
      await prisma.identityAuditEvent.count({
        where: { organizationId: org, action: 'claim.exported' },
      }),
    ).toBe(c.exports.length);
  });
  it('rejects stale exports, explicitly rebases the same invoice claim and preserves previous source versions', async () => {
    const { owner, org, op, run, index } = await dossier();
    await confirm(org, op, run.id, index, owner);
    let c = await create(org, op, run.id, index, owner);
    const beforeReverse = await review(org, op, owner);
    expect(
      (
        await request(base(org, op) + `/analyses/${run.id}/decisions`, owner, {
          findingIndex: index,
          action: 'dismiss',
          reason: 'Revisión posterior contradice confirmación',
          expectedVersion: beforeReverse.version,
          expectedFingerprint: beforeReverse.fingerprint,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/export`, owner, {
          expectedVersion: c.version,
          format: 'text',
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (await review(org, op, owner)).claims.find((x) => x.id === c.id)?.stale,
    ).toBe(true);
    expect(
      claimDetailSchema.parse(
        body(await request(base(org, op) + `/claims/${c.id}`, owner)),
      ).stale,
    ).toBe(true);
    await confirm(org, op, run.id, index, owner);
    const reconfirmed = await review(org, op, owner);
    expect(reconfirmed.claims.find((x) => x.id === c.id)?.stale).toBe(true);
    expect(
      claimDetailSchema.parse(
        body(await request(base(org, op) + `/claims/${c.id}`, owner)),
      ).stale,
    ).toBe(true);
    const originalSource = c.sources[0],
      originalDraft = c.drafts[0];
    const sameRunRebase = await request(
      base(org, op) + `/claims/${c.id}/rebase`,
      owner,
      {
        expectedVersion: c.version,
        expectedReviewVersion: reconfirmed.version,
        expectedFingerprint: reconfirmed.fingerprint,
        runId: run.id,
        findingIndex: index,
        reason:
          'Actualizar explícitamente la nueva confirmación del mismo análisis',
      },
    );
    expect(sameRunRebase.statusCode, sameRunRebase.body).toBe(200);
    c = claimDetailSchema.parse(body(sameRunRebase));
    expect(c.stale).toBe(false);
    expect(c.sources[1]).toEqual(originalSource);
    expect(c.drafts[1]).toEqual(originalDraft);
    expect(
      (await review(org, op, owner)).claims.find((x) => x.id === c.id)?.stale,
    ).toBe(false);
    const sameRunExport = await request(
      base(org, op) + `/claims/${c.id}/export`,
      owner,
      { expectedVersion: c.version, format: 'text' },
    );
    expect(sameRunExport.statusCode, sameRunExport.body).toBe(200);
    c = claimDetailSchema.parse(
      body(await request(base(org, op) + `/claims/${c.id}`, owner)),
    );
    const oldSource = c.sources[0];
    const oldDraft = c.drafts[0];
    const operation = operationDetailSchema.parse(
      body(await request(base(org, op), owner)),
    );
    expect(
      (
        await mutate('PATCH', base(org, op), owner, {
          name: 'Operation changed',
          reference: operation.reference,
          expectedFingerprint: operation.fingerprint,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request(base(org, op) + `/claims/${c.id}/export`, owner, {
          expectedVersion: c.version,
          format: 'text',
        })
      ).statusCode,
    ).toBe(409);
    const next = await analyzed(org, op, owner);
    await confirm(org, op, next.id, index, owner);
    expect((await create(org, op, next.id, index, owner)).id).toBe(c.id);
    const r = await review(org, op, owner);
    const rebased = await request(
      base(org, op) + `/claims/${c.id}/rebase`,
      owner,
      {
        runId: next.id,
        findingIndex: index,
        expectedVersion: c.version,
        expectedReviewVersion: r.version,
        expectedFingerprint: r.fingerprint,
        reason: 'Revisión explícita del nuevo análisis',
      },
    );
    expect(rebased.statusCode, rebased.body).toBe(200);
    c = claimDetailSchema.parse(body(rebased));
    expect(c.sources).toHaveLength(3);
    expect(c.sources[1]).toEqual(oldSource);
    expect(c.drafts[1]).toEqual(oldDraft);
    expect(c.runId).toBe(next.id);
    expect(c.amount).toBe('62');
    expect(c.stale).toBe(false);
  });
  it('separates clarification without money and protects tenant, reader, origin and current membership', async () => {
    const { owner, org, op, run, index } = await dossier();
    const unknown =
      run.result?.findings.findIndex((x) => x.status === 'not-verifiable') ??
      -1;
    expect(unknown).toBeGreaterThanOrEqual(0);
    await confirm(org, op, run.id, unknown, owner);
    const c = await create(org, op, run.id, unknown, owner);
    expect(c.kind).toBe('clarification');
    expect(c.amount).toBeNull();
    const viewer = await verifiedUser();
    expect(
      (await accept(viewer, await invite(owner, org, viewer))).statusCode,
    ).toBe(200);
    expect(
      (await request(base(org, op) + `/claims/${c.id}`, viewer)).statusCode,
    ).toBe(200);
    const r = await review(org, op, owner);
    expect(
      (
        await request(base(org, op) + `/analyses/${run.id}/decisions`, viewer, {
          findingIndex: index,
          action: 'confirm',
          reason: 'Denied',
          expectedVersion: r.version,
          expectedFingerprint: r.fingerprint,
        })
      ).statusCode,
    ).toBe(403);
    const foreign = await verifiedUser(),
      foreignOrg = await organization(foreign);
    expect(
      (await request(base(foreignOrg, op) + `/claims/${c.id}`, foreign))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await request(
          base(org, op) + `/claims/${c.id}/export`,
          owner,
          { expectedVersion: c.version, format: 'text' },
          'https://hostile.invalid',
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(
          base(org, op) + `/claims/${c.id}/export`,
          owner,
          { expectedVersion: c.version, format: 'text' },
          null,
        )
      ).statusCode,
    ).toBe(403);
    await prisma.member.deleteMany({
      where: { organizationId: org, user: { email: viewer.email } },
    });
    expect(
      (await request(base(org, op) + `/claims/${c.id}`, viewer)).statusCode,
    ).toBe(404);
  });
  it('serializes conflicting decisions and never accepts client monetary amounts', async () => {
    const { owner, org, op, run, index } = await dossier();
    const r = await review(org, op, owner);
    const url = base(org, op) + `/analyses/${run.id}/decisions`;
    const input = {
      findingIndex: index,
      reason: 'Concurrent human review',
      expectedVersion: r.version,
      expectedFingerprint: r.fingerprint,
    };
    const responses = await Promise.all([
      request(url, owner, { ...input, action: 'confirm' }),
      request(url, owner, { ...input, action: 'dismiss' }),
    ]);
    expect(responses.map((x) => x.statusCode).sort()).toEqual([200, 409]);
    const fresh = await confirm(org, op, run.id, index, owner);
    expect(fresh.decisions).toHaveLength(2);
    const arithmeticDocument = run.result?.findings[index]?.documentId;
    if (!arithmeticDocument) throw new Error('Invoice required');
    const doc = documentDetailSchema.parse(
      body(
        await request(
          `/api/v1/organizations/${org}/documents/${arithmeticDocument}`,
          owner,
        ),
      ),
    );
    expect(
      (
        await request(
          `/api/v1/organizations/${org}/documents/${arithmeticDocument}/corrections`,
          owner,
          {
            extractionRunId: doc.latestRun?.id,
            field: 'total',
            value: '211.00',
            reason: 'Arithmetic negative case',
          },
        )
      ).statusCode,
    ).toBe(201);
    const arithmetic = await analyzed(org, op, owner);
    const arithmeticIndex =
      arithmetic.result?.findings.findIndex(
        (x) => x.code === 'TOTAL_INCONSISTENT',
      ) ?? -1;
    expect(arithmeticIndex).toBeGreaterThanOrEqual(0);
    await confirm(org, op, arithmetic.id, arithmeticIndex, owner);
    const arithmeticReview = await review(org, op, owner);
    expect(
      (
        await request(base(org, op) + '/claims', owner, {
          runId: arithmetic.id,
          findingIndex: arithmeticIndex,
          expectedVersion: arithmeticReview.version,
          expectedFingerprint: arithmeticReview.fingerprint,
        })
      ).statusCode,
    ).toBe(422);

    let inputs = operationDetailSchema.parse(
      body(await request(base(org, op), owner)),
    );
    const invoiceFact = inputs.facts.find(
      (x) => x.documentId === arithmeticDocument,
    );
    if (!invoiceFact) throw new Error('Invoice facts required');
    expect(
      (
        await request(base(org, op) + '/fact-revisions', owner, {
          expectedFingerprint: inputs.fingerprint,
          document: { ...invoiceFact, taxAmount: '1' },
          reason: 'Tax control negative case',
        })
      ).statusCode,
    ).toBe(200);
    const taxRun = await analyzed(org, op, owner);
    const taxIndex =
      taxRun.result?.findings.findIndex(
        (x) => x.code === 'TAX_REVIEW_REQUIRED',
      ) ?? -1;
    expect(taxIndex).toBeGreaterThanOrEqual(0);
    await confirm(org, op, taxRun.id, taxIndex, owner);
    let negativeReview = await review(org, op, owner);
    expect(
      (
        await request(base(org, op) + '/claims', owner, {
          runId: taxRun.id,
          findingIndex: taxIndex,
          expectedVersion: negativeReview.version,
          expectedFingerprint: negativeReview.fingerprint,
        })
      ).statusCode,
    ).toBe(422);
    inputs = operationDetailSchema.parse(
      body(await request(base(org, op), owner)),
    );
    expect(
      (
        await mutate('PATCH', base(org, op), owner, {
          name: inputs.name,
          reference: 'OTHER-OPERATION',
          expectedFingerprint: inputs.fingerprint,
        })
      ).statusCode,
    ).toBe(200);
    const mismatchRun = await analyzed(org, op, owner);
    const mismatchIndex =
      mismatchRun.result?.findings.findIndex(
        (x) =>
          x.code === 'OPERATION_MISMATCH' &&
          x.documentId === arithmeticDocument,
      ) ?? -1;
    expect(mismatchIndex).toBeGreaterThanOrEqual(0);
    await confirm(org, op, mismatchRun.id, mismatchIndex, owner);
    negativeReview = await review(org, op, owner);
    expect(
      (
        await request(base(org, op) + '/claims', owner, {
          runId: mismatchRun.id,
          findingIndex: mismatchIndex,
          expectedVersion: negativeReview.version,
          expectedFingerprint: negativeReview.fingerprint,
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (
        await request(base(org, op) + '/claims', owner, {
          runId: run.id,
          findingIndex: index,
          expectedVersion: fresh.version,
          expectedFingerprint: fresh.fingerprint,
          amount: '999999',
        })
      ).statusCode,
    ).toBe(400);
  });
  it('makes existing claims stale after a document rename without changing the historical source or draft', async () => {
    const { owner, org, op, run, index } = await dossier();
    await confirm(org, op, run.id, index, owner);
    const claim = await create(org, op, run.id, index, owner);
    const doc = run.snapshot.documents.find(
      (doc) => doc.documentId === run.result?.findings[index]?.documentId,
    );
    if (!doc) throw new Error('Invoice required');
    const renamed = await mutate(
      'PATCH',
      `/api/v1/organizations/${org}/documents/${doc.documentId}`,
      owner,
      {
        filename: 'Reviewed-display-name.pdf',
        kind: 'invoice',
        expectedMetadataVersion: 0,
        reason: 'Correct visible document label',
      },
    );
    expect(renamed.statusCode, renamed.body).toBe(200);
    const after = claimDetailSchema.parse(
      body(await request(base(org, op) + `/claims/${claim.id}`, owner)),
    );
    expect(after.stale).toBe(true);
    expect(after.sources).toEqual(claim.sources);
    expect(after.drafts).toEqual(claim.drafts);
    expect(
      (
        await request(base(org, op) + `/claims/${claim.id}/export`, owner, {
          expectedVersion: claim.version,
          format: 'text',
        })
      ).statusCode,
    ).toBe(409);
  });
});

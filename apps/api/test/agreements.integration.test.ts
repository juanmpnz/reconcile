import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { processAnalysisRun } from '@reconcile/application';
import {
  agreementVersionSchema,
  agreementListSchema,
  operationDetailSchema,
  analysisRunSchema,
  extractionResultSchema,
} from '@reconcile/contracts';
import {
  useIdentityFixture,
  body,
  type Browser,
} from './support/identity-fixture.js';

// Exercise actual HTTP auth, tenant authorization, PostgreSQL constraints and immutable jobs.
// Source extraction is seeded deterministically to isolate reviewed commercial terms from PDF parsing.
describe('reviewed reusable and spot agreements through authenticated API and PostgreSQL', () => {
  const fixture = useIdentityFixture({ addressPrefix: '192.0.44' });
  const { prisma, request, verifiedUser, organization } = fixture;
  const base = (org: string) => `/api/v1/organizations/${org}`;
  async function seed(
    org: string,
    actorId: string,
    kind: 'invoice' | 'tariff',
    provider = 'Traginers',
  ) {
    const id = randomUUID(),
      runId = randomUUID();
    const page =
      kind === 'tariff'
        ? `${provider} annual accepted contract. Barcelona. Valid from 2026-01-01 until 2026-12-31. Pickup 0 to 30 km: 2 EUR per km.`
        : `${provider}\nOperation: OP-AGREEMENT\nCurrency: EUR\nTotal: 50.00\nService date: 2026-06-15\nRoute: Barcelona\nPickup - Barcelona 25 km 2.00 50.00`;
    await prisma.document.create({
      data: {
        id,
        organizationId: org,
        filename: id + '.pdf',
        kind,
        sizeBytes: 200,
        sha256: id.replaceAll('-', '').repeat(2),
        storageKey: `${org}/${id}`,
        uploadedBy: actorId,
        status: 'ready',
      },
    });
    await prisma.extractionRun.create({
      data: {
        id: runId,
        organizationId: org,
        documentId: id,
        actorId,
        version: 1,
        status: 'ready',
        result: {
          engine: 'pdfjs-text-v1',
          pages: [{ page: 1, text: page }],
          fields: [
            {
              name: 'provider',
              value: provider,
              evidence: { page: 1, snippet: provider },
              status: 'extracted',
            },
            {
              name: 'operationReference',
              value: 'OP-AGREEMENT',
              evidence: null,
              status: 'extracted',
            },
            {
              name: 'currency',
              value: 'EUR',
              evidence: null,
              status: 'extracted',
            },
            {
              name: 'total',
              value: '50.00',
              evidence: null,
              status: 'extracted',
            },
          ],
          warnings: [],
        },
      },
    });
    await prisma.document.update({
      where: { id },
      data: { currentRunId: runId, runCount: 1 },
    });
    return { id, runId, page };
  }
  async function op(
    org: string,
    who: Browser,
    ids: string[],
    reference = 'OP-' + randomUUID(),
  ) {
    const response = await request(base(org) + '/operations', who, {
      reference,
      name: 'Agreement integration',
    });
    expect(response.statusCode, response.body).toBe(201);
    const created = operationDetailSchema.parse(body(response));
    const linked = await put(org, created.id, who, 'documents', {
      expectedFingerprint: created.fingerprint,
      documentIds: ids,
    });
    expect(linked.statusCode, linked.body).toBe(200);
    return operationDetailSchema.parse(body(linked));
  }
  async function put(
    org: string,
    opId: string,
    who: Browser,
    path: string,
    payload: Record<string, unknown>,
    origin = fixture.origin,
  ) {
    return fixture.app.inject({
      method: 'PUT',
      url: base(org) + `/operations/${opId}/${path}`,
      remoteAddress: who.address,
      headers: {
        origin,
        cookie: [...who.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      payload,
    });
  }
  function createInput(
    source: Awaited<ReturnType<typeof seed>>,
    scope: 'reusable' | 'spot' = 'reusable',
    operationId: string | null = null,
  ) {
    const evidence = {
      documentId: source.id,
      extractionRunId: source.runId,
      page: 1,
      snippet: source.page,
    };
    return {
      name: 'Traginers 2026',
      scope,
      operationId,
      sourceDocumentId: source.id,
      reason: 'Reviewed accepted signed contract',
      terms: {
        agreementBasis: 'accepted',
        applicability: {
          dateBasis: 'service-date',
          provider: {
            state: 'restricted',
            value: 'Traginers',
            evidence: [{ ...evidence, revisionId: null }],
          },
          service: {
            state: 'restricted',
            value: 'pickup',
            evidence: [{ ...evidence, revisionId: null }],
          },
          contractingParty: {
            state: 'unrestricted',
            value: null,
            evidence: [{ ...evidence, revisionId: null }],
          },
          origin: {
            state: 'unrestricted',
            value: null,
            evidence: [{ ...evidence, revisionId: null }],
          },
          destination: {
            state: 'unrestricted',
            value: null,
            evidence: [{ ...evidence, revisionId: null }],
          },
          transportMode: {
            state: 'unrestricted',
            value: null,
            evidence: [{ ...evidence, revisionId: null }],
          },
          equipmentType: {
            state: 'unrestricted',
            value: null,
            evidence: [{ ...evidence, revisionId: null }],
          },
          restrictions: [],
        },
        provider: 'Traginers',
        currency: 'EUR',
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        route: 'Barcelona',
        service: 'pickup',
        pricing: {
          type: 'distance-bands',
          bands: [
            {
              fromKm: '0',
              toKm: '30',
              basis: 'per-km',
              amount: '2',
              evidence: [evidence],
            },
          ],
        },
        evidence: [evidence],
      },
    };
  }
  it('publishes once, reuses across operations, pins provenance, preserves bindings when adding files and invalidates history on reselection', async () => {
    const who = await verifiedUser(),
      org = await organization(who);
    const member = await prisma.member.findFirstOrThrow({
      where: { organizationId: org },
    });
    const tariff = await seed(org, member.userId, 'tariff'),
      invoice = await seed(org, member.userId, 'invoice');
    const published = await request(
      base(org) + '/agreements',
      who,
      createInput(tariff),
    );
    expect(published.statusCode, published.body).toBe(201);
    const agreement = agreementVersionSchema.parse(body(published));
    const list = await request(base(org) + '/agreements', who);
    expect(
      agreementListSchema.parse(body(list)).items.map((v) => v.id),
    ).toContain(agreement.id);
    const first = await op(org, who, [invoice.id, tariff.id], 'OP-AGREEMENT');
    const second = await op(org, who, [invoice.id]);
    const binding = {
      invoiceDocumentId: invoice.id,
      agreementVersionId: agreement.id,
      serviceDate: '2026-06-15',
      route: 'Barcelona',
      distanceKm: '25',
    };
    const selection = await put(org, first.id, who, 'agreements', {
      expectedFingerprint: first.fingerprint,
      reason: 'Apply annual agreement',
      bindings: [binding],
    });
    expect(selection.statusCode, selection.body).toBe(200);
    let current = operationDetailSchema.parse(body(selection));
    expect(current.fingerprint).not.toBe(first.fingerprint);
    expect(current.agreementBindings[0]?.selectedBy).toBe(member.userId);
    expect(current.agreementBindings[0]?.selectionReason).toBe(
      'Apply annual agreement',
    );
    expect(current.agreementBindings[0]?.agreement.sourceExtractionRunId).toBe(
      tariff.runId,
    );
    const reused = await put(org, second.id, who, 'agreements', {
      expectedFingerprint: second.fingerprint,
      reason: 'Reuse annual agreement',
      bindings: [binding],
    });
    expect(reused.statusCode, reused.body).toBe(200);
    const noOp = await put(org, first.id, who, 'agreements', {
      expectedFingerprint: current.fingerprint,
      reason: 'Same selection',
      bindings: [binding],
    });
    expect(operationDetailSchema.parse(body(noOp)).fingerprint).toBe(
      current.fingerprint,
    );
    const requested = await request(
      base(org) + `/operations/${first.id}/analyses`,
      who,
      { idempotencyKey: randomUUID() },
    );
    expect(requested.statusCode, requested.body).toBe(202);
    const run = analysisRunSchema.parse(body(requested));
    expect(run.snapshot.agreementBindings?.[0]?.agreement.id).toBe(
      agreement.id,
    );
    expect(
      run.sources.some(
        (s) => s.documentId === tariff.id && s.extractionRunId === tariff.runId,
      ),
    ).toBe(true);
    expect(
      (
        await put(org, first.id, who, 'agreements', {
          expectedFingerprint: current.fingerprint,
          reason: 'Cannot change in flight',
          bindings: [],
        })
      ).statusCode,
    ).toBe(409);
    const outbox = await prisma.analysisOutbox.findFirstOrThrow({
      where: { runId: run.id },
    });
    await processAnalysisRun({
      prisma,
      payload: {
        outboxId: outbox.id,
        organizationId: org,
        operationId: first.id,
        runId: run.id,
        actorId: member.userId,
      },
    });
    const completed = await request(
      base(org) + `/operations/${first.id}/analyses/${run.id}`,
      who,
    );
    const completedRun = analysisRunSchema.parse(body(completed));
    expect(completedRun.status).toBe('completed');
    expect(
      completedRun.result?.findings.some(
        (f) => f.status === 'matched' && f.expected === '50',
      ),
    ).toBe(true);
    // Re-extracting the original PDF cannot reinterpret an explicitly reviewed version.
    await prisma.document.update({
      where: { id: tariff.id },
      data: { metadataVersion: 2, correctionCount: 3 },
    });
    const pinned = operationDetailSchema.parse(
      body(await request(base(org) + `/operations/${first.id}`, who)),
    );
    expect(pinned.fingerprint).toBe(current.fingerprint);
    expect(pinned.agreementBindings[0]?.agreement.sourceMetadataVersion).toBe(
      0,
    );
    const replacementInput = createInput(tariff);
    replacementInput.name = 'Traginers reviewed replacement';
    replacementInput.terms.pricing.bands[0]!.amount = '1.5';
    const replacementResponse = await request(
      base(org) + '/agreements',
      who,
      replacementInput,
    );
    expect(replacementResponse.statusCode, replacementResponse.body).toBe(201);
    const replacement = agreementVersionSchema.parse(body(replacementResponse));
    const originalResult = completedRun.result;
    const reselected = await put(org, first.id, who, 'agreements', {
      expectedFingerprint: pinned.fingerprint,
      reason: 'Use newly reviewed replacement terms',
      bindings: [{ ...binding, agreementVersionId: replacement.id }],
    });
    expect(reselected.statusCode, reselected.body).toBe(200);
    const replacementDetail = operationDetailSchema.parse(body(reselected));
    expect(replacementDetail.fingerprint).not.toBe(pinned.fingerprint);
    expect(replacementDetail.analyses[0]?.stale).toBe(true);
    const oldRunAfterReselection = analysisRunSchema.parse(
      body(
        await request(
          base(org) + `/operations/${first.id}/analyses/${run.id}`,
          who,
        ),
      ),
    );
    expect(
      oldRunAfterReselection.snapshot.agreementBindings?.[0]?.agreement.id,
    ).toBe(agreement.id);
    expect(oldRunAfterReselection.result).toEqual(originalResult);
    const audit = await prisma.identityAuditEvent.findFirstOrThrow({
      where: { organizationId: org, action: 'operation.agreements.updated' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.details).toMatchObject({
      operationId: first.id,
      reason: 'Use newly reviewed replacement terms',
      after: [
        {
          invoiceDocumentId: invoice.id,
          agreementVersionId: replacement.id,
          serviceDate: '2026-06-15',
          route: 'Barcelona',
          distanceKm: '25',
        },
      ],
    });
    const extra = await seed(org, member.userId, 'invoice', 'Other carrier');
    const more = await put(org, first.id, who, 'documents', {
      expectedFingerprint: replacementDetail.fingerprint,
      documentIds: [invoice.id, extra.id],
    });
    expect(more.statusCode, more.body).toBe(200);
    current = operationDetailSchema.parse(body(more));
    expect(current.agreementBindings).toHaveLength(1);
    expect(current.analyses[0]?.stale).toBe(true);
    const removed = await put(org, first.id, who, 'documents', {
      expectedFingerprint: current.fingerprint,
      documentIds: [extra.id],
    });
    expect(
      operationDetailSchema.parse(body(removed)).agreementBindings,
    ).toHaveLength(0);
    const preserved = await prisma.analysisRun.findUniqueOrThrow({
      where: { id: run.id },
    });
    expect(
      analysisRunSchema.shape.snapshot.parse(preserved.snapshot)
        .agreementBindings?.[0]?.agreement.terms.pricing,
    ).toEqual(agreement.terms.pricing);
    await expect(
      prisma.agreementVersion.update({
        where: { id: agreement.id },
        data: { name: 'Rewrite immutable history' },
      }),
    ).rejects.toThrow();
  });
  it('keeps publication with omitted applicability pending instead of accepting missing dimensions as unrestricted', async () => {
    const who = await verifiedUser(),
      org = await organization(who);
    const member = await prisma.member.findFirstOrThrow({
      where: { organizationId: org },
    });
    const source = await seed(org, member.userId, 'tariff'),
      invoice = await seed(org, member.userId, 'invoice');
    const input = createInput(source);
    const published = await request(base(org) + '/agreements', who, {
      ...input,
      terms: { ...input.terms, applicability: undefined },
    });
    expect(published.statusCode, published.body).toBe(201);
    const agreement = agreementVersionSchema.parse(body(published));
    expect(agreement.terms.applicability?.equipmentType?.state).toBe('unknown');
    expect(agreement.terms.applicability?.contractingParty?.state).toBe(
      'unknown',
    );
    const operation = await op(org, who, [invoice.id], 'OP-AGREEMENT');
    const selected = await put(org, operation.id, who, 'agreements', {
      expectedFingerprint: operation.fingerprint,
      reason: 'Record choice with unknown conditions',
      bindings: [
        {
          invoiceDocumentId: invoice.id,
          agreementVersionId: agreement.id,
          serviceDate: '2026-06-15',
          route: 'Barcelona',
          distanceKm: '25',
        },
      ],
    });
    expect(selected.statusCode, selected.body).toBe(200);
    const queued = analysisRunSchema.parse(
      body(
        await request(base(org) + `/operations/${operation.id}/analyses`, who, {
          idempotencyKey: randomUUID(),
        }),
      ),
    );
    const outbox = await prisma.analysisOutbox.findFirstOrThrow({
      where: { runId: queued.id },
    });
    await processAnalysisRun({
      prisma,
      payload: {
        outboxId: outbox.id,
        organizationId: org,
        operationId: operation.id,
        runId: queued.id,
        actorId: member.userId,
      },
    });
    const run = analysisRunSchema.parse(
      body(
        await request(
          base(org) + `/operations/${operation.id}/analyses/${queued.id}`,
          who,
        ),
      ),
    );
    expect(
      run.result?.agreementDecisions?.some(
        (decision) => decision.state === 'pending',
      ),
    ).toBe(true);
    expect(
      run.result?.findings.some(
        (finding) => finding.status === 'matched' && finding.expected === '50',
      ),
    ).toBe(false);
  });
  it('pins operational references from the publication source even when omitted from submitted terms', async () => {
    const who = await verifiedUser(),
      org = await organization(who);
    const member = await prisma.member.findFirstOrThrow({
      where: { organizationId: org },
    });
    const source = await seed(org, member.userId, 'tariff');
    const run = await prisma.extractionRun.findUniqueOrThrow({
      where: { id: source.runId },
    });
    const result = extractionResultSchema.parse(run.result);
    await prisma.extractionRun.update({
      where: { id: source.runId },
      data: {
        result: {
          ...result,
          pages: [
            { page: 1, text: source.page + '\nBooking reference: BOOK-SOURCE' },
          ],
        },
      },
    });
    const response = await request(
      base(org) + '/agreements',
      who,
      createInput(source),
    );
    expect(response.statusCode, response.body).toBe(201);
    const published = agreementVersionSchema.parse(body(response));
    expect(published.terms.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'booking', value: 'BOOK-SOURCE' }),
      ]),
    );
    const { applicability: explicitModel, ...legacyTerms } =
      createInput(source).terms;
    expect(explicitModel).toBeDefined();
    const legacy = await prisma.agreementVersion.create({
      data: {
        organizationId: org,
        name: 'Historical version without model',
        scope: 'reusable',
        sourceDocumentId: source.id,
        sourceExtractionRunId: source.runId,
        sourceSha256: source.id.replaceAll('-', '').repeat(2),
        sourceMetadataVersion: 0,
        sourceCorrectionRevision: 0,
        terms: legacyTerms,
        actorId: member.userId,
        reason: 'Legacy fixture',
      },
    });
    const newerRunId = randomUUID();
    await prisma.extractionRun.create({
      data: {
        id: newerRunId,
        organizationId: org,
        documentId: source.id,
        actorId: member.userId,
        version: 2,
        status: 'ready',
        result: {
          ...result,
          pages: [
            { page: 1, text: source.page + '\nBooking reference: BOOK-NEW' },
          ],
        },
      },
    });
    await prisma.document.update({
      where: { id: source.id },
      data: { currentRunId: newerRunId, runCount: 2 },
    });
    const invoice = await seed(org, member.userId, 'invoice');
    const operation = await op(org, who, [invoice.id], 'OP-AGREEMENT');
    const selection = await put(org, operation.id, who, 'agreements', {
      expectedFingerprint: operation.fingerprint,
      reason: 'Review legacy version',
      bindings: [
        {
          invoiceDocumentId: invoice.id,
          agreementVersionId: legacy.id,
          serviceDate: '2026-06-15',
          route: 'Barcelona',
          distanceKm: '25',
        },
      ],
    });
    expect(selection.statusCode, selection.body).toBe(200);
    const selected = operationDetailSchema.parse(body(selection))
      .agreementBindings[0]?.agreement;
    expect(selected?.terms.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'booking', value: 'BOOK-SOURCE' }),
      ]),
    );
    expect(
      selected?.terms.references?.some(
        (reference) => reference.value === 'BOOK-NEW',
      ),
    ).toBe(false);
    expect(selected?.terms.applicability?.equipmentType?.state).toBe('unknown');
    const storedLegacy = await prisma.agreementVersion.findUniqueOrThrow({
      where: { id: legacy.id },
    });
    expect(
      agreementVersionSchema.parse({
        ...storedLegacy,
        createdAt: storedLegacy.createdAt.toISOString(),
      }).terms.applicability,
    ).toBeUndefined();
  });
  it('records unknown and contradictory selections without certifying applicability, and audits user/time', async () => {
    const who = await verifiedUser(),
      org = await organization(who);
    const member = await prisma.member.findFirstOrThrow({
      where: { organizationId: org },
    });
    const source = await seed(org, member.userId, 'tariff'),
      invoice = await seed(org, member.userId, 'invoice');
    const published = await request(
      base(org) + '/agreements',
      who,
      createInput(source),
    );
    const agreement = agreementVersionSchema.parse(body(published));
    const target = await op(org, who, [invoice.id], 'OP-AGREEMENT');
    const selected = await put(org, target.id, who, 'agreements', {
      expectedFingerprint: target.fingerprint,
      reason: 'Missing context remains pending',
      bindings: [
        {
          invoiceDocumentId: invoice.id,
          agreementVersionId: agreement.id,
          serviceDate: null,
          route: null,
          distanceKm: null,
        },
      ],
    });
    expect(selected.statusCode, selected.body).toBe(200);
    const pending = operationDetailSchema.parse(body(selected));
    expect(pending.agreementBindings[0]).toMatchObject({
      serviceDate: null,
      route: null,
      selectedBy: member.userId,
      selectionReason: 'Missing context remains pending',
    });
    expect(pending.agreementBindings[0]?.selectedAt).toBeTruthy();
    const sameSelection = pending.agreementBindings[0];
    if (!sameSelection) throw new Error('Missing persisted selection');
    // Selecting another invoice must not rewrite the first confirmation.
    const extraInvoice = await seed(org, member.userId, 'invoice');
    const linkedResponse = await put(org, target.id, who, 'documents', {
      expectedFingerprint: pending.fingerprint,
      documentIds: [invoice.id, extraInvoice.id],
    });
    const linked = operationDetailSchema.parse(body(linkedResponse));
    const secondSelection = await put(org, target.id, who, 'agreements', {
      expectedFingerprint: linked.fingerprint,
      reason: 'Choose second invoice',
      bindings: [
        {
          invoiceDocumentId: invoice.id,
          agreementVersionId: agreement.id,
          serviceDate: null,
          route: null,
          distanceKm: null,
        },
        {
          invoiceDocumentId: extraInvoice.id,
          agreementVersionId: agreement.id,
          serviceDate: null,
          route: null,
          distanceKm: null,
        },
      ],
    });
    expect(secondSelection.statusCode, secondSelection.body).toBe(200);
    const both = operationDetailSchema.parse(body(secondSelection));
    expect(
      both.agreementBindings.find(
        (binding) => binding.invoiceDocumentId === invoice.id,
      ),
    ).toEqual(sameSelection);
    const contradicted = await put(org, target.id, who, 'agreements', {
      expectedFingerprint: both.fingerprint,
      reason: 'Preserve contradiction for engine review',
      bindings: [
        {
          invoiceDocumentId: invoice.id,
          agreementVersionId: agreement.id,
          serviceDate: '2027-01-01',
          route: 'Opposite direction',
          distanceKm: null,
        },
      ],
    });
    expect(contradicted.statusCode, contradicted.body).toBe(200);
    const current = operationDetailSchema.parse(body(contradicted));
    expect(current.fingerprint).not.toBe(pending.fingerprint);
    expect(current.agreementBindings[0]?.route).toBe('Opposite direction');
    const other = await verifiedUser(),
      otherOrg = await organization(other);
    expect(
      (
        await put(otherOrg, target.id, other, 'agreements', {
          expectedFingerprint: current.fingerprint,
          reason: 'Cross tenant',
          bindings: [],
        })
      ).statusCode,
    ).toBe(404);
  });
  it('rejects cross-tenant sources, fabricated evidence, untrusted writes, invalid pricing, spot reuse and stale selection', async () => {
    const who = await verifiedUser(),
      org = await organization(who);
    const other = await verifiedUser(),
      otherOrg = await organization(other);
    const member = await prisma.member.findFirstOrThrow({
      where: { organizationId: org },
    });
    const source = await seed(org, member.userId, 'tariff'),
      invoice = await seed(org, member.userId, 'invoice');
    const viewer = await verifiedUser();
    const invitation = await fixture.invite(who, org, viewer, 'viewer');
    expect((await fixture.accept(viewer, invitation)).statusCode).toBe(200);
    const input = createInput(source);
    expect(
      (await request(base(org) + '/agreements', viewer, input)).statusCode,
    ).toBe(403);
    expect((await request(base(org) + '/agreements', viewer)).statusCode).toBe(
      200,
    );
    const viewerMember = await prisma.member.findFirstOrThrow({
      where: { organizationId: org, user: { email: viewer.email } },
    });
    await prisma.member.delete({ where: { id: viewerMember.id } });
    expect((await request(base(org) + '/agreements', viewer)).statusCode).toBe(
      404,
    );
    expect(
      (await request(base(otherOrg) + '/agreements', other, input)).statusCode,
    ).toBe(404);
    const forged = createInput(source);
    forged.terms.evidence[0]!.snippet = 'Invented text not in source';
    expect(
      (await request(base(org) + '/agreements', who, forged)).statusCode,
    ).toBe(422);
    expect(
      (
        await request(
          base(org) + '/agreements',
          who,
          input,
          'https://evil.invalid',
        )
      ).statusCode,
    ).toBe(403);
    const badPrice = createInput(source);
    badPrice.terms.pricing.bands[0]!.amount = 'invalid';
    expect(
      (await request(base(org) + '/agreements', who, badPrice)).statusCode,
    ).toBe(400);
    const target = await op(org, who, [invoice.id]),
      another = await op(org, who, [invoice.id]);
    const spotResponse = await request(
      base(org) + '/agreements',
      who,
      createInput(source, 'spot', target.id),
    );
    expect(spotResponse.statusCode, spotResponse.body).toBe(201);
    const spot = agreementVersionSchema.parse(body(spotResponse));
    const binding = {
      invoiceDocumentId: invoice.id,
      agreementVersionId: spot.id,
      serviceDate: '2026-06-15',
      route: 'Barcelona',
      distanceKm: '25',
    };
    expect(
      (
        await put(org, another.id, who, 'agreements', {
          expectedFingerprint: another.fingerprint,
          reason: 'Wrong operation',
          bindings: [binding],
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (
        await put(org, target.id, who, 'agreements', {
          expectedFingerprint: '0'.repeat(64),
          reason: 'Stale edit',
          bindings: [binding],
        })
      ).statusCode,
    ).toBe(409);
    await prisma.document.update({
      where: { id: source.id },
      data: { kind: 'invoice' },
    });
    const linkedSource = await put(org, target.id, who, 'documents', {
      expectedFingerprint: target.fingerprint,
      documentIds: [invoice.id, source.id],
    });
    expect(linkedSource.statusCode, linkedSource.body).toBe(200);
    const linkedSourceDetail = operationDetailSchema.parse(body(linkedSource));
    expect(
      (
        await put(org, target.id, who, 'agreements', {
          expectedFingerprint: linkedSourceDetail.fingerprint,
          reason: 'Reject contract as own invoice',
          bindings: [{ ...binding, invoiceDocumentId: source.id }],
        })
      ).statusCode,
    ).toBe(422);
    const otherInvoice = await seed(org, member.userId, 'invoice', 'Other');
    await expect(
      prisma.agreementVersion.create({
        data: {
          organizationId: org,
          name: 'Invalid source FK',
          scope: 'reusable',
          sourceDocumentId: source.id,
          sourceExtractionRunId: otherInvoice.runId,
          sourceSha256: '0'.repeat(64),
          sourceMetadataVersion: 0,
          sourceCorrectionRevision: 0,
          terms: input.terms,
          actorId: member.userId,
          reason: 'Must reject unrelated extraction',
        },
      }),
    ).rejects.toThrow();
    // Composite DB foreign keys defend storage even outside the HTTP guard.
    await expect(
      prisma.operationAgreementBinding.create({
        data: {
          organizationId: otherOrg,
          operationId: target.id,
          invoiceDocumentId: invoice.id,
          agreementVersionId: spot.id,
          serviceDate: '2026-06-15',
          route: 'Barcelona',
        },
      }),
    ).rejects.toThrow();
  });
});

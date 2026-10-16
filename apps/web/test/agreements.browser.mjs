/* global URL, document, window, structuredClone */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
// Synthetic HTTP fixtures verify browser interactions, not backend authorization or extraction accuracy.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const org = id(1),
  op = id(2),
  user = id(3),
  tariff = id(4),
  invoice = id(5),
  invoice2 = id(6),
  extraction = id(7);
const now = '2026-10-16T10:00:00.000Z';
const evidence = [
  {
    documentId: tariff,
    extractionRunId: extraction,
    page: 1,
    snippet: 'Traginers annual tariff 2026 EUR 100 per trip',
  },
];
const agreement = {
  id: id(8),
  organizationId: org,
  name: 'Traginers anual 2026',
  scope: 'reusable',
  operationId: null,
  sourceDocumentId: tariff,
  sourceExtractionRunId: extraction,
  sourceSha256: 'b'.repeat(64),
  sourceMetadataVersion: 0,
  sourceCorrectionRevision: 0,
  terms: {
    provider: 'Traginers',
    currency: 'EUR',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    route: 'Barcelona',
    service: 'pickup',
    agreementBasis: 'accepted',
    pricing: { type: 'fixed-trip', amount: '100', evidence },
    evidence,
  },
  actorId: user,
  reason: 'Reviewed source',
  createdAt: now,
};
const fact = (doc, provider) => ({
  documentId: doc,
  extractionRunId: extraction,
  revisionId: null,
  kind: 'invoice',
  provider,
  operationReference: 'OP-QA',
  currency: 'EUR',
  total: '100',
  taxAmount: '0',
  serviceDate: '2026-10-16',
  serviceReference: 'PICKUP-QA',
  route: 'Barcelona',
  validFrom: null,
  validUntil: null,
  agreementBasis: 'unknown',
  excludedServices: [],
  assignedProvider: null,
  performedProvider: null,
  serviceStatus: 'unknown',
  lines: [
    {
      id: 'pickup',
      description: 'Transport',
      service: 'pickup',
      route: 'Barcelona',
      quantity: '1',
      unit: 'trip',
      unitPrice: '100',
      amount: '100',
      evidence: [],
    },
  ],
  evidence: [],
  warnings: [],
});
const doc = (docId, kind) => ({
  id: docId,
  organizationId: org,
  filename: kind === 'tariff' ? 'annual-tariff.pdf' : `${docId}.pdf`,
  metadataVersion: 0,
  extractedReference: kind === 'tariff' ? null : 'OP-QA',
  operations: [],
  operationCount: 0,
  kind,
  sizeBytes: 1200,
  status: 'ready',
  errorCode: null,
  createdAt: now,
  updatedAt: now,
  sha256: 'b'.repeat(64),
  metadataHistory: [],
  latestRun: {
    id: extraction,
    version: 1,
    status: 'ready',
    errorCode: null,
    result: {
      engine: 'pdfjs-text-v1',
      pages: [{ page: 1, text: evidence[0].snippet }],
      fields: [
        {
          name: 'provider',
          value: 'Traginers',
          status: 'extracted',
          evidence: { page: 1, snippet: 'Traginers' },
        },
      ],
      warnings: [],
    },
    createdAt: now,
    completedAt: now,
  },
  corrections: [],
  capabilities: { canWrite: true },
});
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  let readonly = false,
    conflict = false;
  let agreements = [agreement],
    writes = [];
  let operation = {
    id: op,
    organizationId: org,
    reference: 'OP-QA',
    name: 'Synthetic acceptance',
    revision: 0,
    createdAt: now,
    updatedAt: now,
    documentIds: [invoice, invoice2],
    agreementBindings: [],
    facts: [fact(invoice, 'Traginers'), fact(invoice2, 'Hapag')],
    factRevisions: [],
    fingerprint: 'a'.repeat(64),
    warnings: [],
    analyses: [],
    capabilities: { canWrite: true },
  };
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    let result;
    let status = 200;
    if (path === '/api/auth/get-session')
      result = {
        session: {
          id: id(10),
          token: 'synthetic',
          userId: user,
          expiresAt: '2027-01-01T00:00:00Z',
          createdAt: now,
          updatedAt: now,
        },
        user: {
          id: user,
          name: 'QA',
          email: 'qa@example.test',
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      };
    else if (path === '/api/auth/organization/list')
      result = [
        { id: org, name: 'Synthetic Logistics QA', slug: 'qa', createdAt: now },
      ];
    else if (path.endsWith('/context'))
      result = {
        organization: { id: org, name: 'Synthetic Logistics QA', slug: 'qa' },
        membership: { role: readonly ? 'viewer' : 'owner' },
        capabilities: {
          canInviteMembers: !readonly,
          canWriteDocuments: !readonly,
          canManageMembers: !readonly,
          canManageOrganization: !readonly,
        },
      };
    else if (path.endsWith('/agreements') && req.method() === 'GET')
      result = {
        items: agreements,
        total: agreements.length,
        limit: 25,
        offset: 0,
      };
    else if (
      path === `/api/v1/organizations/${org}/agreements` &&
      req.method() === 'POST'
    ) {
      const body = req.postDataJSON();
      writes.push({ path, body });
      result = {
        ...agreement,
        ...body,
        id: id(20 + agreements.length),
        actorId: user,
        createdAt: now,
      };
      agreements.push(result);
    } else if (
      path.endsWith(`/operations/${op}/agreements`) &&
      req.method() === 'PUT'
    ) {
      const body = req.postDataJSON();
      writes.push({ path, body });
      if (conflict) {
        status = 409;
        result = { code: 'STALE_OPERATION' };
      } else {
        operation = {
          ...operation,
          agreementBindings: body.bindings.map((b) => ({
            ...b,
            agreement: agreements.find((a) => a.id === b.agreementVersionId),
          })),
          revision: operation.revision + 1,
          fingerprint: 'c'.repeat(64),
        };
        operation.analyses = operation.analyses.map((run) => ({
          ...run,
          stale: true,
        }));
        result = { ...operation, capabilities: { canWrite: !readonly } };
      }
    } else if (path.endsWith('/review'))
      result = {
        organizationId: org,
        operationId: op,
        version: 0,
        fingerprint: operation.fingerprint,
        decisions: [],
        claims: [],
        capabilities: { canWrite: !readonly },
      };
    else if (path.endsWith(`/operations/${op}`))
      result = { ...operation, capabilities: { canWrite: !readonly } };
    else if (path.endsWith('/documents'))
      result = {
        items: [doc(tariff, 'tariff')],
        total: 1,
        limit: 25,
        offset: 0,
      };
    else if (path.includes('/documents/'))
      result = doc(
        path.split('/').at(-1),
        path.endsWith(tariff) ? 'tariff' : 'invoice',
      );
    else {
      console.log('UNHANDLED', req.method(), path);
      result = {};
    }
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });
  const base = process.env.AGREEMENTS_BROWSER_URL ?? 'http://127.0.0.1:5173';
  const orgUrl = `${base}/organizations/${org}`;
  const opUrl = `${orgUrl}/operations/${op}`;
  async function has(locator) {
    await locator.waitFor({ state: 'visible' });
  }
  async function noDialog() {
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
  }
  async function createTerms(name, provider = 'Traginers') {
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Usar un PDF ya cargado').selectOption(tariff);
    await dialog.getByLabel('Nombre del acuerdo').fill(name);
    await dialog.getByLabel('Proveedor', { exact: true }).fill(provider);
    await dialog.getByLabel('Vigente desde').fill('2026-01-01');
    await dialog.getByLabel('Vigente hasta (incluido)').fill('2026-12-31');
    await dialog.getByLabel('Ruta o ámbito del servicio').fill('Barcelona');
    await dialog.getByLabel('Moneda ISO (EUR, USD…)').fill('EUR');
    await dialog
      .getByLabel('Precio total por viaje', { exact: true })
      .fill('100');
    await dialog.getByLabel('Página de evidencia').selectOption('1');
    await dialog
      .getByLabel('Cita literal que respalda estas condiciones')
      .fill(evidence[0].snippet);
    await dialog
      .getByLabel('Motivo de publicación / revisión')
      .fill('Synthetic reviewed source');
    await dialog.getByRole('checkbox').check();
    await dialog
      .getByRole('button', { name: 'Publicar versión revisada' })
      .click();
    await noDialog();
  }
  await page.goto(`${orgUrl}?tab=agreements`);
  await has(
    page.getByRole('heading', { name: 'Tarifas y acuerdos', exact: true }),
  );
  await has(
    page.getByRole('cell', { name: 'Traginers anual 2026', exact: false }),
  );
  await page
    .getByRole('button', { name: 'Crear acuerdo', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await has(page.getByRole('dialog', { name: 'Crear acuerdo reutilizable' }));
  await page.keyboard.press('Escape');
  await noDialog();
  assert.equal(
    await page
      .getByRole('button', { name: 'Crear acuerdo', exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
    'Escape returns focus to trigger',
  );
  await page
    .getByRole('button', { name: 'Crear acuerdo', exact: true })
    .click();
  await createTerms('Second annual version');
  assert.equal(
    writes.at(-1).body.sourceDocumentId,
    tariff,
    'reuses existing original PDF',
  );
  assert.equal(writes.at(-1).body.scope, 'reusable');
  console.log(
    'PASS create reusable terms from existing PDF; keyboard Escape/focus recovery',
  );
  await page.goto(opUrl);
  const section = page.getByRole('region', { name: 'Acuerdos por factura' });
  await has(section);
  assert.equal(
    await section
      .getByRole('button', { name: 'Cargar contrato nuevo', exact: true })
      .count(),
    2,
  );
  assert.equal(
    await section
      .getByText('Sin acuerdo seleccionado', { exact: true })
      .count(),
    2,
  );
  await section
    .getByRole('button', { name: 'Seleccionar tarifa', exact: true })
    .first()
    .click();
  let dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Tarifa guardada o spot de esta operación')
    .selectOption(agreement.id);
  await dialog
    .getByLabel('Motivo de selección, cambio o retirada')
    .fill('Use annual agreement');
  await dialog
    .getByRole('button', { name: 'Confirmar versión y contexto' })
    .click();
  await noDialog();
  assert.equal(operation.agreementBindings.length, 1);
  assert.equal(operation.agreementBindings[0].invoiceDocumentId, invoice);
  assert.equal(operation.agreementBindings[0].agreementVersionId, agreement.id);
  await has(section.getByText(`Versión ${agreement.id}`, { exact: false }));
  console.log(
    'PASS invoice-specific saved tariff selection and pinned source/version display',
  );
  const historical = {
    id: id(50),
    organizationId: org,
    operationId: op,
    version: 1,
    status: 'completed',
    errorCode: null,
    fingerprint: operation.fingerprint,
    parserVersion: 'synthetic-parser',
    ruleVersion: 'logistics-v2',
    inputWarnings: [],
    snapshot: {
      organizationId: org,
      operationId: op,
      operationReference: 'OP-QA',
      documents: operation.facts,
      agreementBindings: structuredClone(operation.agreementBindings),
    },
    sources: [],
    result: { ruleVersion: 'logistics-v2', findings: [] },
    stale: false,
    createdAt: now,
    completedAt: now,
  };
  operation.analyses = [historical];
  const originalHistory = JSON.stringify(historical.snapshot);

  await section
    .getByRole('button', { name: 'Cargar tarifa spot', exact: true })
    .nth(1)
    .click();
  await createTerms('Hapag spot only', 'Hapag');
  const spot = agreements.at(-1);
  assert.equal(spot.scope, 'spot');
  assert.equal(spot.operationId, op);
  await section
    .getByRole('button', { name: 'Seleccionar tarifa', exact: true })
    .click();
  dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Tarifa guardada o spot de esta operación')
    .selectOption(spot.id);
  await dialog
    .getByLabel('Motivo de selección, cambio o retirada')
    .fill('Use operation spot');
  await dialog
    .getByRole('button', { name: 'Confirmar versión y contexto' })
    .click();
  await noDialog();
  assert.equal(operation.agreementBindings.length, 2);
  assert.equal(
    operation.agreementBindings[0].agreementVersionId,
    agreement.id,
    'second invoice leaves first selection pinned',
  );
  assert.equal(operation.agreementBindings[1].agreementVersionId, spot.id);
  await has(
    page.getByText('Datos modificados desde este análisis', { exact: true }),
  );
  assert.equal(
    JSON.stringify(operation.analyses[0].snapshot),
    originalHistory,
    'selection changes retain historical snapshot',
  );
  await page.screenshot({
    path: '/tmp/agreements-qa-desktop.png',
    fullPage: true,
  });
  console.log(
    'PASS independent annual Traginers and spot Hapag; historical snapshot retained and stale result notice',
  );
  // Switch a compatible fixture to per-km to inspect pending-data feedback, without claiming real price computation.
  agreements[0] = {
    ...agreement,
    terms: {
      ...agreement.terms,
      pricing: { type: 'per-km', amount: '2', evidence },
    },
  };
  operation.agreementBindings[0] = {
    ...operation.agreementBindings[0],
    agreement: agreements[0],
    distanceKm: null,
  };
  await page.reload();
  await has(
    section.getByText('Falta una distancia positiva revisada.', {
      exact: true,
    }),
  );
  conflict = true;
  await section
    .getByRole('button', { name: 'Cambiar tarifa', exact: true })
    .first()
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Distancia revisada (km)').fill('42.50');
  await dialog
    .getByLabel('Motivo de selección, cambio o retirada')
    .fill('Preserved conflict draft');
  await dialog
    .getByRole('button', { name: 'Confirmar versión y contexto' })
    .click();
  await has(
    dialog.getByRole('button', {
      name: 'Revisé los datos actuales; conservar mi borrador',
    }),
  );
  assert.equal(
    await dialog.getByLabel('Distancia revisada (km)').inputValue(),
    '42.50',
  );
  assert.equal(
    await dialog
      .getByLabel('Motivo de selección, cambio o retirada')
      .inputValue(),
    'Preserved conflict draft',
  );
  assert.equal(
    await dialog
      .getByRole('button', { name: 'Confirmar versión y contexto' })
      .isDisabled(),
    true,
  );
  conflict = false;
  await dialog
    .getByRole('button', {
      name: 'Revisé los datos actuales; conservar mi borrador',
    })
    .click();
  await dialog
    .getByRole('button', { name: 'Confirmar versión y contexto' })
    .click();
  await noDialog();
  assert.equal(
    operation.agreementBindings[1].distanceKm ??
      operation.agreementBindings[0].distanceKm,
    '42.50',
  );
  console.log(
    'PASS pending distance, optimistic conflict draft preservation and explicit retry',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await has(section);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
    'mobile page has no viewport-wide overflow',
  );
  await section
    .getByRole('button', { name: 'Cambiar tarifa', exact: true })
    .first()
    .click();
  dialog = page.getByRole('dialog');
  await has(dialog);
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    true,
    'mobile dialog content fits width',
  );
  await page.keyboard.press('Tab');
  assert.equal(
    await dialog.evaluate((el) => el.contains(document.activeElement)),
    true,
    'keyboard focus stays inside modal',
  );
  await page.keyboard.press('Escape');
  await noDialog();
  await section
    .getByRole('button', { name: 'Cargar contrato nuevo', exact: true })
    .first()
    .click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Usar un PDF ya cargado').selectOption(tariff);
  await dialog
    .getByLabel('Cómo se calcula el precio')
    .selectOption('distance-bands');
  await dialog
    .getByRole('button', { name: 'Agregar tramo', exact: true })
    .click();
  await has(dialog.getByText('Tramo 2', { exact: true }));
  await dialog.evaluate((el) =>
    Promise.all(el.getAnimations().map((animation) => animation.finished)),
  );
  await page.screenshot({
    path: '/tmp/agreements-qa-mobile-footer.png',
    fullPage: false,
  });
  const footerBox = await dialog.locator('.side-panel-footer').boundingBox();
  assert.ok(
    footerBox &&
      footerBox.y + footerBox.height <= page.viewportSize().height + 1,
    `long mobile form keeps its action footer in the viewport: ${JSON.stringify({ footerBox, viewport: page.viewportSize() })}`,
  );
  assert.equal(
    await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    true,
    'mobile band editor fits dialog width',
  );
  await page.screenshot({
    path: '/tmp/agreements-qa-mobile.png',
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await has(dialog.getByText('Hay cambios sin guardar.', { exact: true }));
  await dialog
    .getByRole('button', { name: 'Descartar cambios', exact: true })
    .click();
  await noDialog();
  console.log(
    'PASS mobile operation/dialog layout and keyboard focus containment',
  );
  readonly = true;
  await page.reload();
  await has(section);
  assert.equal(
    await section.getByRole('button').count(),
    0,
    'viewer has evidence with no mutation buttons',
  );
  await has(
    section
      .getByRole('link', { name: 'Ver PDF del acuerdo seleccionado' })
      .first(),
  );
  await page.goto(`${orgUrl}?tab=agreements`);
  await has(
    page.getByRole('heading', { name: 'Tarifas y acuerdos', exact: true }),
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Crear acuerdo', exact: true })
      .count(),
    0,
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('PASS viewer read-only agreements and no browser runtime errors');
  await browser.close();
})();

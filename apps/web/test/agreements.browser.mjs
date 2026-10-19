/* global URL, document, window, structuredClone, FormData */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { chooseSelect } from './select.browser-helper.mjs';
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
    else if (path === '/api/v1/session-assurance')
      result = { required: false, enrolled: false, verified: false };
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
            selectedBy: user,
            selectedAt: now,
            selectionReason: body.reason,
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
    try {
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    } catch (error) {
      console.error(
        'Dialog remained open',
        errors,
        await page.getByRole('dialog').innerText(),
      );
      throw error;
    }
  }
  async function createTerms(name, provider = 'Traginers', structured = false) {
    const dialog = page.getByRole('dialog');
    await chooseSelect(
      page,
      dialog.getByLabel('Usar un PDF ya cargado'),
      tariff,
    );
    await chooseSelect(page, dialog.getByLabel('Usar un PDF ya cargado'), '');
    assert.equal(
      await dialog
        .getByRole('combobox', { name: 'Servicio', exact: true })
        .isDisabled(),
      true,
      'disabled fieldset disables the visible custom control',
    );
    assert.equal(
      await dialog
        .locator('select[required]')
        .first()
        .evaluate((el) => el.value),
      '',
      'clear option preserves empty raw value',
    );
    await chooseSelect(
      page,
      dialog.getByLabel('Usar un PDF ya cargado'),
      tariff,
    );
    await dialog.getByLabel('Nombre del acuerdo').fill(name);
    await dialog.getByLabel('Proveedor', { exact: true }).fill(provider);
    await dialog.getByLabel('Vigente desde').fill('2026-01-01');
    await dialog.getByLabel('Vigente hasta (incluido)').fill('2026-12-31');
    await dialog.getByLabel('Ruta o ámbito del servicio').fill('Barcelona');
    await dialog.getByLabel('Moneda ISO (EUR, USD…)').fill('EUR');
    await dialog
      .getByLabel('Precio total por viaje', { exact: true })
      .fill('100');
    await chooseSelect(page, dialog.getByLabel('Página de evidencia'), '1');
    await chooseSelect(
      page,
      dialog.getByLabel('Servicio', { exact: true }),
      'ocean-handling',
    );
    assert.equal(
      await dialog
        .locator('form')
        .evaluate((el) => new FormData(el).get('service')),
      'ocean-handling',
      'custom select submits exact raw value',
    );
    await chooseSelect(
      page,
      dialog.getByLabel('Servicio', { exact: true }),
      'pickup',
    );
    await dialog
      .getByLabel('Cita literal que respalda estas condiciones')
      .fill(evidence[0].snippet);
    await dialog
      .getByLabel('Motivo de publicación / revisión')
      .fill('Synthetic reviewed source');
    if (structured) {
      await chooseSelect(
        page,
        dialog.getByLabel('Cómo se calcula el precio'),
        'line-items',
      );
      await dialog.getByLabel('Moneda ISO (EUR, USD…)').fill('');
      await dialog
        .getByLabel(
          'Identidad, aplicabilidad y partidas estructuradas (opcional)',
        )
        .fill(
          JSON.stringify({
            agreementIdentity: 'SYNTHETIC-REUSABLE',
            lines: [
              {
                id: 'charge-usd',
                description: 'Synthetic documented charge',
                service: 'pickup',
                route: 'Barcelona',
                quantity: null,
                unit: 'bl',
                billingBasis: 'bl',
                unitPrice: '100',
                amount: null,
                currency: 'USD',
                evidence: evidence.map((item) => ({
                  ...item,
                  revisionId: null,
                })),
              },
            ],
          }),
        );
      assert.equal(
        await dialog
          .getByLabel('Precio total por viaje', { exact: true })
          .count(),
        0,
        'line items do not demand fabricated global amount',
      );
    }
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
  const sourceTrigger = page
    .getByRole('dialog')
    .getByLabel('Usar un PDF ya cargado');
  await sourceTrigger.click();
  await has(page.getByRole('listbox'));
  await page.keyboard.press('Escape');
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  assert.equal(
    await page.getByRole('dialog').isVisible(),
    true,
    'first Escape closes select, preserving the sheet',
  );
  const requiredSource = page
    .getByRole('dialog')
    .locator('select[required]')
    .first();
  assert.equal(
    await requiredSource.evaluate((el) => el.validity.valueMissing),
    true,
    'empty required custom select retains native invalidity',
  );
  assert.equal(
    await requiredSource.evaluate((el) => el.reportValidity()),
    false,
  );
  await page.waitForFunction(
    (el) => el === document.activeElement,
    await sourceTrigger.elementHandle(),
  );
  await page.waitForFunction(
    (el) => el.getAttribute('aria-invalid') === 'true',
    await sourceTrigger.elementHandle(),
  );
  assert.equal(await sourceTrigger.getAttribute('aria-invalid'), 'true');
  await page.keyboard.press('Escape');
  await noDialog();
  await page.waitForFunction(
    (el) => el === document.activeElement,
    await page
      .getByRole('button', { name: 'Crear acuerdo', exact: true })
      .elementHandle(),
  );
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
  await createTerms('Second annual version', 'Traginers', true);
  assert.equal(
    writes.at(-1).body.sourceDocumentId,
    tariff,
    'reuses existing original PDF',
  );
  assert.equal(writes.at(-1).body.scope, 'reusable');
  assert.deepEqual(writes.at(-1).body.terms.pricing, { type: 'line-items' });
  assert.equal(writes.at(-1).body.terms.currency, null);
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
  await chooseSelect(
    page,
    dialog.getByLabel('Tarifa guardada o spot de esta operación'),
    agreement.id,
  );
  await dialog
    .getByLabel('Fecha relevante documentada (vacía si se desconoce)')
    .fill('');
  await dialog.getByLabel('Ruta o ámbito revisado').fill('');
  await dialog
    .getByLabel('Motivo de selección, cambio o retirada')
    .fill('Use annual agreement');
  await dialog
    .getByRole('button', { name: 'Confirmar versión y contexto' })
    .click();
  await noDialog();
  assert.equal(operation.agreementBindings.length, 1);
  assert.equal(operation.agreementBindings[0].serviceDate, null);
  assert.equal(operation.agreementBindings[0].route, null);
  await has(
    section.getByText('La selección no verifica las condiciones del acuerdo.', {
      exact: false,
    }),
  );
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
    result: {
      ruleVersion: 'logistics-v2',
      findings: [],
      agreementDecisions: [
        {
          invoiceDocumentId: invoice,
          lineId: 'line-1',
          agreementDocumentId: tariff,
          agreementVersionId: agreement.id,
          state: 'pending',
          reason: 'Falta fecha relevante y equipo real',
          conditions: [
            {
              name: 'equipmentType',
              state: 'unknown',
              reason: 'Confirmar equipo y cantidad reales',
              evidence: [],
            },
          ],
          evidence: [],
        },
      ],
    },
    stale: false,
    createdAt: now,
    completedAt: now,
  };
  operation.analyses = [historical];
  const originalHistory = JSON.stringify(historical.snapshot);
  await page.reload();
  await has(
    page.getByRole('heading', {
      name: 'Aplicabilidad de acuerdos',
      exact: true,
    }),
  );
  await has(
    page.getByText('Falta fecha relevante y equipo real', { exact: true }),
  );
  await has(
    page.getByText('Confirmar equipo y cantidad reales', { exact: false }),
  );

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
  await chooseSelect(
    page,
    dialog.getByLabel('Tarifa guardada o spot de esta operación'),
    spot.id,
  );
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
  await chooseSelect(page, dialog.getByLabel('Usar un PDF ya cargado'), tariff);
  await chooseSelect(
    page,
    dialog.getByLabel('Cómo se calcula el precio'),
    'distance-bands',
  );
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

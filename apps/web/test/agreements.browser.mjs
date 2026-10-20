/* global URL, document, window, structuredClone, FormData, Buffer */
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
  let sourceUploadCount = 0;
  let attachAttempts = 0;
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
    else if (
      path.endsWith(`/operations/${op}/documents/attach`) &&
      req.method() === 'POST'
    ) {
      attachAttempts += 1;
      const body = req.postDataJSON();
      assert.equal(body.documentId, tariff);
      assert.equal(body.expectedFingerprint, operation.fingerprint);
      if (attachAttempts === 1) {
        status = 409;
        result = { code: 'STALE_OPERATION' };
      } else {
        operation.documentIds = [
          ...new Set([...operation.documentIds, body.documentId]),
        ];
        operation.revision += 1;
        operation.fingerprint = 'd'.repeat(64);
        result = { ...operation, capabilities: { canWrite: !readonly } };
      }
    } else if (path.endsWith('/documents') && req.method() === 'POST') {
      sourceUploadCount += 1;
      assert.equal(req.headers()['x-document-kind'], 'tariff');
      result = doc(tariff, 'tariff');
    } else if (path.endsWith('/documents'))
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
  await has(page.getByRole('heading', { name: '1. Preparar documentos' }));
  await has(page.getByRole('button', { name: 'Subir factura', exact: true }));
  await page
    .getByRole('button', { name: 'Subir contrato o tarifa', exact: true })
    .click();
  const sourcePanel = page.getByRole('dialog', {
    name: 'Subir contrato o tarifa',
    exact: true,
  });
  await sourcePanel.getByLabel('Archivo PDF').setInputFiles({
    name: 'synthetic-source.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nsynthetic transport fixture'),
  });
  await sourcePanel
    .getByRole('button', { name: 'Subir contrato o tarifa', exact: true })
    .click();
  await has(
    sourcePanel.getByText('El PDF ya está guardado.', { exact: false }),
  );
  await sourcePanel
    .getByRole('button', { name: 'Reintentar vinculación', exact: true })
    .click();
  await noDialog();
  assert.equal(
    sourceUploadCount,
    1,
    'failed attach retry does not upload PDF twice',
  );
  assert.equal(attachAttempts, 2);
  assert.equal(operation.documentIds.includes(tariff), true);
  await has(
    page
      .locator('section[aria-label="Documentos de referencia"]')
      .getByRole('link', { name: 'annual-tariff.pdf', exact: true }),
  );
  console.log(
    'PASS upload reference directly from operation; attach conflict retry preserves PDF and invoice links',
  );
  assert.equal(
    await page
      .getByRole('button', {
        name: 'Registrar acuerdo reutilizable',
        exact: true,
      })
      .first()
      .isVisible(),
    false,
    'advanced registration starts collapsed',
  );
  await page
    .locator('summary')
    .filter({ hasText: 'Opciones avanzadas de acuerdos' })
    .click();
  const section = page.getByRole('region', {
    name: 'Tarifas guardadas y acuerdos spot',
  });
  await has(section);
  assert.equal(
    await section
      .getByRole('button', {
        name: 'Registrar acuerdo reutilizable',
        exact: true,
      })
      .count(),
    2,
  );
  assert.equal(
    await section
      .getByText('Sin versión guardada seleccionada', { exact: true })
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
  await page
    .locator('summary')
    .filter({ hasText: 'Opciones avanzadas de acuerdos' })
    .click();
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
  await page
    .locator('summary')
    .filter({ hasText: 'Opciones avanzadas de acuerdos' })
    .click();
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
  await page
    .locator('summary')
    .filter({ hasText: 'Opciones avanzadas de acuerdos' })
    .click();
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
    .getByRole('button', {
      name: 'Registrar acuerdo reutilizable',
      exact: true,
    })
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
  // A free expediente reference never needs to match invoice, contract or shipment numbers.
  operation.reference = 'MY-INTERNAL-CASE-42';
  const referenceFact = {
    ...fact(tariff, 'Traginers'),
    kind: 'agreement',
    operationReference: null,
    agreementIdentity: 'ANNUAL-CONTRACT-2026',
    agreementBasis: 'accepted',
  };
  operation.documentIds = [invoice, invoice2, tariff];
  operation.facts = [
    { ...fact(invoice, 'Traginers'), operationReference: 'SHIPMENT-123' },
    fact(invoice2, 'Hapag'),
    referenceFact,
  ];
  const economicFinding = {
    documentId: invoice,
    lineId: 'pickup',
    service: 'pickup',
    status: 'matched',
    code: 'PRICE_MATCH',
    expected: '100',
    invoiced: '100',
    difference: '0',
    currency: 'EUR',
    explanation: 'Invoice-only verified comparison',
    evidence: [],
  };
  const sourceControl = {
    ...economicFinding,
    documentId: tariff,
    status: 'not-verifiable',
    code: 'OPERATION_MISMATCH',
    explanation: 'Original source control retained for traceability',
  };
  operation.analyses = [
    {
      ...historical,
      id: id(51),
      snapshot: {
        ...historical.snapshot,
        operationReference: operation.reference,
        documents: structuredClone(operation.facts),
      },
      result: {
        ruleVersion: 'logistics-v2',
        agreementDecisions: [],
        findings: [sourceControl, economicFinding],
      },
      stale: false,
    },
  ];
  await page.reload();
  await page
    .locator('summary')
    .filter({ hasText: 'Opciones avanzadas de acuerdos' })
    .click();
  await has(
    page.getByRole('heading', { name: operation.reference, exact: true }),
  );
  assert.equal(
    await page
      .getByText('Revisá las referencias antes de analizar', { exact: true })
      .count(),
    0,
  );
  await has(
    page.getByText('No se evaluaron acuerdos para ninguna partida.', {
      exact: false,
    }),
  );
  assert.equal(
    await page
      .getByText('Conserva su resultado original.', { exact: false })
      .count(),
    0,
  );
  const economicTable = page.getByRole('table', {
    name: /Importes esperados, facturados y diferencias/,
  });
  await has(economicTable);
  await has(
    economicTable.getByText('Invoice-only verified comparison', {
      exact: true,
    }),
  );
  assert.equal(
    await economicTable
      .getByText('Original source control retained for traceability', {
        exact: true,
      })
      .count(),
    0,
  );
  await page
    .locator('summary')
    .filter({
      hasText:
        'Controles de documentos de referencia y apoyo del resultado original',
    })
    .click();
  await has(
    page.getByText('Original source control retained for traceability', {
      exact: true,
    }),
  );
  const retainedSource = page
    .locator('article')
    .filter({ hasText: 'Original source control retained for traceability' });
  assert.equal(
    await retainedSource.getByRole('button').count(),
    0,
    'source evidence cannot open economic review or claims',
  );
  await has(page.locator('section[aria-label="Documentos de referencia"]'));
  await has(page.locator('section[aria-label="Facturas a verificar"]'));
  await has(
    page
      .locator('section[aria-label="Documentos de referencia"]')
      .getByRole('link', { name: 'annual-tariff.pdf', exact: true }),
  );
  assert.equal(
    await page
      .locator('section[aria-label="Facturas a verificar"]')
      .getByRole('link', { name: 'annual-tariff.pdf', exact: true })
      .count(),
    0,
  );
  await page
    .getByRole('button', { name: 'Editar operación', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: 'Editar operación', exact: true });
  assert.equal(
    await dialog
      .getByLabel('Referencia interna del expediente', { exact: true })
      .inputValue(),
    'MY-INTERNAL-CASE-42',
  );
  await has(
    dialog.getByText(
      'Identificador libre: no necesita coincidir con la factura, contrato o envío.',
      { exact: true },
    ),
  );
  await page.keyboard.press('Escape');
  await noDialog();
  console.log(
    'PASS free internal reference, source/invoice separation, read-only source controls and accurate empty applicability feedback',
  );
  // Price equality must remain distinct from unresolved commercial applicability.
  const candidateBase = {
    invoiceDocumentId: invoice,
    lineId: 'pickup',
    referenceDocumentId: tariff,
    referenceLineId: 'pickup',
    concept: 'transport',
    invoiceConcept: 'Synthetic transport',
    referenceConcept: 'Reference transport',
    status: 'pending',
    priceStatus: 'equal',
    claimable: false,
    aliasVersion: 'synthetic-alias-v1',
    expectedCurrency: 'EUR',
    actualCurrency: 'EUR',
    quantity: '1',
    currency: 'EUR',
    expectedUnitPrice: '100',
    actualUnitPrice: '100',
    expectedAmount: '100',
    actualAmount: '100',
    difference: '0',
    conditions: [
      {
        name: 'provider',
        state: 'unknown',
        reason: 'Proveedor pendiente de confirmar',
        evidence: [],
      },
    ],
    reasons: ['Precio coincidente con proveedor pendiente'],
    calculation: '1 × 100 = 100 EUR',
    evidence: [],
  };
  operation.analyses[0].result.comparisonCandidates = [
    candidateBase,
    {
      ...candidateBase,
      lineId: 'unknown-charge',
      invoiceConcept: 'Synthetic unknown charge',
      referenceDocumentId: null,
      referenceLineId: null,
      referenceConcept: null,
      priceStatus: 'unknown',
      expectedUnitPrice: null,
      actualUnitPrice: null,
      expectedAmount: null,
      actualAmount: null,
      difference: null,
      reasons: ['Falta una fuente compatible para este concepto'],
    },
  ];
  operation.analyses[0].snapshot.documents[0].lines[0].tariffUnitPrice = '125';
  operation.analyses[0].snapshot.documents[0].lines[0].tariffCurrency = 'USD';
  await page.reload();
  const candidateRegion = page.getByRole('region', {
    name: 'Comparación de factura contra referencia',
    exact: true,
  });
  await has(candidateRegion);
  await has(candidateRegion.getByText('Precio coincidente', { exact: true }));
  await has(
    candidateRegion.getByText('Precio no verificable', { exact: true }),
  );
  assert.equal(
    await candidateRegion
      .getByText('Pendiente de verificar', { exact: true })
      .count(),
    2,
  );
  assert.equal(
    await candidateRegion
      .getByRole('button', { name: /reclamo|confirmar|revisar hallazgo/i })
      .count(),
    0,
    'proposed matches never expose claim actions',
  );
  await candidateRegion
    .getByRole('button', { name: 'Ver detalle', exact: true })
    .first()
    .click();
  await has(
    candidateRegion.getByText(
      'Precio unitario original de la factura: 125 USD.',
      { exact: true },
    ),
  );
  await has(
    candidateRegion.getByText('Importe registrado en la factura: 100 EUR.', {
      exact: true,
    }),
  );
  await has(
    candidateRegion.getByText(
      'Esta propuesta no habilita acciones de reclamo.',
      { exact: true },
    ),
  );
  assert.equal(
    await page
      .locator('details')
      .filter({
        has: page.locator('summary', {
          hasText: 'Controles detallados y aplicabilidad del análisis',
        }),
      })
      .getAttribute('open'),
    null,
    'secondary analysis controls start collapsed when candidate comparisons exist',
  );
  console.log(
    'PASS proposed per-line price equality remains pending; missing source and original currencies remain explicit without claim actions',
  );
  readonly = true;
  await page.reload();
  await page
    .locator('summary')
    .filter({ hasText: 'Opciones avanzadas de acuerdos' })
    .click();
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

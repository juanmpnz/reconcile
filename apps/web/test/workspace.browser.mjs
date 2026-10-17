/* global URL, document, window, getComputedStyle, Event */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { chooseSelect } from './select.browser-helper.mjs';
import { setTimeout as delay } from 'node:timers/promises';
import {
  setTimeout as deadline,
  clearTimeout as clearDeadline,
} from 'node:timers';
// Explicit synthetic HTTP fixtures: browser/UI proof only, not authorization or aggregate correctness.
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const org = id(101),
  other = id(102),
  user = id(103),
  now = '2026-10-16T10:00:00.000Z';
const organizations = [
  { id: org, name: 'Workspace QA', slug: 'workspace-qa', createdAt: now },
  {
    id: other,
    name: 'Second workspace with a deliberately long organization label for narrow screens',
    slug: 'second-qa',
    createdAt: now,
  },
];
const operations = Array.from({ length: 53 }, (_, index) => ({
  id: id(index + 200),
  organizationId: org,
  reference: `OP-${String(index + 1).padStart(3, '0')}`,
  name: `Operation ${index + 1}`,
  revision: 0,
  createdAt: now,
  updatedAt: now,
}));
const dashboard = (organizationId) => ({
  organizationId,
  generatedAt: now,
  scope: 'all_organization_records',
  operations: {
    total: organizationId === org ? 53 : 7,
    withoutCompletedAnalysis: organizationId === org ? 50 : 4,
    byLatestAnalysis: {
      not_analyzed: organizationId === org ? 50 : 4,
      queued: 0,
      processing: 0,
      completed: 3,
      failed: 0,
      blocked: 0,
    },
  },
  documents: {
    total: 37,
    byStatus: {
      queued: 2,
      processing: 1,
      needs_review: 4,
      ready: 29,
      failed: 1,
      blocked: 0,
    },
  },
  claims: {
    total: 8,
    open: 6,
    byStatus: {
      draft: 1,
      exported: 1,
      sent: 1,
      in_review: 1,
      follow_up: 2,
      resolved: 1,
      rejected: 1,
    },
  },
  findings: {
    scope: 'latest_completed_per_operation',
    includesHistorical: true,
    humanConfirmations: 2,
    confirmed: 4,
    probable: 1,
    notVerifiable: 3,
    matched: 12,
  },
  pending: {
    documents: [
      { id: id(500), filename: 'Needs-review.pdf', status: 'needs_review' },
    ],
    operations: [
      {
        id: operations[0].id,
        reference: operations[0].reference,
        name: operations[0].name,
        status: 'not_analyzed',
      },
    ],
    claims: [],
  },
});
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
let readonly = false,
  dashboardError = false,
  authenticated = true,
  expireDashboard = false,
  assuranceRequired = false,
  assuranceEnrolled = false,
  assuranceVerified = false;
const mfaWrites = [];
let sessionUser = user,
  heldContext = null,
  heldDashboard = null;
function requestGate() {
  let arrive, release;
  const arrived = new Promise((resolve, reject) => {
    const timer = deadline(
      () => reject(new Error('Expected gated HTTP request was not observed')),
      10000,
    );
    arrive = () => {
      clearDeadline(timer);
      resolve();
    };
  });
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  return {
    arrived,
    release,
    wait: () => {
      arrive();
      return pending;
    },
  };
}
const requests = [],
  errors = [],
  organizationRequests = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.route('**/api/**', async (route) => {
  const req = route.request(),
    url = new URL(req.url()),
    path = url.pathname,
    requestUser = sessionUser;
  let result,
    status = 200;
  if (path.startsWith('/api/v1/organizations/'))
    organizationRequests.push(path);
  if (path === '/api/auth/get-session')
    result = authenticated
      ? {
          session: {
            id: id(104),
            token: 'synthetic',
            userId: requestUser,
            expiresAt: '2027-01-01T00:00:00Z',
            createdAt: now,
            updatedAt: now,
          },
          user: {
            id: requestUser,
            name: requestUser === user ? 'QA' : 'QA Second Identity',
            email:
              requestUser === user ? 'qa@example.test' : 'second@example.test',
            emailVerified: true,
            createdAt: now,
            updatedAt: now,
          },
        }
      : null;
  else if (path === '/api/v1/session-assurance')
    result = {
      required: assuranceRequired,
      enrolled: assuranceEnrolled,
      verified: assuranceVerified,
    };
  else if (path === '/api/auth/two-factor/enable') {
    const body = req.postDataJSON();
    mfaWrites.push({ path, body });
    result = {
      totpURI:
        'otpauth://totp/Reconcile:qa@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Reconcile',
      backupCodes: ['synthetic-backup-one', 'synthetic-backup-two'],
    };
  } else if (
    path === '/api/auth/two-factor/verify-totp' ||
    path === '/api/auth/two-factor/verify-backup-code'
  ) {
    const body = req.postDataJSON();
    mfaWrites.push({ path, body });
    assuranceEnrolled = true;
    assuranceVerified = true;
    result = { status: true };
  } else if (path === '/api/auth/organization/list') result = organizations;
  else if (path.endsWith('/context')) {
    if (heldContext) await heldContext.wait();
    const organization = organizations.find((o) => path.includes(o.id));
    result = {
      organization,
      membership: { role: readonly ? 'viewer' : 'owner' },
      capabilities: {
        canInviteMembers: !readonly,
        canWriteDocuments: !readonly,
        canManageMembers: !readonly,
        canManageOrganization: !readonly,
      },
    };
  } else if (path.endsWith('/dashboard')) {
    if (heldDashboard && requestUser === user) await heldDashboard.wait();
    if (expireDashboard) {
      authenticated = false;
      status = 401;
      result = { code: 'UNAUTHENTICATED' };
    } else if (dashboardError) {
      status = 503;
      result = { code: 'DASHBOARD_UNAVAILABLE' };
    } else {
      result = dashboard(path.includes(other) ? other : org);
      if (requestUser !== user) result.operations = dashboard(other).operations;
    }
  } else if (path.endsWith('/operations') && req.method() === 'POST') {
    await delay(500);
    status = 503;
    result = { code: 'SYNTHETIC_UNAVAILABLE' };
  } else if (path.endsWith('/operations')) {
    requests.push(Object.fromEntries(url.searchParams));
    const query = url.searchParams.get('q') ?? '',
      sort = url.searchParams.get('sort') ?? 'createdAt',
      direction = url.searchParams.get('direction') ?? 'desc';
    const limit = Number(url.searchParams.get('limit') ?? 25),
      offset = Number(url.searchParams.get('offset') ?? 0);
    let rows = operations.filter((o) =>
      `${o.reference} ${o.name}`.toLowerCase().includes(query.toLowerCase()),
    );
    rows = rows.toSorted(
      (a, b) =>
        String(a[sort] ?? '').localeCompare(String(b[sort] ?? '')) *
          (direction === 'asc' ? 1 : -1) || a.id.localeCompare(b.id),
    );
    result = {
      items: rows.slice(offset, offset + limit),
      total: rows.length,
      limit,
      offset,
    };
  } else if (path.endsWith('/documents') || path.endsWith('/agreements'))
    result = { items: [], total: 0, limit: 25, offset: 0 };
  else if (path === '/api/auth/organization/list-members')
    result = { members: [], total: 0 };
  else if (path === '/api/auth/organization/list-invitations') result = [];
  else {
    status = 404;
    result = { code: 'UNHANDLED_UI_FIXTURE' };
    console.log('UNHANDLED', req.method(), path);
  }
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(result),
  });
});
const base = process.env.WORKSPACE_BROWSER_URL ?? 'http://127.0.0.1:5173';
const orgUrl = `${base}/organizations/${org}`;
const visible = (locator) => locator.waitFor({ state: 'visible' });
const recorded = async (predicate) => {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (requests.some(predicate)) return;
    await delay(100);
  }
  assert.fail('Expected server request was not observed');
};
const fits = () =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );
try {
  await page.goto(orgUrl);
  await visible(page.getByRole('heading', { name: 'Resumen', exact: true }));
  await visible(page.getByText('53', { exact: true }).first());
  const nav = page.getByRole('navigation', { name: 'Espacio de trabajo' });
  assert.equal(
    await nav
      .getByRole('link', { name: 'Resumen', exact: true })
      .getAttribute('aria-current'),
    'page',
  );
  await visible(nav.getByRole('link', { name: 'Operativa', exact: true }));
  await visible(nav.getByRole('link', { name: 'Equipo', exact: true }));
  const font = await page
    .locator('body')
    .evaluate((el) => getComputedStyle(el).fontFamily);
  assert.match(font, /Inter/i);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    await page.evaluate(() => document.fonts.check('14px Inter')),
    true,
  );
  assert.equal(
    await page.evaluate(() =>
      Array.from(document.fonts).some(
        (face) => /Inter/.test(face.family) && face.status === 'loaded',
      ),
    ),
    true,
    'an actual local Inter font face is loaded',
  );
  assert.equal(
    await page
      .getByRole('main')
      .evaluate((el) => getComputedStyle(el).backgroundColor),
    'rgb(255, 255, 255)',
    'workspace main surface is white',
  );
  await visible(
    page.getByRole('img', { name: /Distribución actual de 37 documentos/ }),
  );
  await page.getByText('Consultar cifras del gráfico', { exact: true }).click();
  assert.equal(
    await page
      .locator('.chart-values div')
      .filter({ hasText: 'Requiere revisión' })
      .locator('dd')
      .innerText(),
    '4',
  );
  console.log(
    'PASS default overview, three workspace destinations, real-count DTO display and locally loaded Inter',
  );
  await page.screenshot({
    path: '/tmp/workspace-qa-overview.png',
    fullPage: false,
  });
  await nav.getByRole('link', { name: 'Operativa', exact: true }).click();
  await visible(
    page.getByRole('heading', { name: 'Operaciones', exact: true }),
  );
  await visible(page.getByText('53 resultados', { exact: false }).first());
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await page.waitForFunction(
    () => new URL(window.location.href).searchParams.get('page') === '1',
  );
  await visible(page.getByText('Página 2 de 3', { exact: true }));
  await recorded((q) => q.offset === '25' && q.limit === '25');
  await page
    .getByRole('columnheader', { name: /Referencia/ })
    .getByRole('button')
    .first()
    .click();
  await page.waitForFunction(() => {
    const p = new URL(window.location.href).searchParams;
    return p.get('sort') === 'reference' && p.get('page') === '0';
  });
  await recorded((q) => q.sort === 'reference' && q.offset === '0');
  await page.getByLabel('Buscar operaciones', { exact: true }).fill('OP-053');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await visible(page.getByRole('link', { name: 'OP-053', exact: true }));
  await recorded((q) => q.q === 'OP-053' && q.offset === '0');
  const rowsTrigger = page.getByRole('combobox', { name: /^Filas por página/ });
  await rowsTrigger.focus();
  await page.keyboard.press('Enter');
  await visible(page.getByRole('listbox'));
  await page.keyboard.press('1');
  await page.waitForFunction(
    () => document.activeElement?.getAttribute('data-value') === '100',
  );
  await page.keyboard.press('Enter');
  await page.getByRole('listbox').waitFor({ state: 'hidden' });
  await recorded((q) => q.limit === '100' && q.q === 'OP-053');
  await chooseSelect(page, page.getByLabel(/^Filas por página/), '50');
  await page.waitForFunction(
    () => new URL(window.location.href).searchParams.get('limit') === '50',
  );
  await recorded((q) => q.limit === '50' && q.q === 'OP-053');
  await page
    .getByRole('columnheader', { name: /Referencia/ })
    .getByRole('button')
    .first()
    .click();
  await page.waitForFunction(
    () =>
      new URL(window.location.href).searchParams.get('sort') === 'reference',
  );
  await recorded((q) => q.sort === 'reference' && q.offset === '0');
  console.log(
    'PASS TanStack server pagination/search/sort/page-size parameters preserve global scope and reset page',
  );
  const trigger = page.getByRole('button', {
    name: 'Crear operación',
    exact: true,
  });
  await trigger.click();
  const panel = page.getByRole('dialog', {
    name: 'Crear operación',
    exact: true,
  });
  await visible(panel);
  const desktop = await panel.boundingBox();
  assert.ok(
    desktop &&
      desktop.x > 700 &&
      desktop.width <= 600 &&
      desktop.x + desktop.width >= 1438,
    'desktop panel docks right',
  );
  await panel
    .getByLabel('Referencia de operación', { exact: true })
    .fill('DRAFT-KEPT');
  const focusGate = requestGate();
  heldContext = focusGate;
  await page.evaluate(() =>
    window.dispatchEvent(new Event('visibilitychange')),
  );
  await focusGate.arrived;
  assert.equal(
    await panel.isVisible(),
    true,
    'background authorization refresh keeps dirty form mounted',
  );
  assert.equal(
    await panel
      .getByLabel('Referencia de operación', { exact: true })
      .inputValue(),
    'DRAFT-KEPT',
  );
  const refreshedContext = page.waitForResponse((response) =>
    response.url().endsWith('/context'),
  );
  heldContext = null;
  focusGate.release();
  await refreshedContext;
  assert.equal(
    await panel
      .getByLabel('Referencia de operación', { exact: true })
      .inputValue(),
    'DRAFT-KEPT',
  );
  await page.keyboard.press('Escape');
  await visible(panel.getByText('Hay cambios sin guardar.', { exact: true }));
  await panel
    .getByRole('button', { name: 'Conservar edición', exact: true })
    .click();
  assert.equal(
    await panel
      .getByLabel('Referencia de operación', { exact: true })
      .inputValue(),
    'DRAFT-KEPT',
  );
  await panel.getByLabel('Nombre', { exact: true }).fill('Retained draft');
  await panel
    .getByRole('button', { name: 'Crear operación', exact: true })
    .click();
  assert.equal(await panel.locator('form').getAttribute('aria-busy'), 'true');
  await page.keyboard.press('Escape');
  assert.equal(await panel.isVisible(), true);
  assert.equal(
    await panel.getByText('Hay cambios sin guardar.', { exact: true }).count(),
    0,
  );
  await visible(
    panel.getByRole('alert').filter({
      hasText: 'No pudimos completar la solicitud. Volvé a intentar.',
    }),
  );
  assert.equal(
    await panel
      .getByLabel('Referencia de operación', { exact: true })
      .inputValue(),
    'DRAFT-KEPT',
  );
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  assert.equal(
    await panel.evaluate((el) => el.contains(document.activeElement)),
    true,
  );
  await page.keyboard.press('Escape');
  await visible(panel.getByText('Hay cambios sin guardar.', { exact: true }));
  await panel
    .getByRole('button', { name: 'Crear operación', exact: true })
    .click();
  assert.equal(await panel.locator('form').getAttribute('aria-busy'), 'true');
  assert.equal(
    await panel
      .getByRole('button', { name: 'Conservar edición', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await panel
      .getByRole('button', { name: 'Descartar cambios', exact: true })
      .isDisabled(),
    true,
  );
  await page.keyboard.press('Escape');
  assert.equal(await panel.isVisible(), true);
  await page.waitForFunction(
    (el) => el.getAttribute('aria-busy') !== 'true',
    await panel.locator('form').elementHandle(),
  );
  await visible(
    panel.getByRole('alert').filter({
      hasText: 'No pudimos completar la solicitud. Volvé a intentar.',
    }),
  );
  await panel
    .getByRole('button', { name: 'Descartar cambios', exact: true })
    .click();
  await panel.waitFor({ state: 'hidden' });
  await page.waitForFunction(
    (el) => el === document.activeElement,
    await trigger.elementHandle(),
  );
  assert.equal(
    await trigger.evaluate((el) => el === document.activeElement),
    true,
  );
  console.log(
    'PASS right SidePanel dirty draft preservation/discard, keyboard containment and trigger focus return',
  );
  const contrast = await trigger.evaluate((el) => {
    const rgb = (color) =>
      color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number)
        .map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
    const luminance = (color) => {
      const [r, g, b] = rgb(color);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const style = getComputedStyle(el),
      a = luminance(style.color),
      b = luminance(style.backgroundColor);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  assert.ok(contrast >= 4.5, `primary action text contrast ${contrast}`);
  console.log('PASS primary brand action measured text contrast >=4.5:1');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    const menu = page.getByRole('button', { name: 'Menú', exact: true });
    if (await menu.isVisible()) {
      await menu.click();
      await visible(nav.getByRole('link', { name: 'Operativa', exact: true }));
      await page
        .getByRole('button', { name: 'Cerrar menú', exact: true })
        .click();
    }
    const orgTrigger = page.getByRole('combobox', {
      name: 'Organización',
      exact: true,
    });
    await orgTrigger.click();
    const optionsBox = await page.getByRole('listbox').boundingBox();
    assert.ok(
      optionsBox &&
        optionsBox.x >= -1 &&
        optionsBox.x + optionsBox.width <= width + 1,
      'long select options fit mobile viewport',
    );
    await page.screenshot({
      path: `/tmp/workspace-qa-select-${width}.png`,
      fullPage: false,
    });
    await page.keyboard.press('Escape');
    await page.getByRole('listbox').waitFor({ state: 'hidden' });
    await trigger.click();
    await visible(panel);
    await panel.evaluate((el) =>
      Promise.all(el.getAnimations().map((animation) => animation.finished)),
    );
    const box = await panel.boundingBox();
    assert.ok(
      box &&
        Math.abs(box.x) <= 1 &&
        Math.abs(box.y) <= 1 &&
        Math.abs(box.width - width) <= 2 &&
        Math.abs(box.height - 844) <= 2,
      `mobile panel uses the full viewport: ${JSON.stringify(box)}`,
    );
    await page.screenshot({
      path: `/tmp/workspace-qa-panel-${width}.png`,
      fullPage: false,
    });
    assert.equal(await fits(), true);
    await panel
      .getByRole('button', { name: 'Cerrar panel', exact: true })
      .click();
    await panel.waitFor({ state: 'hidden' });
  }
  await page.screenshot({
    path: '/tmp/workspace-qa-mobile.png',
    fullPage: true,
  });
  console.log(
    'PASS 320/390 mobile navigation/table containment and full-width SidePanel',
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(orgUrl);
  await visible(page.getByRole('heading', { name: 'Resumen', exact: true }));
  await chooseSelect(
    page,
    page.getByLabel('Organización', { exact: true }),
    other,
  );
  await page.waitForURL(`**/organizations/${other}?tab=overview`);
  await visible(page.getByText('7', { exact: true }).first());
  assert.equal(await page.getByText('53', { exact: true }).count(), 0);
  dashboardError = true;
  await page.reload();
  await visible(page.getByRole('alert').first());
  assert.equal(
    await page.getByText('7', { exact: true }).count(),
    0,
    'failed aggregate is not rendered as a valid cached total',
  );
  dashboardError = false;
  readonly = true;
  await page.goto(`${orgUrl}?tab=operations`);
  await visible(
    page.getByRole('heading', { name: 'Operaciones', exact: true }),
  );
  assert.equal(
    await page
      .getByRole('button', { name: 'Crear operación', exact: true })
      .count(),
    0,
  );
  await page.evaluate(() => {
    document.documentElement.style.zoom = '2';
  });
  assert.equal(await fits(), true);
  await page.screenshot({
    path: '/tmp/workspace-qa-desktop.png',
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    'PASS organization switch isolation, aggregate error state, viewer boundaries and 200% layout',
  );
  await page.evaluate(() => {
    document.documentElement.style.zoom = '1';
  });
  readonly = false;
  await page.goto(orgUrl);
  await visible(page.getByText('53', { exact: true }).first());
  expireDashboard = true;
  await page
    .getByRole('button', { name: 'Actualizar resumen', exact: true })
    .click();
  await page.waitForURL('**/login**');
  await visible(
    page.getByRole('heading', { name: 'Bienvenido de nuevo', exact: true }),
  );
  assert.equal(await page.getByText('53', { exact: true }).count(), 0);
  assert.equal(
    await page.getByRole('navigation', { name: 'Espacio de trabajo' }).count(),
    0,
  );
  console.log(
    'PASS API 401 hides loaded private organization content and requires a fresh login',
  );
  const privateRequestsBefore = organizationRequests.length;
  await page.goto(`${orgUrl}/operations/${operations[0].id}`);
  await page.waitForURL('**/login**');
  await visible(
    page.getByRole('heading', { name: 'Bienvenido de nuevo', exact: true }),
  );
  assert.equal(
    organizationRequests.length,
    privateRequestsBefore,
    'anonymous private deep link does not request organization data',
  );
  assert.equal(
    await page.getByRole('navigation', { name: 'Espacio de trabajo' }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS anonymous operation deep URL redirects before requesting tenant content',
  );
  authenticated = true;
  expireDashboard = false;
  assuranceRequired = true;
  for (const enrolled of [false, true]) {
    assuranceEnrolled = enrolled;
    const beforeAssurance = organizationRequests.length;
    await page.goto(`${orgUrl}/operations/${operations[0].id}`);
    await page.waitForURL('**/security**');
    assert.equal(
      organizationRequests.length,
      beforeAssurance,
      'required MFA blocks tenant queries before enrollment and before this session is verified',
    );
    assert.equal(
      await page
        .getByRole('navigation', { name: 'Espacio de trabajo' })
        .count(),
      0,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    'PASS required MFA blocks private deep links for unenrolled accounts and enrolled but unverified sessions',
  );
  assuranceEnrolled = false;
  await page.goto(
    `${base}/security?returnTo=${encodeURIComponent(`/organizations/${org}`)}`,
  );
  await page
    .getByLabel('Contraseña actual', { exact: true })
    .fill('synthetic-password-only');
  await page
    .getByRole('button', {
      name: 'Configurar aplicación autenticadora',
      exact: true,
    })
    .click();
  await visible(page.getByText('synthetic-backup-one', { exact: true }));
  const enrollmentQr = page.getByRole('img', {
    name: 'QR para configurar tu aplicación autenticadora',
    exact: true,
  });
  await visible(enrollmentQr);
  assert.match(
    await enrollmentQr.getAttribute('src'),
    /^data:image\/png;base64,/,
  );
  await visible(page.getByText('JBSWY3DPEHPK3PXP', { exact: true }));
  assert.equal(mfaWrites.at(-1).body.password, 'synthetic-password-only');
  const activate = page.getByRole('button', {
    name: 'Verificar y activar protección',
    exact: true,
  });
  assert.equal(
    await activate.isDisabled(),
    true,
    'recovery acknowledgment precedes activation',
  );
  await page
    .getByRole('checkbox', {
      name: 'Guardé mis códigos de recuperación',
      exact: true,
    })
    .check();
  await page
    .getByLabel('Código de verificación', { exact: true })
    .fill('123456');
  await activate.click();
  await visible(
    page.getByRole('status').filter({ hasText: 'Protección activada.' }),
  );
  assert.equal(mfaWrites.at(-1).body.code, '123456');
  assert.equal(mfaWrites.at(-1).body.trustDevice, false);
  const persisted = await page.evaluate(() =>
    JSON.stringify({
      local: { ...window.localStorage },
      session: { ...window.sessionStorage },
    }),
  );
  assert.equal(persisted.includes('JBSWY3DPEHPK3PXP'), false);
  assert.equal(persisted.includes('synthetic-backup-one'), false);
  await page
    .getByRole('button', { name: 'Continuar a la aplicación', exact: true })
    .click();
  await visible(page.getByRole('heading', { name: 'Resumen', exact: true }));
  assert.equal(
    await page.getByText('synthetic-backup-one', { exact: true }).count(),
    0,
  );
  console.log(
    'PASS MFA enrollment uses shared controls, requires recovery acknowledgment and clears secret UI after activation',
  );
  await page.goto(
    `${base}/two-factor?returnTo=${encodeURIComponent(`/organizations/${org}`)}`,
  );
  await page
    .getByRole('button', { name: 'Usar código de recuperación', exact: true })
    .click();
  await page
    .getByLabel('Código de recuperación', { exact: true })
    .fill('synthetic-backup-one');
  await page
    .getByRole('button', { name: 'Verificar acceso', exact: true })
    .click();
  await visible(page.getByRole('heading', { name: 'Resumen', exact: true }));
  assert.equal(
    mfaWrites.at(-1).path,
    '/api/auth/two-factor/verify-backup-code',
  );
  assert.equal(mfaWrites.at(-1).body.code, 'synthetic-backup-one');
  assert.equal(mfaWrites.at(-1).body.trustDevice, false);
  assert.deepEqual(errors, []);
  console.log(
    'PASS MFA backup challenge submits explicit recovery code and returns to authorized workspace',
  );
  const oldDashboard = requestGate();
  heldDashboard = oldDashboard;
  await page
    .getByRole('button', { name: 'Actualizar resumen', exact: true })
    .click();
  await oldDashboard.arrived;
  const secondContext = requestGate();
  heldContext = secondContext;
  sessionUser = id(999);
  const oldRequestCancelled = page.waitForEvent('requestfailed', (request) =>
    request.url().endsWith('/dashboard'),
  );
  // Exercise the actual shared authentication transition signal while an old
  // identity request is in flight; the mocked server now returns user B.
  await page.evaluate(() =>
    window.dispatchEvent(new Event('reconcile:authentication-changed')),
  );
  await secondContext.arrived;
  await oldRequestCancelled;
  assert.equal(
    await page.getByText('53', { exact: true }).count(),
    0,
    'old identity data is hidden while new membership is pending',
  );
  heldDashboard = null;
  oldDashboard.release();
  assert.equal(
    await page.getByText('53', { exact: true }).count(),
    0,
    'late old-identity response does not restore private data',
  );
  heldContext = null;
  secondContext.release();
  await visible(page.getByText('7', { exact: true }).first());
  assert.equal(await page.getByText('53', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS same-tab identity switch hides cached private data, cancels in-flight old scope and waits for new membership',
  );
} finally {
  await browser.close();
}

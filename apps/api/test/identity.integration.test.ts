import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuth } from '@reconcile/auth';
import { parseAuthConfig } from '@reconcile/config';
import { PrismaClient } from '@reconcile/database';
import { createApplication } from '../src/application.js';

type Mail = {
  to: string;
  url: string;
  kind: 'verification' | 'password-reset' | 'invitation';
};
type Browser = { email: string; cookies: Map<string, string>; address: string };

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an HTTP object response');
  }
  return Object.fromEntries(Object.entries(value));
}
function text(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('Expected an HTTP string field');
  return value;
}
function body(response: { body: string }): Record<string, unknown> {
  const parsed: unknown = JSON.parse(response.body);
  return record(parsed);
}

describe('identity and tenant boundaries through real Better Auth HTTP', () => {
  const origin = 'http://localhost:3000';
  const password = 'Synthetic-Identity-Password-837!';
  const mails: Mail[] = [];
  const userIds = new Set<string>();
  const organizationIds = new Set<string>();
  let nextClientAddress = 10;
  const prisma = new PrismaClient();
  let app: Awaited<ReturnType<typeof createApplication>>;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'Integration suite requires an isolated PostgreSQL DATABASE_URL',
      );
    }
    const config = parseAuthConfig({
      ...process.env,
      NODE_ENV: 'test',
      AUTH_BASE_URL: 'http://localhost:3000',
      WEB_ORIGIN: origin,
      AUTH_SECRET:
        'synthetic-integration-secret-at-least-thirty-two-characters',
      MAIL_MODE: 'capture',
      MAIL_FROM: 'demo@example.invalid',
    });
    const auth = createAuth({
      prisma,
      config,
      captureMail: async (message) => {
        mails.push(message);
      },
    });
    app = await createApplication({ auth, prisma });
  });

  afterAll(async () => {
    if (userIds.size > 0) {
      await prisma.identityAuditEvent.deleteMany({
        where: { actorId: { in: [...userIds] } },
      });
    }
    for (const id of organizationIds) {
      await prisma.organization.deleteMany({ where: { id } });
    }
    for (const id of userIds) {
      await prisma.user.deleteMany({ where: { id } });
    }
    if (app) await app.close();
    await prisma.$disconnect();
  });

  async function request(
    url: string,
    browser?: Browser,
    payload?: Record<string, unknown>,
    requestOrigin = origin,
    extraHeaders: Record<string, string> = {},
  ) {
    const response = await app.inject({
      method: payload ? 'POST' : 'GET',
      url,
      remoteAddress: browser?.address ?? '203.0.113.250',
      headers: {
        ...extraHeaders,
        origin: requestOrigin,
        cookie: browser
          ? [...browser.cookies]
              .map(([key, value]) => `${key}=${value}`)
              .join('; ')
          : '',
      },
      ...(payload ? { payload } : {}),
    });
    if (browser) {
      const setCookie = response.headers['set-cookie'];
      const values =
        typeof setCookie === 'string' ? [setCookie] : (setCookie ?? []);
      for (const value of values) {
        const pair = value.split(';', 1)[0];
        if (!pair) continue;
        const separator = pair.indexOf('=');
        const key = pair.slice(0, separator);
        const cookieValue = pair.slice(separator + 1);
        if (!cookieValue || /max-age=0/i.test(value))
          browser.cookies.delete(key);
        else browser.cookies.set(key, cookieValue);
      }
    }
    return response;
  }

  function captured(email: string, kind: Mail['kind']): Mail {
    const message = mails.findLast(
      (mail) => mail.to === email && mail.kind === kind,
    );
    if (!message) throw new Error(`Missing captured ${kind} mail`);
    return message;
  }
  function localUrl(url: string): string {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  }
  async function register(): Promise<Browser> {
    const browser = {
      email: `identity-${randomUUID()}@example.invalid`,
      cookies: new Map<string, string>(),
      address: `203.0.113.${nextClientAddress++}`,
    };
    const response = await request('/api/auth/sign-up/email', browser, {
      email: browser.email,
      name: 'Synthetic QA User',
      password,
    });
    expect(response.statusCode, response.body).toBe(200);
    userIds.add(text(record(body(response).user).id));
    return browser;
  }
  async function login(browser: Browser, userPassword = password) {
    return request('/api/auth/sign-in/email', browser, {
      email: browser.email,
      password: userPassword,
    });
  }
  async function verifiedUser(): Promise<Browser> {
    const browser = await register();
    const verification = await request(
      localUrl(captured(browser.email, 'verification').url),
      browser,
    );
    expect(verification.statusCode, verification.body).toBeLessThan(400);
    const response = await login(browser);
    expect(response.statusCode, response.body).toBe(200);
    expect(browser.cookies.size).toBeGreaterThan(0);
    return browser;
  }
  async function organization(owner: Browser): Promise<string> {
    const response = await request('/api/auth/organization/create', owner, {
      name: 'Synthetic QA Organization',
      slug: `qa-${randomUUID()}`,
    });
    expect(response.statusCode, response.body).toBe(200);
    const id = text(body(response).id);
    organizationIds.add(id);
    return id;
  }
  async function invite(
    owner: Browser,
    organizationId: string,
    invitee: Browser,
    role = 'viewer',
  ) {
    const response = await request(
      '/api/auth/organization/invite-member',
      owner,
      {
        organizationId,
        email: invitee.email,
        role,
      },
    );
    expect(response.statusCode, response.body).toBe(200);
    return text(body(response).id);
  }
  async function accept(invitee: Browser, invitationId: string) {
    return request('/api/auth/organization/accept-invitation', invitee, {
      invitationId,
    });
  }
  const context = (id: string, browser?: Browser) =>
    request(`/api/v1/organizations/${id}/context`, browser);
  const rejected = (response: { statusCode: number; body: string }) => {
    expect(response.statusCode, response.body).toBeGreaterThanOrEqual(400);
    expect(response.statusCode, response.body).toBeLessThan(500);
  };

  it('requires verification before login and denies anonymous context access', async () => {
    const browser = await register();
    rejected(await login(browser));
    rejected(
      await request('/api/auth/organization/create', browser, {
        name: 'Denied',
        slug: `denied-${randomUUID()}`,
      }),
    );
    rejected(await context(randomUUID()));
    const response = await request(
      localUrl(captured(browser.email, 'verification').url),
      browser,
    );
    expect(response.statusCode, response.body).toBeLessThan(400);
    expect((await login(browser)).statusCode).toBe(200);
  });

  it('creates the canonical UUID organization and isolates tenant URLs and active organization', async () => {
    const alice = await verifiedUser();
    const bob = await verifiedUser();
    const aliceId = await organization(alice);
    const bobId = await organization(bob);
    expect(aliceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(
      await prisma.organization.findUnique({ where: { id: aliceId } }),
    ).not.toBeNull();
    const ownContext = await context(aliceId, alice);
    expect(ownContext.statusCode, ownContext.body).toBe(200);
    expect(record(body(ownContext).membership).role).toBe('owner');
    rejected(await context(bobId, alice));
    rejected(
      await request('/api/auth/organization/set-active', alice, {
        organizationId: bobId,
      }),
    );
    rejected(await context(bobId, alice));
    // Even stale or corrupted active-org state must never replace membership authorization.
    await prisma.session.updateMany({
      where: { user: { email: alice.email } },
      data: { activeOrganizationId: bobId },
    });
    rejected(await context(bobId, alice));
    expect((await context(aliceId, alice)).statusCode).toBe(200);
    const aliceUser = await prisma.user.findUniqueOrThrow({
      where: { email: alice.email },
    });
    const audit = await prisma.identityAuditEvent.findMany({
      where: { actorId: aliceUser.id },
    });
    expect(
      audit.some(
        (event) =>
          event.action === 'session.created' &&
          event.outcome === 'success' &&
          event.organizationId === null,
      ),
    ).toBe(true);
    const contextAudit = audit.filter(
      (event) => event.action === 'organization.context',
    );
    expect(
      contextAudit.some(
        (event) =>
          event.outcome === 'success' && event.organizationId === aliceId,
      ),
    ).toBe(true);
    expect(
      contextAudit.some(
        (event) => event.outcome === 'denied' && event.organizationId === null,
      ),
    ).toBe(true);
    expect(
      contextAudit.every((event) =>
        event.outcome === 'success'
          ? event.organizationId === aliceId
          : event.organizationId === null,
      ),
    ).toBe(true);
    for (const event of audit) {
      expect(Object.keys(event).sort()).toEqual(
        [
          'action',
          'actorId',
          'createdAt',
          'id',
          'organizationId',
          'outcome',
          'requestId',
        ].sort(),
      );
      expect(JSON.stringify(event)).not.toContain(alice.email);
      for (const token of alice.cookies.values())
        expect(JSON.stringify(event)).not.toContain(token);
    }
  });

  it('accepts only matching verified invitees, prevents replay and permits authorized switching', async () => {
    const owner = await verifiedUser();
    const invitee = await verifiedUser();
    const stranger = await verifiedUser();
    const orgId = await organization(owner);
    const otherOrgId = await organization(invitee);
    const invitationId = await invite(owner, orgId, invitee);
    expect(captured(invitee.email, 'invitation').url).toContain(invitationId);
    rejected(await accept(stranger, invitationId));
    rejected(await context(orgId, stranger));
    expect((await accept(invitee, invitationId)).statusCode).toBe(200);
    expect((await context(orgId, invitee)).statusCode).toBe(200);
    rejected(await accept(invitee, invitationId));
    for (const id of [orgId, otherOrgId]) {
      expect(
        (
          await request('/api/auth/organization/set-active', invitee, {
            organizationId: id,
          })
        ).statusCode,
      ).toBe(200);
      expect((await context(id, invitee)).statusCode).toBe(200);
    }
  });

  it('rejects expired and cancelled invitations', async () => {
    const owner = await verifiedUser();
    const invitee = await verifiedUser();
    const orgId = await organization(owner);
    const expiredId = await invite(owner, orgId, invitee);
    await prisma.invitation.update({
      where: { id: expiredId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    rejected(await accept(invitee, expiredId));
    const cancelledId = await invite(owner, orgId, invitee);
    expect(
      (
        await request('/api/auth/organization/cancel-invitation', owner, {
          invitationId: cancelledId,
        })
      ).statusCode,
    ).toBe(200);
    rejected(await accept(invitee, cancelledId));
    rejected(await context(orgId, invitee));
  });

  it.each(['viewer', 'analyst'])(
    'prevents %s invitation and privilege escalation',
    async (role) => {
      const owner = await verifiedUser();
      const member = await verifiedUser();
      const target = await verifiedUser();
      const orgId = await organization(owner);
      expect(
        (await accept(member, await invite(owner, orgId, member, role)))
          .statusCode,
      ).toBe(200);
      rejected(
        await request('/api/auth/organization/invite-member', member, {
          organizationId: orgId,
          email: target.email,
          role: 'viewer',
        }),
      );
      const membership = await prisma.member.findFirstOrThrow({
        where: { organizationId: orgId, user: { email: member.email } },
      });
      rejected(
        await request('/api/auth/organization/update-member-role', member, {
          organizationId: orgId,
          memberId: membership.id,
          role: 'owner',
        }),
      );
      expect(record(body(await context(orgId, member)).membership).role).toBe(
        role,
      );
    },
  );

  it('applies role and membership revocation immediately to an existing session', async () => {
    const owner = await verifiedUser();
    const member = await verifiedUser();
    const orgId = await organization(owner);
    expect(
      (await accept(member, await invite(owner, orgId, member, 'analyst')))
        .statusCode,
    ).toBe(200);
    const membership = await prisma.member.findFirstOrThrow({
      where: { organizationId: orgId, user: { email: member.email } },
    });
    expect(
      (
        await request('/api/auth/organization/update-member-role', owner, {
          organizationId: orgId,
          memberId: membership.id,
          role: 'viewer',
        })
      ).statusCode,
    ).toBe(200);
    expect(record(body(await context(orgId, member)).membership).role).toBe(
      'viewer',
    );
    expect(
      (
        await request('/api/auth/organization/remove-member', owner, {
          organizationId: orgId,
          memberIdOrEmail: membership.id,
        })
      ).statusCode,
    ).toBe(200);
    rejected(await context(orgId, member));
  });

  it('allows an admin to invite a viewer while protecting owner and admin roles', async () => {
    const owner = await verifiedUser();
    const admin = await verifiedUser();
    const invitee = await verifiedUser();
    const orgId = await organization(owner);
    expect(
      (await accept(admin, await invite(owner, orgId, admin, 'analyst')))
        .statusCode,
    ).toBe(200);
    const adminMember = await prisma.member.findFirstOrThrow({
      where: { organizationId: orgId, user: { email: admin.email } },
    });
    expect(
      (
        await request('/api/auth/organization/update-member-role', owner, {
          organizationId: orgId,
          memberId: adminMember.id,
          role: 'admin',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await accept(invitee, await invite(admin, orgId, invitee, 'viewer')))
        .statusCode,
    ).toBe(200);
    rejected(
      await request('/api/auth/organization/invite-member', admin, {
        organizationId: orgId,
        email: `privileged-${randomUUID()}@example.invalid`,
        role: 'admin',
      }),
    );
    const ownerMember = await prisma.member.findFirstOrThrow({
      where: { organizationId: orgId, user: { email: owner.email } },
    });
    rejected(
      await request('/api/auth/organization/update-member-role', admin, {
        organizationId: orgId,
        memberId: ownerMember.id,
        role: 'viewer',
      }),
    );
    rejected(
      await request('/api/auth/organization/remove-member', admin, {
        organizationId: orgId,
        memberIdOrEmail: ownerMember.id,
      }),
    );
    expect(record(body(await context(orgId, owner)).membership).role).toBe(
      'owner',
    );
  });

  it('rejects hostile origins and preserves every authentication Set-Cookie header', async () => {
    const browser = await verifiedUser();
    rejected(
      await request(
        '/api/auth/organization/create',
        browser,
        { name: 'Hostile', slug: `hostile-${randomUUID()}` },
        'https://evil.example.invalid',
      ),
    );
    const response = await login(browser);
    const cookies = response.headers['set-cookie'];
    expect(
      Array.isArray(cookies),
      'Adapter must preserve separate Set-Cookie headers',
    ).toBe(true);
    expect(cookies?.length).toBeGreaterThan(1);
    const values = typeof cookies === 'string' ? [cookies] : (cookies ?? []);
    expect(
      values.some(
        (cookie) => /session_token=/.test(cookie) && /httponly/i.test(cookie),
      ),
    ).toBe(true);
  });

  it('limits repeated login attempts by socket address despite forged forwarding headers', async () => {
    const browser = await verifiedUser();
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await login(browser, 'Wrong-Synthetic-Password-991!');
      expect(response.statusCode).toBe(401);
    }
    const limited = await request(
      '/api/auth/sign-in/email',
      browser,
      {
        email: browser.email,
        password,
      },
      origin,
      {
        'x-forwarded-for': '198.51.100.200',
        'x-reconcile-client-ip': '198.51.100.201',
      },
    );
    expect(limited.statusCode, limited.body).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('makes reset tokens single-use and revokes pre-reset sessions', async () => {
    const browser = await verifiedUser();
    const orgId = await organization(browser);
    const priorSession = {
      email: browser.email,
      cookies: new Map(browser.cookies),
      address: browser.address,
    };
    const reset = await request('/api/auth/request-password-reset', undefined, {
      email: browser.email,
      redirectTo: `${origin}/reset-password`,
    });
    expect(reset.statusCode, reset.body).toBe(200);
    const resetCallback = await request(
      localUrl(captured(browser.email, 'password-reset').url),
    );
    expect(resetCallback.statusCode).toBe(302);
    const token = new URL(
      text(resetCallback.headers.location),
    ).searchParams.get('token');
    expect(token).toBeTruthy();
    const newPassword = 'Changed-Synthetic-Password-937!';
    expect(
      (
        await request('/api/auth/reset-password', undefined, {
          token,
          newPassword,
        })
      ).statusCode,
    ).toBe(200);
    rejected(
      await request('/api/auth/reset-password', undefined, {
        token,
        newPassword,
      }),
    );
    rejected(await context(orgId, priorSession));
    rejected(
      await login({
        email: browser.email,
        cookies: new Map(),
        address: browser.address,
      }),
    );
    expect((await login(browser, newPassword)).statusCode).toBe(200);
    const signedInCookies = {
      email: browser.email,
      cookies: new Map(browser.cookies),
      address: browser.address,
    };
    expect((await request('/api/auth/sign-out', browser, {})).statusCode).toBe(
      200,
    );
    rejected(await context(orgId, signedInCookies));
  });
});

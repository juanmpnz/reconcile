import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  useIdentityFixture,
  record,
  text,
  body,
  records,
} from './support/identity-fixture.js';

describe('identity and tenant boundaries through real Better Auth HTTP', () => {
  const {
    origin,
    password,
    prisma,
    organizationIds,
    request,
    captured,
    localUrl,
    register,
    login,
    verifiedUser,
    organization,
    invite,
    accept,
    context,
    rejected,
  } = useIdentityFixture();

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
    const verificationUrl = localUrl(
      captured(browser.email, 'verification').url,
    );
    rejected(
      await request(
        verificationUrl,
        browser,
        undefined,
        'https://evil.example.invalid',
      ),
    );
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: browser.email } }))
        .emailVerified,
    ).toBe(false);
    const response = await request(verificationUrl, browser, undefined, null);
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
          'details',
          'id',
          'organizationId',
          'outcome',
          'requestId',
        ].sort(),
      );
      expect(event.details).toBeNull();
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

  it('scopes native member and invitation listings to current membership, including revocation', async () => {
    const owner = await verifiedUser();
    const viewer = await verifiedUser();
    const foreignOwner = await verifiedUser();
    const pendingInvitee = await verifiedUser();
    const orgId = await organization(owner);
    const foreignOrgId = await organization(foreignOwner);
    expect(
      (await accept(viewer, await invite(owner, orgId, viewer))).statusCode,
    ).toBe(200);
    const pendingId = await invite(owner, orgId, pendingInvitee, 'analyst');
    for (const member of [owner, viewer]) {
      const members = await request(
        `/api/auth/organization/list-members?organizationId=${orgId}&limit=1&offset=0`,
        member,
      );
      expect(members.statusCode, members.body).toBe(200);
      expect(body(members).total).toBe(2);
      const memberRows = records(body(members).members);
      expect(memberRows).toHaveLength(1);
      expect(memberRows.every((row) => row.organizationId === orgId)).toBe(
        true,
      );
      const invitations = await request(
        `/api/auth/organization/list-invitations?organizationId=${orgId}`,
        member,
      );
      expect(invitations.statusCode, invitations.body).toBe(200);
      const parsedInvitations: unknown = JSON.parse(invitations.body);
      const invitationRows = records(parsedInvitations);
      expect(invitationRows.every((row) => row.organizationId === orgId)).toBe(
        true,
      );
      expect(
        invitationRows.some(
          (row) =>
            row.id === pendingId &&
            row.email === pendingInvitee.email &&
            row.status === 'pending',
        ),
      ).toBe(true);
      for (const endpoint of ['list-members', 'list-invitations']) {
        const denied = await request(
          `/api/auth/organization/${endpoint}?organizationId=${foreignOrgId}`,
          member,
        );
        rejected(denied);
        expect(denied.body).not.toContain(foreignOwner.email);
      }
    }
    const membership = await prisma.member.findFirstOrThrow({
      where: { organizationId: orgId, user: { email: viewer.email } },
    });
    expect(
      (
        await request('/api/auth/organization/remove-member', owner, {
          organizationId: orgId,
          memberIdOrEmail: membership.id,
        })
      ).statusCode,
    ).toBe(200);
    for (const endpoint of ['list-members', 'list-invitations']) {
      const denied = await request(
        `/api/auth/organization/${endpoint}?organizationId=${orgId}`,
        viewer,
      );
      rejected(denied);
      expect(denied.body).not.toContain(pendingInvitee.email);
    }
  });

  it.each(['viewer', 'analyst'])(
    'prevents %s and foreign owners from cancelling another organization invitation',
    async (role) => {
      const owner = await verifiedUser();
      const member = await verifiedUser();
      const foreignOwner = await verifiedUser();
      const invitee = await verifiedUser();
      const orgId = await organization(owner);
      await organization(foreignOwner);
      expect(
        (await accept(member, await invite(owner, orgId, member, role)))
          .statusCode,
      ).toBe(200);
      const invitationId = await invite(owner, orgId, invitee);
      for (const deniedActor of [member, foreignOwner]) {
        rejected(
          await request(
            '/api/auth/organization/cancel-invitation',
            deniedActor,
            { invitationId },
          ),
        );
        expect(
          (
            await prisma.invitation.findUniqueOrThrow({
              where: { id: invitationId },
            })
          ).status,
        ).toBe('pending');
      }
      expect(
        (
          await request('/api/auth/organization/cancel-invitation', owner, {
            invitationId,
          })
        ).statusCode,
      ).toBe(200);
      const list = await request(
        `/api/auth/organization/list-invitations?organizationId=${orgId}`,
        owner,
      );
      expect(list.statusCode, list.body).toBe(200);
      const parsed: unknown = JSON.parse(list.body);
      expect(
        records(parsed).some(
          (row) => row.id === invitationId && row.status === 'canceled',
        ),
      ).toBe(true);
      rejected(await accept(invitee, invitationId));
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
    const pendingInvitee = await verifiedUser();
    const pendingInvitationId = await invite(admin, orgId, pendingInvitee);
    expect(
      (
        await request('/api/auth/organization/cancel-invitation', admin, {
          invitationId: pendingInvitationId,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await prisma.invitation.findUniqueOrThrow({
          where: { id: pendingInvitationId },
        })
      ).status,
    ).toBe('canceled');
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

  it.each([
    'https://evil.example.invalid',
    'null',
    'http://localhost:3001',
    'http://localhost.evil.example.invalid:3000',
  ])(
    'rejects hostile Origin %s without creating an organization',
    async (hostileOrigin) => {
      const browser = await verifiedUser();
      const slug = `hostile-${randomUUID()}`;
      const response = await request(
        '/api/auth/organization/create',
        browser,
        { name: 'Hostile', slug },
        hostileOrigin,
      );
      const created = await prisma.organization.findUnique({ where: { slug } });
      if (created) organizationIds.add(created.id);
      rejected(response);
      expect(created).toBeNull();
    },
  );

  it.each(['', 'https://evil.example.invalid/form'])(
    'rejects missing Origin with Referer %s',
    async (referer) => {
      const browser = await verifiedUser();
      const slug = `referer-${randomUUID()}`;
      const response = await request(
        '/api/auth/organization/create',
        browser,
        { name: 'Hostile Referer', slug },
        null,
        referer ? { referer } : {},
      );
      const created = await prisma.organization.findUnique({ where: { slug } });
      if (created) organizationIds.add(created.id);
      rejected(response);
      expect(created).toBeNull();
    },
  );

  it('rejects cross-site Fetch Metadata even when the Origin header claims the trusted origin', async () => {
    const browser = await verifiedUser();
    const slug = `cross-site-${randomUUID()}`;
    const response = await request(
      '/api/auth/organization/create',
      browser,
      { name: 'Cross-site', slug },
      origin,
      { 'sec-fetch-site': 'cross-site' },
    );
    const created = await prisma.organization.findUnique({ where: { slug } });
    if (created) organizationIds.add(created.id);
    rejected(response);
    expect(created).toBeNull();
  });

  it('preserves separate session and do-not-remember Set-Cookie headers', async () => {
    const browser = await verifiedUser();
    // Native Better Auth emits both cookies for rememberMe:false even with cookieCache disabled.
    const response = await request('/api/auth/sign-in/email', browser, {
      email: browser.email,
      password,
      rememberMe: false,
    });
    expect(response.statusCode, response.body).toBe(200);
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
    expect(
      values.some(
        (cookie) => /dont_remember=/.test(cookie) && /httponly/i.test(cookie),
      ),
    ).toBe(true);
    expect(new Set(values.map((cookie) => cookie.split('=', 1)[0])).size).toBe(
      values.length,
    );
    const orgId = await organization(browser);
    expect((await context(orgId, browser)).statusCode).toBe(200);
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
    const nativeRetryAfter = text(limited.headers['x-retry-after']);
    expect(limited.headers['retry-after']).toBe(nativeRetryAfter);
    expect(Number(nativeRetryAfter)).toBeGreaterThan(0);
    expect(Number(nativeRetryAfter)).toBeLessThanOrEqual(10);
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

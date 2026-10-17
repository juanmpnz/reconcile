import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { useIdentityFixture } from './support/identity-fixture.js';

describe('shared business boundary through real HTTP and database sessions', () => {
  const fixture = useIdentityFixture({ addressPrefix: '198.51.101' });
  const { request, prisma, verifiedUser, organization, origin } = fixture;
  const reads = (id: string) => [
    `/api/v1/organizations/${id}/context`,
    `/api/v1/organizations/${id}/dashboard`,
    `/api/v1/organizations/${id}/documents`,
    `/api/v1/organizations/${id}/operations`,
    `/api/v1/organizations/${id}/agreements`,
    `/api/v1/organizations/${id}/operations/${randomUUID()}/review`,
  ];

  it('marks auth success, auth denial and business failures private and non-cacheable', async () => {
    const user = await verifiedUser();
    const org = await organization(user);
    const responses = [
      await request('/api/auth/get-session', user),
      await request('/api/auth/sign-out', user, {}, null),
      await request(`/api/v1/organizations/${org}/dashboard`),
      await request(`/api/v1/organizations/not-a-uuid/documents`, user),
    ];
    expect(responses.map((response) => response.statusCode)).toEqual([
      200, 403, 401, 404,
    ]);
    for (const response of responses) {
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers.pragma).toBe('no-cache');
    }
  });

  it('checks database sessions on every route after expiration and revocation', async () => {
    const user = await verifiedUser();
    const org = await organization(user);
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { email: user.email },
    });
    const session = await prisma.session.findFirstOrThrow({
      where: { userId: dbUser.id },
    });
    const lifetime = session.expiresAt.getTime() - session.createdAt.getTime();
    expect(lifetime).toBeGreaterThan(7.9 * 60 * 60 * 1000);
    expect(lifetime).toBeLessThanOrEqual(8 * 60 * 60 * 1000 + 1000);
    await prisma.session.updateMany({
      where: { userId: dbUser.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    for (const path of reads(org))
      expect((await request(path, user)).statusCode).toBe(401);
    expect((await fixture.login(user)).statusCode).toBe(200);
    expect((await request(reads(org)[1] ?? '', user)).statusCode).toBe(200);
    await prisma.session.deleteMany({ where: { userId: dbUser.id } });
    for (const path of reads(org))
      expect((await request(path, user)).statusCode).toBe(401);
  });

  it('denies foreign tenants and removed members across all read route families', async () => {
    const owner = await verifiedUser();
    const stranger = await verifiedUser();
    const org = await organization(owner);
    for (const path of reads(org))
      expect((await request(path, stranger)).statusCode).toBe(404);
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { email: owner.email },
    });
    await prisma.member.deleteMany({
      where: { organizationId: org, userId: dbUser.id },
    });
    for (const path of reads(org))
      expect((await request(path, owner)).statusCode).toBe(404);
  });

  it('rejects missing, cross-site and lookalike origins before every business mutation family', async () => {
    const user = await verifiedUser();
    const org = await organization(user);
    const paths = [
      `/api/v1/organizations/${org}/documents`,
      `/api/v1/organizations/${org}/operations`,
      `/api/v1/organizations/${org}/agreements`,
      `/api/v1/organizations/${org}/operations/${randomUUID()}/claims`,
    ];
    for (const path of paths) {
      for (const badOrigin of [
        null,
        `${origin}.evil.invalid`,
        'https://evil.invalid',
      ]) {
        const response = await request(path, user, {}, badOrigin);
        expect(response.statusCode, response.body).toBe(403);
        expect(response.json()).toEqual({ code: 'UNTRUSTED_ORIGIN' });
      }
      const crossSite = await request(path, user, {}, origin, {
        'sec-fetch-site': 'cross-site',
      });
      expect(crossSite.statusCode, crossSite.body).toBe(403);
    }
  });

  it('applies atomic per-user mutation budgets independent of forged IP headers', async () => {
    const user = await verifiedUser();
    const org = await organization(user);
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { email: user.email },
    });
    const now = BigInt(Date.now());
    for (const bucket of ['document', 'analysis', 'claim']) {
      const key = `${bucket}-mutation:${dbUser.id}`;
      await prisma.rateLimit.upsert({
        where: { key },
        create: { key, count: 100, lastRequest: now },
        update: { count: 100, lastRequest: now },
      });
    }
    const paths = [
      `/api/v1/organizations/${org}/documents`,
      `/api/v1/organizations/${org}/operations`,
      `/api/v1/organizations/${org}/agreements`,
      `/api/v1/organizations/${org}/operations/${randomUUID()}/claims`,
    ];
    for (const path of paths) {
      const response = await request(path, user, {}, origin, {
        'x-forwarded-for': randomUUID(),
        'x-reconcile-client-ip': '192.0.2.99',
      });
      expect(response.statusCode, response.body).toBe(429);
      expect(response.headers['retry-after']).toBe('60');
    }
    await prisma.rateLimit.deleteMany({
      where: {
        key: {
          in: ['document', 'analysis', 'claim'].map(
            (bucket) => `${bucket}-mutation:${dbUser.id}`,
          ),
        },
      },
    });
  });
});

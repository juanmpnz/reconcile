import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect } from 'vitest';
import { createAuth } from '@reconcile/auth';
import { parseAuthConfig } from '@reconcile/config';
import { PrismaClient } from '@reconcile/database';
import { createApplication } from '../../src/application.js';

type Mail = {
  to: string;
  url: string;
  kind: 'verification' | 'password-reset' | 'invitation';
};
export type Browser = {
  email: string;
  cookies: Map<string, string>;
  address: string;
};

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected an HTTP object response');
  }
  return Object.fromEntries(Object.entries(value));
}
export function text(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('Expected an HTTP string field');
  return value;
}
export function body(response: { body: string }): Record<string, unknown> {
  const parsed: unknown = JSON.parse(response.body);
  return record(parsed);
}
export function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('Expected an HTTP array response');
  return value.map(record);
}

export function useIdentityFixture(
  options: { addressPrefix?: string; beforeCleanup?: () => Promise<void> } = {},
) {
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
    await options.beforeCleanup?.();
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
    requestOrigin: string | null = origin,
    extraHeaders: Record<string, string> = {},
  ) {
    const response = await app.inject({
      method: payload ? 'POST' : 'GET',
      url,
      remoteAddress: browser?.address ?? '203.0.113.250',
      headers: {
        ...extraHeaders,
        ...(requestOrigin === null ? {} : { origin: requestOrigin }),
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
      address: `${options.addressPrefix ?? '203.0.113'}.${nextClientAddress++}`,
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

  return {
    origin,
    password,
    prisma,
    organizationIds,
    userIds,
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
    get app() {
      if (!app) throw new Error('Integration application is not initialized');
      return app;
    },
  };
}

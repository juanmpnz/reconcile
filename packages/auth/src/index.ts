import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization, twoFactor } from 'better-auth/plugins';
import { createTransport } from 'nodemailer';
import type { PrismaClient } from '@reconcile/database';
import { ac, roles, isOrganizationRole } from './permissions.js';
export interface AuthConfig {
  AUTH_BASE_URL: string;
  WEB_ORIGIN: string;
  AUTH_SECRET: string;
  NODE_ENV: string;
  AUTH_REQUIRE_MFA?: boolean | undefined;
  MAIL_MODE: 'smtp' | 'capture';
  SMTP_HOST?: string;
  SMTP_PORT?: number;
  SMTP_SECURE?: boolean;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  MAIL_FROM: string;
}
export interface AuthMail {
  to: string;
  subject: string;
  text: string;
  url: string;
  kind: 'verification' | 'password-reset' | 'invitation';
}
export interface AuthOptions {
  prisma: PrismaClient;
  config: AuthConfig;
  captureMail?: (message: AuthMail) => void | Promise<void>;
}
const preAssurancePaths = new Set([
  '/get-session',
  '/sign-out',
  '/sign-in/email',
  '/sign-up/email',
  '/verify-email',
  '/send-verification-email',
  '/forget-password',
  '/request-password-reset',
  '/reset-password',
  '/two-factor/enable',
  '/two-factor/get-totp-uri',
  '/two-factor/verify-totp',
  '/two-factor/verify-backup-code',
]);
const requiredMfaInstances = new WeakSet<object>();
export const authRequiresMfa = (auth: object): boolean =>
  requiredMfaInstances.has(auth);
const forbidden = () =>
  new APIError('FORBIDDEN', {
    message: 'This organization action is not permitted.',
  });
export function createAuth({ prisma, config, captureMail }: AuthOptions) {
  const requireMfa =
    config.AUTH_REQUIRE_MFA ?? config.NODE_ENV === 'production';
  const base = new URL(config.AUTH_BASE_URL);
  const web = new URL(config.WEB_ORIGIN);
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/' ||
    web.origin !== config.WEB_ORIGIN
  )
    throw new Error('Invalid auth URL configuration');
  if (config.AUTH_SECRET.length < 32)
    throw new Error('Auth secret must contain at least 32 characters');
  if (
    config.MAIL_MODE === 'capture' &&
    (config.NODE_ENV !== 'test' || !captureMail)
  )
    throw new Error('Capture email requires a test-only sink');
  if (
    config.NODE_ENV === 'production' &&
    (base.protocol !== 'https:' ||
      web.protocol !== 'https:' ||
      config.MAIL_MODE !== 'smtp' ||
      !config.SMTP_HOST ||
      (!config.SMTP_SECURE && config.SMTP_PORT !== 587))
  )
    throw new Error('Production auth requires HTTPS and SMTP TLS');
  if (config.MAIL_MODE === 'smtp' && !config.SMTP_HOST)
    throw new Error('SMTP host is required');
  const transport =
    config.MAIL_MODE === 'smtp'
      ? createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT ?? 1025,
          secure: config.SMTP_SECURE ?? false,
          requireTLS: config.NODE_ENV === 'production',
          ...(config.SMTP_USER
            ? { auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } }
            : {}),
        })
      : undefined;
  async function send(message: AuthMail) {
    if (config.MAIL_MODE === 'capture') {
      await captureMail?.(message);
      return;
    }
    await transport?.sendMail({
      from: config.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
  async function assertManager(userId: string, organizationId: string) {
    const actor = await prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!actor || (actor.role !== 'owner' && actor.role !== 'admin'))
      throw forbidden();
    return actor;
  }
  const auth = betterAuth({
    baseURL: config.AUTH_BASE_URL,
    basePath: '/api/auth',
    secret: config.AUTH_SECRET,
    trustedOrigins: [config.WEB_ORIGIN],
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
      transaction: true,
    }),
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: { generateId: 'uuid' },
      ipAddress: { ipAddressHeaders: ['x-reconcile-client-ip'] },
      useSecureCookies: config.NODE_ENV === 'production',
    },
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            await prisma.identityAuditEvent.create({
              data: {
                actorId: session.userId,
                action: 'session.created',
                outcome: 'success',
              },
            });
          },
        },
        delete: {
          after: async (session) => {
            await prisma.identityAuditEvent.create({
              data: {
                actorId: session.userId,
                action: 'session.deleted',
                outcome: 'success',
              },
            });
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 8,
      updateAge: 60 * 30,
      freshAge: 60 * 15,
      cookieCache: { enabled: false },
      additionalFields: {
        mfaVerifiedAt: { type: 'date', required: false, input: false },
      },
    },
    rateLimit: { enabled: true, storage: 'database' },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        send({
          to: user.email,
          subject: 'Reset your Reconcile password',
          url,
          text: `Reset your password: ${url}`,
          kind: 'password-reset',
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        send({
          to: user.email,
          subject: 'Verify your Reconcile email',
          url,
          text: `Verify your email: ${url}`,
          kind: 'verification',
        }),
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!preAssurancePaths.has(ctx.path)) {
          const session = await auth.api.getSession({
            headers: ctx.headers ?? new Headers(),
            query: { disableCookieCache: true },
          });
          if (
            session &&
            (requireMfa || session.user.twoFactorEnabled) &&
            (!session.user.twoFactorEnabled || !session.session.mfaVerifiedAt)
          )
            throw new APIError('FORBIDDEN', {
              code: 'MFA_REQUIRED',
              message: 'Complete two-factor verification.',
            });
        }
        if (ctx.path.startsWith('/two-factor/')) {
          if (
            ctx.body &&
            typeof ctx.body === 'object' &&
            Reflect.get(ctx.body, 'trustDevice') === true
          )
            throw new APIError('BAD_REQUEST', {
              code: 'TRUSTED_DEVICES_DISABLED',
              message: 'Verify your second factor on every sign-in.',
            });
          if (requireMfa && ctx.path === '/two-factor/disable')
            throw new APIError('FORBIDDEN', {
              code: 'MFA_REQUIRED',
              message: 'Two-factor authentication is required.',
            });
          if (
            [
              '/two-factor/enable',
              '/two-factor/get-totp-uri',
              '/two-factor/generate-backup-codes',
              '/two-factor/disable',
            ].includes(ctx.path)
          ) {
            const session = await auth.api.getSession({
              headers: ctx.headers ?? new Headers(),
              query: { disableCookieCache: true },
            });
            if (
              session?.user.twoFactorEnabled &&
              !session.session.mfaVerifiedAt
            )
              throw new APIError('FORBIDDEN', {
                code: 'MFA_REQUIRED',
                message:
                  'Verify your current second factor before managing it.',
              });
          }
        }
        if (!ctx.path.startsWith('/organization/')) return;
        const session = await auth.api.getSession({
          headers: ctx.headers ?? new Headers(),
          query: { disableCookieCache: true },
        });
        if (!session?.user.emailVerified) throw forbidden();
        if (
          requireMfa &&
          (!session.user.twoFactorEnabled || !session.session.mfaVerifiedAt)
        )
          throw new APIError('FORBIDDEN', {
            code: 'MFA_REQUIRED',
            message: 'Complete two-factor verification.',
          });
        if (
          ctx.path === '/organization/update-member-role' ||
          ctx.path === '/organization/remove-member'
        ) {
          const body: unknown = ctx.body;
          if (!body || typeof body !== 'object') throw forbidden();
          const input = {
            organizationId: Reflect.get(body, 'organizationId') as unknown,
            memberId: Reflect.get(body, 'memberId') as unknown,
            memberIdOrEmail: Reflect.get(body, 'memberIdOrEmail') as unknown,
            role: Reflect.get(body, 'role') as unknown,
          };
          const orgId =
            typeof input.organizationId === 'string'
              ? input.organizationId
              : session.session.activeOrganizationId;
          if (!orgId) throw forbidden();
          const actor = await assertManager(session.user.id, orgId);
          let target = null;
          if (typeof input.memberId === 'string')
            target = await prisma.member.findUnique({
              where: { id: input.memberId },
            });
          if (typeof input.memberIdOrEmail === 'string')
            target = await prisma.member.findFirst({
              where: {
                organizationId: orgId,
                ...(/^[0-9a-f-]{36}$/i.test(input.memberIdOrEmail)
                  ? { id: input.memberIdOrEmail }
                  : { user: { email: input.memberIdOrEmail } }),
              },
            });
          if (!target || target.organizationId !== orgId) throw forbidden();
          if (target.role === 'owner') throw forbidden();
          if (
            actor.role !== 'owner' &&
            (target.role === 'admin' ||
              input.role === 'admin' ||
              input.role === 'owner')
          )
            throw forbidden();
          if (
            ctx.path.endsWith('update-member-role') &&
            (typeof input.role !== 'string' || !isOrganizationRole(input.role))
          )
            throw forbidden();
        }
      }),
      after: createAuthMiddleware(async (ctx) => {
        if (
          ctx.path !== '/two-factor/verify-totp' &&
          ctx.path !== '/two-factor/verify-backup-code'
        )
          return;
        const result: unknown = ctx.context.returned;
        if (
          !result ||
          typeof result !== 'object' ||
          typeof Reflect.get(result, 'token') !== 'string'
        )
          return;
        const proof = ctx.context.newSession ?? ctx.context.session;
        if (!proof) return;
        const user = await prisma.user.findUnique({
          where: { id: proof.user.id },
        });
        if (!user?.twoFactorEnabled) return;
        await prisma.session.updateMany({
          where: { id: proof.session.id, userId: proof.user.id },
          data: { mfaVerifiedAt: new Date() },
        });
      }),
    },
    plugins: [
      twoFactor({
        issuer: 'Reconcile',
        skipVerificationOnEnable: false,
        accountLockout: {
          enabled: true,
          maxFailedAttempts: 10,
          durationSeconds: 900,
        },
      }),
      organization({
        ac,
        roles,
        creatorRole: 'owner',
        requireEmailVerificationOnInvitation: true,
        allowUserToCreateOrganization: async (user) => user.emailVerified,
        sendInvitationEmail: async (data) => {
          const url = new URL('/accept-invitation', config.WEB_ORIGIN);
          url.searchParams.set('id', data.id);
          await send({
            to: data.email,
            subject: 'Reconcile organization invitation',
            url: url.href,
            text: `Accept invitation: ${url.href}`,
            kind: 'invitation',
          });
        },
        organizationHooks: {
          beforeCreateInvitation: async ({ invitation, inviter }) => {
            await assertManager(inviter.id, invitation.organizationId);
            if (invitation.role !== 'analyst' && invitation.role !== 'viewer')
              throw forbidden();
          },
          beforeAcceptInvitation: async ({ invitation, user }) => {
            if (
              !user.emailVerified ||
              user.email.toLowerCase() !== invitation.email.toLowerCase() ||
              !['analyst', 'viewer'].includes(invitation.role ?? '')
            )
              throw forbidden();
          },
          beforeUpdateMemberRole: async ({ member, newRole }) => {
            if (
              !isOrganizationRole(newRole) ||
              newRole === 'owner' ||
              member.role === 'owner'
            )
              throw forbidden();
          },
          beforeRemoveMember: async ({ member }) => {
            if (member.role === 'owner') throw forbidden();
          },
        },
      }),
    ],
  });
  if (requireMfa) requiredMfaInstances.add(auth);
  return auth;
}
export type Auth = ReturnType<typeof createAuth>;
export { ac, roles, capabilities, isOrganizationRole } from './permissions.js';

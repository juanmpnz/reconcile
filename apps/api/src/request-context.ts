import { randomUUID } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { authRequiresMfa, type Auth } from '@reconcile/auth';
import type { PrismaClient } from '@reconcile/database';
import { authorizeDocuments, DocumentError } from '@reconcile/application';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type MutationBucket = 'document' | 'analysis' | 'claim';

export function trustedOrigins(auth: Auth): ReadonlySet<string> {
  return new Set([
    new URL(auth.options.baseURL ?? 'http://invalid.local').origin,
    ...(Array.isArray(auth.options.trustedOrigins)
      ? auth.options.trustedOrigins.filter(
          (origin): origin is string => typeof origin === 'string',
        )
      : []),
  ]);
}

export function assertWriteOrigin(
  headers: FastifyRequest['headers'],
  allowed: ReadonlySet<string>,
): void {
  if (
    typeof headers.origin !== 'string' ||
    !allowed.has(headers.origin) ||
    headers['sec-fetch-site'] === 'cross-site'
  )
    throw new DocumentError(403, 'UNTRUSTED_ORIGIN');
}

export function privateResponse(reply: FastifyReply): void {
  reply.header('cache-control', 'private, no-store');
  reply.header('pragma', 'no-cache');
  reply.header('x-content-type-options', 'nosniff');
}

export async function requireVerifiedSession(
  auth: Auth,
  headers: FastifyRequest['headers'],
  requireAssurance = true,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(headers),
    query: { disableCookieCache: true },
  });
  if (!session?.user.emailVerified)
    throw new DocumentError(401, 'UNAUTHORIZED');
  if (
    requireAssurance &&
    (authRequiresMfa(auth) || session.user.twoFactorEnabled) &&
    (!session.user.twoFactorEnabled || !session.session.mfaVerifiedAt)
  )
    throw new DocumentError(403, 'MFA_REQUIRED');
  return session;
}

/** A request-local guard, never a session or membership cache across requests.
 * Use cases retain their own resource/tenant checks and asynchronous authorization.
 * Upload onRequest and handler share the same guard without double charging.
 */
export function createBusinessRequestContext({
  auth,
  prisma,
  mutationBucket,
}: {
  auth: Auth;
  prisma: PrismaClient;
  mutationBucket: MutationBucket;
}) {
  const origins = trustedOrigins(auth);
  const actors = new WeakMap<object, { userId: string; write: boolean }>();
  return async function context(
    request: FastifyRequest<{ Params: { organizationId: string } }>,
    reply: FastifyReply,
    write = false,
  ): Promise<string> {
    privateResponse(reply);
    if (
      Object.values(request.params).some(
        (value) => typeof value !== 'string' || !uuid.test(value),
      )
    )
      throw new DocumentError(404, 'NOT_FOUND');
    if (write) assertWriteOrigin(request.headers, origins);
    const cached = actors.get(request);
    if (cached && (!write || cached.write)) return cached.userId;
    const session = await requireVerifiedSession(auth, request.headers);
    await authorizeDocuments(
      prisma,
      request.params.organizationId,
      session.user.id,
      write,
    );
    if (write) {
      const now = BigInt(Date.now());
      const cutoff = now - 60000n;
      const key = `${mutationBucket}-mutation:${session.user.id}`;
      // Atomic fixed window, shared across instances and all routes in this bucket.
      const counts = await prisma.$queryRaw<
        { count: number }[]
      >`INSERT INTO auth_rate_limits (id,key,count,"lastRequest") VALUES (${randomUUID()}::uuid,${key},1,${now}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN auth_rate_limits."lastRequest" < ${cutoff} THEN 1 ELSE auth_rate_limits.count+1 END,"lastRequest"=CASE WHEN auth_rate_limits."lastRequest" < ${cutoff} THEN ${now} ELSE auth_rate_limits."lastRequest" END RETURNING count`;
      if ((counts[0]?.count ?? 101) > 100) {
        reply.header('retry-after', '60');
        throw new DocumentError(429, 'RATE_LIMITED');
      }
    }
    actors.set(request, { userId: session.user.id, write });
    return session.user.id;
  };
}

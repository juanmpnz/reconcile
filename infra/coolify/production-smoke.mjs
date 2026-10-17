// Destructive synthetic acceptance only on an isolated CI Compose project.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { PrismaClient } from '../../packages/database/dist/index.js';
import { hashPassword } from '../../apps/api/node_modules/better-auth/dist/crypto/index.mjs';
const requireWorker = createRequire(
  new URL('../../apps/worker/package.json', import.meta.url),
);
const requireStorage = createRequire(
  new URL('../../packages/document-processing/package.json', import.meta.url),
);
const { Queue, QueueEvents } = requireWorker('bullmq');
const { Redis } = requireWorker('ioredis');
const {
  S3Client,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = requireStorage('@aws-sdk/client-s3');
assert.equal(
  process.env.PRODUCTION_SMOKE_ALLOW_SYNTHETIC,
  'true',
  'CI-only explicit synthetic permission required',
);
const id = process.env.PRODUCTION_SMOKE_ID;
assert.match(id ?? '', /^[0-9a-f-]{36}$/);
const phase = process.env.PRODUCTION_SMOKE_PHASE ?? 'seed';
assert.ok(['seed', 'verify'].includes(phase));
const env = process.env,
  origin = env.AUTH_BASE_URL,
  web = 'http://web:8080';
assert.ok(origin?.startsWith('https://'));
const prisma = new PrismaClient();
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const queue = new Queue('reconcile-platform', { connection });
const events = new QueueEvents('reconcile-platform', { connection });
const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});
const email = `smoke-${id}@ci.example.org`,
  password = 'Synthetic-Smoke-Only-83Dk9fV!';
const objectKey = `production-smoke/${id}.txt`,
  redisKey = `production-smoke:${id}`;
function totpCode(uri) {
  const secret = new URL(uri).searchParams.get('secret');
  assert.ok(secret, 'Synthetic authenticator secret required');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.replace(/=+$/, '').toUpperCase()]
    .map((character) => {
      const value = alphabet.indexOf(character);
      assert.ok(value >= 0);
      return value.toString(2).padStart(5, '0');
    })
    .join('');
  const key = Buffer.from(
    Array.from({ length: Math.floor(bits.length / 8) }, (_, index) =>
      Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2),
    ),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  return ((digest.readUInt32BE(digest.at(-1) & 15) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, '0');
}
function pdf() {
  const content =
    'BT /F1 12 Tf 40 700 Td (Provider: Synthetic CI) Tj 0 -20 Td (Operation reference: CI-SMOKE) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let value = '%PDF-1.4\n' + '% synthetic CI padding\n'.repeat(55000);
  const offsets = [0];
  for (let n = 0; n < objects.length; n++) {
    offsets.push(Buffer.byteLength(value));
    value += `${n + 1} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(value);
  value += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((o) => String(o).padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(value);
}
try {
  const home = await fetch(web);
  assert.equal(home.status, 200);
  const policy = home.headers.get('content-security-policy');
  for (const directive of [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ])
    assert.ok(
      policy?.includes(directive),
      'Missing production CSP directive: ' + directive,
    );
  assert.equal(home.headers.get('x-frame-options'), 'DENY');
  assert.equal(
    home.headers.get('permissions-policy'),
    'camera=(), microphone=(), geolocation=()',
  );
  assert.match(await home.text(), /<div id="root"><\/div>/);
  const live = await fetch('http://127.0.0.1:3000/api/v1/health/ready');
  assert.equal(live.status, 200, await live.text());
  const hidden = await fetch(web + '/api/v1/health/ready');
  assert.equal(hidden.status, 404, 'Operational health must remain private');
  const anonymous = await fetch(web + '/api/auth/get-session');
  assert.equal(anonymous.status, 200);
  assert.equal(await anonymous.text(), 'null');
  const denied = await fetch(web + '/api/auth/sign-in/email', {
    method: 'POST',
    headers: {
      origin: 'https://hostile.invalid',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(denied.status, 403);
  const migrations =
    await prisma.$queryRaw`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  assert.ok(migrations.length >= 6, 'All committed migrations must finish');
  assert.ok(
    migrations.some((m) => m.migration_name === '20261016120000_claims'),
  );
  await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  const anonymousBucket = await fetch(env.S3_ENDPOINT + '/' + env.S3_BUCKET, {
    method: 'HEAD',
  });
  assert.ok([401, 403].includes(anonymousBucket.status));
  if (phase === 'seed') {
    const user = await prisma.user.create({
      data: { name: 'Synthetic CI only', email, emailVerified: true },
    });
    await prisma.account.create({
      data: {
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: await hashPassword(password),
      },
    });
    await prisma.organization.create({
      data: {
        id,
        slug: 'production-smoke-' + id,
        name: 'Synthetic CI persistence',
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
    await connection.set(redisKey, id);
    await s3.send(
      new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey, Body: id }),
    );
  } else {
    assert.equal(await prisma.organization.count({ where: { id } }), 1);
    assert.equal(await connection.get(redisKey), id);
    const stored = await s3.send(
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }),
    );
    assert.equal(await stored.Body.transformToString(), id);
  }
  const login = await fetch(web + '/api/auth/sign-in/email', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginBody = await login.json();
  assert.equal(login.status, 200, 'Synthetic login failed');
  const cookies = login.headers.getSetCookie();
  assert.ok(
    cookies.some(
      (c) =>
        /;\s*Secure/i.test(c) &&
        /;\s*HttpOnly/i.test(c) &&
        /SameSite=Lax/i.test(c),
    ),
    'Production auth cookie must be Secure, HttpOnly and SameSite',
  );
  const cookieJar = new Map();
  function absorb(responseCookies) {
    for (const value of responseCookies) {
      const pair = value.split(';')[0];
      const separator = pair.indexOf('=');
      const key = pair.slice(0, separator),
        valuePart = pair.slice(separator + 1);
      if (!valuePart || /max-age=0/i.test(value)) cookieJar.delete(key);
      else cookieJar.set(key, valuePart);
    }
  }
  absorb(cookies);
  let cookie = [...cookieJar]
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
  async function authPost(path, payload) {
    const response = await fetch(web + '/api/auth/' + path, {
      method: 'POST',
      headers: { origin, cookie, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    absorb(response.headers.getSetCookie());
    cookie = [...cookieJar].map(([key, value]) => `${key}=${value}`).join('; ');
    assert.equal(
      response.status,
      200,
      'Synthetic MFA operation failed: ' + path,
    );
    return response.json();
  }
  const mfaKey = redisKey + ':mfa';
  let totpURI;
  if (phase === 'seed') {
    const unenrolled = await fetch(
      web + `/api/v1/organizations/${id}/dashboard`,
      { headers: { cookie } },
    );
    assert.equal(unenrolled.status, 403, 'Production must require MFA');
    assert.equal((await unenrolled.json()).code, 'MFA_REQUIRED');
    const enrollment = await authPost('two-factor/enable', {
      password,
      method: 'totp',
    });
    assert.ok(enrollment.totpURI?.startsWith('otpauth://'));
    assert.equal(enrollment.backupCodes.length, 10);
    totpURI = enrollment.totpURI;
    await connection.set(mfaKey, totpURI);
  } else {
    assert.equal(
      loginBody.twoFactorRedirect,
      true,
      'Restart sign-in requires an actual MFA challenge',
    );
    totpURI = await connection.get(mfaKey);
    assert.ok(totpURI);
  }
  await authPost('two-factor/verify-totp', {
    code: totpCode(totpURI),
    trustDevice: false,
  });
  const assurance = await fetch(web + '/api/v1/session-assurance', {
    headers: { cookie },
  });
  assert.deepEqual(await assurance.json(), {
    required: true,
    enrolled: true,
    verified: true,
  });
  const session = await fetch(web + '/api/auth/get-session', {
    headers: { cookie },
  });
  assert.equal(session.status, 200);
  const sessionBody = await session.json();
  assert.equal(sessionBody.user.email, email);
  const base = web + `/api/v1/organizations/${id}/documents`;
  if (phase === 'seed') {
    const bytes = pdf();
    assert.ok(bytes.length > 1024 * 1024 && bytes.length < 10 * 1024 * 1024);
    const uploaded = await fetch(base, {
      method: 'POST',
      headers: {
        origin,
        cookie,
        'content-type': 'application/pdf',
        'x-document-filename': 'production-smoke.pdf',
        'x-document-kind': 'invoice',
      },
      body: bytes,
    });
    assert.equal(uploaded.status, 201, await uploaded.text());
  }
  const docs = await prisma.document.findMany({
    where: { organizationId: id },
  });
  assert.equal(docs.length, 1);
  const document = docs[0];
  for (let attempt = 0; attempt < 45; attempt++) {
    const current = await prisma.document.findUniqueOrThrow({
      where: { id: document.id },
    });
    if (current.status === 'needs_review') break;
    assert.ok(
      !['failed', 'blocked'].includes(current.status),
      'Real PDF processing failed',
    );
    await delay(1000);
  }
  assert.equal(
    (await prisma.document.findUniqueOrThrow({ where: { id: document.id } }))
      .status,
    'needs_review',
  );
  const original = await fetch(base + `/${document.id}/download`, {
    headers: { cookie },
  });
  assert.equal(original.status, 200);
  assert.equal(
    original.headers.get('content-security-policy'),
    "sandbox; default-src 'none'",
    'Original download must preserve its stricter API sandbox',
  );
  assert.equal(original.headers.get('cache-control'), 'private, no-store');
  const originalBytes = Buffer.from(await original.arrayBuffer());
  assert.equal(
    createHash('sha256').update(originalBytes).digest('hex'),
    document.sha256,
  );
  assert.ok(originalBytes.length > 1024 * 1024);
  await events.waitUntilReady();
  const job = await queue.add(
    'ping',
    { type: 'platform.ping', correlationId: randomUUID() },
    { removeOnComplete: true, removeOnFail: true },
  );
  assert.equal((await job.waitUntilFinished(events, 20000)).status, 'ok');
  const loggedOut = await fetch(web + '/api/auth/sign-out', {
    method: 'POST',
    headers: { origin, cookie, 'content-type': 'application/json' },
    body: '{}',
  });
  assert.equal(loggedOut.status, 200);
  if (phase === 'verify') {
    for (const doc of docs)
      await s3.send(
        new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: doc.storageKey }),
      );
    await s3.send(
      new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey }),
    );
    await connection.del(redisKey, redisKey + ':mfa');
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.identityAuditEvent.deleteMany({
      where: { OR: [{ organizationId: id }, { actorId: user.id }] },
    });
    await prisma.organization.delete({ where: { id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  console.info(
    `Production smoke ${phase} passed: built web/API/worker, migrations, secure cookies, private bucket, >1MiB PDF, durable PostgreSQL/Redis/storage. SMTP configuration only; no email delivered.`,
  );
} finally {
  await events.close();
  await queue.close();
  await connection.quit();
  s3.destroy();
  await prisma.$disconnect();
}

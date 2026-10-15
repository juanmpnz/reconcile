// Destructive synthetic acceptance only on an isolated CI Compose project.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash, randomUUID } from 'node:crypto';
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
  assert.equal(login.status, 200, await login.text());
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
  const cookie = cookies.map((c) => c.split(';')[0]).join('; ');
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
    await connection.del(redisKey);
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

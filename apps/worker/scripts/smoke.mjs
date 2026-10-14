import assert from 'node:assert/strict';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
const base = process.env.SMOKE_API_URL ?? 'http://localhost:3000';
const live = await fetch(`${base}/api/v1/health/live`);
assert.equal(live.status, 200);
const ready = await fetch(`${base}/api/v1/health/ready`);
assert.equal(ready.status, 200, await ready.text());
const connection = new Redis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
  { maxRetriesPerRequest: null },
);
const queue = new Queue('reconcile-platform', { connection });
const events = new QueueEvents('reconcile-platform', { connection });
try {
  await events.waitUntilReady();
  const job = await queue.add(
    'ping',
    { type: 'platform.ping', correlationId: crypto.randomUUID() },
    { removeOnComplete: 100, removeOnFail: 100 },
  );
  const result = await job.waitUntilFinished(events, 15000);
  assert.equal(result.status, 'ok');
  console.info(
    'Smoke passed: API, PostgreSQL, Redis, private bucket and worker.',
  );
} finally {
  await events.close();
  await queue.close();
  await connection.quit();
}

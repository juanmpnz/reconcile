import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { parseServiceConfig } from '@reconcile/config';
import { PLATFORM_QUEUE, platformJobSchema } from '@reconcile/contracts';
const config = parseServiceConfig(process.env);
const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
connection.on('error', () =>
  console.error('Worker Redis connection unavailable'),
);
const worker = new Worker(
  PLATFORM_QUEUE,
  async (job) => {
    const payload: unknown = job.data;
    const data = platformJobSchema.parse(payload);
    console.info(
      JSON.stringify({
        event: 'platform.ping.completed',
        correlationId: data.correlationId,
      }),
    );
    return { status: 'ok' };
  },
  { connection, concurrency: config.WORKER_CONCURRENCY },
);
worker.on('error', () => console.error('Worker connection error'));
worker.on('failed', (job) =>
  console.error(JSON.stringify({ event: 'job.failed', jobId: job?.id })),
);
worker.on('ready', () =>
  console.info(
    'Platform worker ready; business processing is not implemented yet.',
  ),
);
let closing = false;
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  await worker.close();
  await connection.quit();
}
process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});

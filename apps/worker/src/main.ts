import { Worker } from 'bullmq';
import { PrismaClient } from '@reconcile/database';
import { createPrivateDocumentStorage } from '@reconcile/document-processing';
import { startAnalysisProcessing } from './analyses.js';
import { startDocumentProcessing } from './documents.js';
import { Redis } from 'ioredis';
import { parseServiceConfig } from '@reconcile/config';
import { PLATFORM_QUEUE, platformJobSchema } from '@reconcile/contracts';
const config = parseServiceConfig(process.env);
const prisma = new PrismaClient();
const documentStorage = createPrivateDocumentStorage(config);
const documentRuntime = startDocumentProcessing({
  prisma,
  storage: documentStorage,
  redisUrl: config.REDIS_URL,
});
const analysisRuntime = startAnalysisProcessing({
  prisma,
  redisUrl: config.REDIS_URL,
});
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
  console.info('Platform and private document workers ready.'),
);
let closing = false;
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  await documentRuntime.close();
  await analysisRuntime.close();
  documentStorage.close();
  await prisma.$disconnect();
  await worker.close();
  await connection.quit();
}
process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});

import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { PrismaClient } from '@reconcile/database';
import { ANALYSIS_QUEUE } from '@reconcile/contracts';
import { processAnalysisRun } from '@reconcile/application';

export function startAnalysisProcessing({
  prisma,
  redisUrl,
  autoDispatch = true,
}: {
  prisma: PrismaClient;
  redisUrl: string;
  autoDispatch?: boolean;
}) {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  connection.on('error', () => undefined);
  const publisherConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1500,
    commandTimeout: 3000,
  });
  publisherConnection.on('error', () => undefined);
  const queue = new Queue(ANALYSIS_QUEUE, { connection: publisherConnection });
  const worker = new Worker(
    ANALYSIS_QUEUE,
    async (job: Job) =>
      processAnalysisRun({ prisma, payload: job.data as unknown }),
    { connection, concurrency: 1 },
  );
  worker.on('error', () =>
    console.error('Analysis worker connection unavailable'),
  );
  worker.on('failed', (job) =>
    console.error(
      JSON.stringify({ event: 'analysis.job.failed', jobId: job?.id }),
    ),
  );
  let dispatching = false;
  let closed = false;
  async function dispatch() {
    if (dispatching || closed) return;
    dispatching = true;
    try {
      const pending = await prisma.analysisOutbox.findMany({
        where: {
          completedAt: null,
          OR: [
            { lastEnqueuedAt: null },
            { lastEnqueuedAt: { lt: new Date(Date.now() - 60000) } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 50,
        include: { run: true },
      });
      for (const item of pending) {
        if (['completed', 'failed', 'blocked'].includes(item.run.status)) {
          await prisma.analysisOutbox.update({
            where: { id: item.id },
            data: { completedAt: item.run.completedAt ?? new Date() },
          });
          continue;
        }
        if (
          item.run.status === 'processing' &&
          item.run.leaseUntil &&
          item.run.leaseUntil > new Date()
        )
          continue;
        const existing = await queue.getJob(item.id);
        if (existing) {
          const state = await existing.getState();
          if (state === 'completed' || state === 'failed')
            await existing.remove();
          else {
            await prisma.analysisOutbox.update({
              where: { id: item.id },
              data: { lastEnqueuedAt: new Date() },
            });
            continue;
          }
        }
        await queue.add(
          'operation.analyze',
          {
            outboxId: item.id,
            organizationId: item.organizationId,
            operationId: item.operationId,
            runId: item.runId,
            actorId: item.actorId,
          },
          {
            jobId: item.id,
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: 100,
          },
        );
        await prisma.analysisOutbox.update({
          where: { id: item.id },
          data: { lastEnqueuedAt: new Date() },
        });
      }
    } finally {
      dispatching = false;
    }
  }
  const timer = autoDispatch
    ? setInterval(() => {
        void dispatch().catch(() =>
          console.error('Analysis outbox dispatch unavailable'),
        );
      }, 2000)
    : undefined;
  timer?.unref();
  return {
    queue,
    worker,
    dispatch,
    async process(payload: unknown) {
      return processAnalysisRun({ prisma, payload });
    },
    async close() {
      closed = true;
      if (timer) clearInterval(timer);
      await worker.close();
      await queue.close();
      publisherConnection.disconnect();
      await connection.quit();
    },
  };
}

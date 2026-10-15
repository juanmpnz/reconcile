import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import type { PrismaClient } from '@reconcile/database';
import { DOCUMENT_QUEUE } from '@reconcile/contracts';
import { processDocumentRun } from '@reconcile/application';
import type { PrivateDocumentStorage } from '@reconcile/document-processing';
export function startDocumentProcessing({
  prisma,
  storage,
  redisUrl,
  autoDispatch = true,
}: {
  prisma: PrismaClient;
  storage: PrivateDocumentStorage;
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
  const queue = new Queue(DOCUMENT_QUEUE, { connection: publisherConnection });
  const worker = new Worker(
    DOCUMENT_QUEUE,
    async (job: Job) =>
      processDocumentRun({ prisma, storage, payload: job.data as unknown }),
    { connection, concurrency: 1 },
  );
  worker.on('error', () =>
    console.error('Document worker connection unavailable'),
  );
  worker.on('failed', (job) =>
    console.error(
      JSON.stringify({ event: 'document.job.failed', jobId: job?.id }),
    ),
  );
  let dispatching = false;
  let closed = false;
  async function dispatch() {
    if (dispatching || closed) return;
    dispatching = true;
    try {
      const pending = await prisma.documentOutbox.findMany({
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
        if (
          ['needs_review', 'ready', 'failed', 'blocked'].includes(
            item.run.status,
          )
        ) {
          await prisma.documentOutbox.update({
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
            await prisma.documentOutbox.update({
              where: { id: item.id },
              data: { lastEnqueuedAt: new Date() },
            });
            continue;
          }
        }
        await queue.add(
          'document.extract',
          {
            outboxId: item.id,
            organizationId: item.organizationId,
            documentId: item.documentId,
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
        await prisma.documentOutbox.update({
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
          console.error('Document outbox dispatch unavailable'),
        );
      }, 2000)
    : undefined;
  timer?.unref();
  return {
    queue,
    worker,
    dispatch,
    async process(payload: unknown) {
      return processDocumentRun({ prisma, storage, payload });
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

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@reconcile/database';
import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Redis } from 'ioredis';
import { parseServiceConfig } from '@reconcile/config';
import type { Readiness } from '@reconcile/contracts';
@Injectable()
export class HealthService {
  private readonly config = parseServiceConfig(process.env);
  private readonly database = new PrismaClient({
    datasources: { db: { url: this.config.DATABASE_URL } },
  });
  private readonly redis = new Redis(this.config.REDIS_URL, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 1500,
    commandTimeout: 1500,
    retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
  });
  private readonly storage = new S3Client({
    endpoint: this.config.S3_ENDPOINT,
    region: this.config.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: this.config.S3_ACCESS_KEY_ID,
      secretAccessKey: this.config.S3_SECRET_ACCESS_KEY,
    },
    maxAttempts: 1,
  });
  constructor() {
    this.redis.on('error', () => undefined);
  }
  async ready(): Promise<Readiness> {
    const results = await Promise.allSettled([
      this.database.$queryRaw`SELECT 1`,
      this.redis.ping(),
      this.storage.send(
        new HeadBucketCommand({ Bucket: this.config.S3_BUCKET }),
        { abortSignal: AbortSignal.timeout(2000) },
      ),
    ]);
    const checks = Object.fromEntries(
      ['database', 'redis', 'storage'].map((name, index) => [
        name,
        results[index]?.status === 'fulfilled' ? 'up' : 'down',
      ]),
    ) as Readiness['checks'];
    return {
      status: results.every((item) => item.status === 'fulfilled')
        ? 'ready'
        : 'not_ready',
      checks,
    };
  }
  async onApplicationShutdown(): Promise<void> {
    this.redis.disconnect();
    this.storage.destroy();
    await this.database.$disconnect();
  }
}

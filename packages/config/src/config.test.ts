import { describe, expect, it } from 'vitest';
import { parseServiceConfig } from './index.js';
const valid = {
  DATABASE_URL: 'postgresql://demo:demo@localhost/demo',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'reconcile-demo',
  S3_ACCESS_KEY_ID: 'demo',
  S3_SECRET_ACCESS_KEY: 'local-development-only',
};
describe('service environment', () => {
  it('rejects invalid worker concurrency and does not disclose credentials', () => {
    expect(() =>
      parseServiceConfig({
        ...valid,
        WORKER_CONCURRENCY: '0',
        DATABASE_URL: 'sensitive-invalid-value',
      }),
    ).toThrow('DATABASE_URL, WORKER_CONCURRENCY');
    try {
      parseServiceConfig({ ...valid, DATABASE_URL: 'secret-value' });
    } catch (error) {
      expect(String(error)).not.toContain('secret-value');
    }
  });
  it('parses bounded concurrency and port', () => {
    expect(parseServiceConfig(valid).WORKER_CONCURRENCY).toBe(2);
  });
});

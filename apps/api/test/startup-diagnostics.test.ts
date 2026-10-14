import { describe, expect, it, vi } from 'vitest';
import {
  formatStartupFailure,
  closeAfterStartupFailure,
} from '../src/startup-diagnostics.js';

describe('safe startup diagnostics', () => {
  it('identifies occupied listener without reflecting the thrown message', () => {
    const error = Object.assign(new Error('postgresql://private:password@db'), {
      code: 'EADDRINUSE',
    });
    expect(
      formatStartupFailure(error, 'listen', { host: '127.0.0.1', port: 3001 }),
    ).toBe(
      'API startup failed [stage=listen] EADDRINUSE: Address/port already in use (127.0.0.1:3001)',
    );
  });
  it('reports only allowlisted configuration field names, never supplied values', () => {
    const error = new Error(
      'Invalid authentication environment: AUTH_SECRET, smtp-password-SECRET, SMTP_HOST',
    );
    const result = formatStartupFailure(error, 'auth-config');
    expect(result).toContain('invalid fields: AUTH_SECRET, SMTP_HOST');
    expect(result).not.toContain('smtp-password-SECRET');
  });
  it.each([
    new Error('postgresql://private:password@db'),
    { code: 'PRIVATE_TOKEN', message: 'private-password' },
    'raw-private-password',
    null,
  ])('does not reflect unknown errors or codes', (error) => {
    expect(formatStartupFailure(error, 'http-init')).toBe(
      'API startup failed [stage=http-init] unexpected initialization error; error details withheld',
    );
  });
  it('does not reflect arbitrary config errors', () => {
    expect(
      formatStartupFailure(new Error('private-password'), 'service-config'),
    ).toBe(
      'API startup failed [stage=service-config] invalid configuration; check .env',
    );
  });
});

describe('startup failure resilience', () => {
  it('does not expose errors thrown by diagnostic getters', () => {
    const error = Object.defineProperty({}, 'code', {
      get() {
        throw new Error('PRIVATE-GETTER-SECRET');
      },
    });
    expect(formatStartupFailure(error, 'listen')).toBe(
      'API startup failed [stage=listen] error inspection failed; error details withheld',
    );
    const message = Object.defineProperty(new Error(), 'message', {
      get() {
        throw new Error('PRIVATE-MESSAGE-SECRET');
      },
    });
    expect(formatStartupFailure(message, 'auth-config')).toBe(
      'API startup failed [stage=auth-config] error inspection failed; error details withheld',
    );
  });
  it('finishes cleanup after its deadline when a resource never closes', async () => {
    vi.useFakeTimers();
    try {
      const cleanup = closeAfterStartupFailure(
        () => new Promise<void>(() => undefined),
        30,
      );
      await vi.advanceTimersByTimeAsync(30);
      await expect(cleanup).resolves.toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
  it('does not rethrow a cleanup failure or leave a timer', async () => {
    vi.useFakeTimers();
    try {
      await expect(
        closeAfterStartupFailure(async () => {
          throw new Error('PRIVATE-CLEANUP-SECRET');
        }),
      ).resolves.toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  httpFetch,
  type HttpError,
  parseHttpResponse,
  readHttpJson,
  SESSION_EXPIRED_EVENT,
} from './http';
import {
  updateOperation,
  OperationConflictError,
} from '../features/operations/api';

afterEach(() => vi.unstubAllGlobals());
describe('authenticated HTTP boundary', () => {
  it('keeps cookies same-origin, disables cached responses and rejects redirect following even if caller overrides', async () => {
    const response = Response.json({ ok: true });
    const fetcher = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    await expect(
      httpFetch('/api/v1/example', {
        credentials: 'omit',
        cache: 'force-cache',
        redirect: 'follow',
        signal: controller.signal,
      }),
    ).resolves.toBe(response);
    expect(fetcher).toHaveBeenCalledWith(
      '/api/v1/example',
      expect.objectContaining({
        credentials: 'include',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      }),
    );
    for (const path of [
      'https://outside.example/api/test',
      '//outside.example/api/test',
      '/api/\\outside.example',
    ]) {
      await expect(httpFetch(path)).rejects.toThrow('no corresponde');
    }
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('signals expired authentication without consuming or reflecting the error body; denial does not impersonate logout', async () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const expired = vi.fn();
    target.addEventListener(SESSION_EXPIRED_EVENT, expired);
    const response = Response.json({ secret: 'private' }, { status: 401 });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response)
        .mockResolvedValueOnce(new Response(null, { status: 403 })),
    );
    await httpFetch('/api/v1/private');
    expect(expired).toHaveBeenCalledTimes(1);
    expect(response.bodyUsed).toBe(false);
    await httpFetch('/api/v1/private');
    expect(expired).toHaveBeenCalledTimes(1);
  });
  it('preserves cancellation and protects malformed response content', async () => {
    const abort = new DOMException('Canceled', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(
      httpFetch('/api/v1/private', { signal: new AbortController().signal }),
    ).rejects.toBe(abort);
    await expect(
      readHttpJson(
        new Response('private-document-data'),
        'Respuesta no válida.',
      ),
    ).rejects.toThrow('Respuesta no válida.');
    expect(() =>
      parseHttpResponse(
        z.object({ id: z.string() }),
        { secret: 'private' },
        'Respuesta no válida.',
      ),
    ).toThrow('Respuesta no válida.');
  });
  it('retains financial optimistic-conflict identity and never retries a write', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ code: 'STALE_OPERATION' }, { status: 409 }),
      );
    vi.stubGlobal('fetch', fetcher);
    const promise = updateOperation('org', 'operation', {
      name: 'Demo',
      reference: 'REF',
      expectedFingerprint: '0'.repeat(64),
    });
    await expect(promise).rejects.toBeInstanceOf(OperationConflictError);
    await expect(promise).rejects.toMatchObject({
      status: 409,
      code: 'STALE_OPERATION',
    } satisfies Partial<HttpError>);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

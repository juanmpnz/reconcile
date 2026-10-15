import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOperation,
  getOperation,
  listOperations,
  updateOperation,
} from './api';
const organizationId = '00000000-0000-4000-8000-000000000001';
const operationId = '00000000-0000-4000-8000-000000000002';
const foreignId = '00000000-0000-4000-8000-000000000003';
const summary = {
  id: operationId,
  organizationId,
  reference: 'DEMO-01',
  name: 'Demo',
  revision: 1,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
};
const detail = {
  ...summary,
  documentIds: [],
  facts: [],
  fingerprint: '0'.repeat(64),
  warnings: [],
  analyses: [],
  factRevisions: [],
  capabilities: { canWrite: true },
};
afterEach(() => vi.unstubAllGlobals());
describe('operation response boundaries', () => {
  it('rejects a validly shaped cross-tenant list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          items: [{ ...summary, organizationId: foreignId }],
          total: 1,
          offset: 0,
          limit: 25,
        }),
      ),
    );
    await expect(
      listOperations(organizationId, 0, new AbortController().signal),
    ).rejects.toThrow('no corresponde');
  });
  it('rejects a detail for a different operation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ ...detail, id: foreignId })),
    );
    await expect(
      getOperation(organizationId, operationId, new AbortController().signal),
    ).rejects.toThrow('no corresponde');
  });
  it('does not select a cross-tenant create destination', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ ...detail, organizationId: foreignId }),
        ),
    );
    await expect(
      createOperation(organizationId, { reference: 'DEMO', name: 'Demo' }),
    ).rejects.toThrow('no corresponde');
  });
  it('reports malformed external payloads without reflecting server content', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ privateDocument: 'sensitive-body' }),
        ),
    );
    await expect(
      getOperation(organizationId, operationId, new AbortController().signal),
    ).rejects.toThrow('La respuesta del servicio no es válida');
  });
});
describe('operation edits and optimistic associations', () => {
  it('sends the revision fingerprint with PATCH and rejects foreign destination', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ ...detail, organizationId: foreignId }),
      );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      updateOperation(organizationId, operationId, {
        name: 'New name',
        reference: 'NEW-01',
        expectedFingerprint: '0'.repeat(64),
      }),
    ).rejects.toThrow('no corresponde');
    const init = fetcher.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe(
      JSON.stringify({
        reference: 'NEW-01',
        name: 'New name',
        expectedFingerprint: '0'.repeat(64),
      }),
    );
  });
  it('preserves a bounded conflict code without reflecting server error content', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: 'STALE_OPERATION' }, { status: 409 }),
        ),
    );
    await expect(
      updateOperation(organizationId, operationId, {
        name: 'New',
        reference: 'NEW',
        expectedFingerprint: '0'.repeat(64),
      }),
    ).rejects.toMatchObject({ code: 'STALE_OPERATION' });
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: 'private-server-data' }, { status: 409 }),
        ),
    );
    await expect(
      updateOperation(organizationId, operationId, {
        name: 'New',
        reference: 'NEW',
        expectedFingerprint: '0'.repeat(64),
      }),
    ).rejects.not.toThrow('private-server-data');
  });
});

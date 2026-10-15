import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOperation, getOperation, listOperations } from './api';
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

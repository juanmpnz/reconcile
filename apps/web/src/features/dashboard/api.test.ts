import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDashboard } from './api';
const organizationId = '00000000-0000-4000-8000-000000000001';
const fixture = {
  organizationId,
  generatedAt: '2026-10-16T00:00:00.000Z',
  scope: 'all_organization_records',
  operations: {
    total: 0,
    withoutCompletedAnalysis: 0,
    byLatestAnalysis: {
      not_analyzed: 0,
      queued: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
    },
  },
  documents: {
    total: 0,
    byStatus: {
      queued: 0,
      processing: 0,
      needs_review: 0,
      ready: 0,
      failed: 0,
      blocked: 0,
    },
  },
  claims: {
    total: 0,
    open: 0,
    byStatus: {
      draft: 0,
      exported: 0,
      sent: 0,
      in_review: 0,
      follow_up: 0,
      resolved: 0,
      rejected: 0,
    },
  },
  findings: {
    scope: 'latest_completed_per_operation',
    includesHistorical: true,
    humanConfirmations: 0,
    confirmed: 0,
    probable: 0,
    notVerifiable: 0,
    matched: 0,
  },
  pending: { documents: [], operations: [], claims: [] },
};
afterEach(() => vi.unstubAllGlobals());
describe('organization dashboard response boundary', () => {
  it('accepts real zero counts without inventing records', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(fixture)));
    expect(
      (await getDashboard(organizationId, new AbortController().signal))
        .documents.total,
    ).toBe(0);
  });
  it('rejects a valid aggregate from another organization', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          ...fixture,
          organizationId: '00000000-0000-4000-8000-000000000002',
        }),
      ),
    );
    await expect(
      getDashboard(organizationId, new AbortController().signal),
    ).rejects.toThrow('no corresponde');
  });
  it('keeps service failures distinct from zero and does not reflect malformed payload contents', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ secretDocument: 'not-to-display' })),
    );
    await expect(
      getDashboard(organizationId, new AbortController().signal),
    ).rejects.toThrow('La respuesta del resumen no es válida');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({}, { status: 503 })),
    );
    await expect(
      getDashboard(organizationId, new AbortController().signal),
    ).rejects.toThrow('No pudimos cargar');
  });
});

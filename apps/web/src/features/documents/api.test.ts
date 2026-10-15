import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDocument, listDocuments, uploadDocument } from './api';
const organizationId = '00000000-0000-4000-8000-000000000001';
const otherOrganizationId = '00000000-0000-4000-8000-000000000002';
const documentId = '00000000-0000-4000-8000-000000000003';
const summary = {
  id: documentId,
  organizationId: otherOrganizationId,
  filename: 'demo.pdf',
  kind: 'invoice',
  sizeBytes: 12,
  status: 'queued',
  errorCode: null,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
};
const detail = {
  ...summary,
  sha256: '0'.repeat(64),
  latestRun: null,
  corrections: [],
  capabilities: { canWrite: true },
};
afterEach(() => vi.unstubAllGlobals());
describe('private document client boundaries', () => {
  it('rejects a validly shaped document from another tenant', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(detail)));
    await expect(
      getDocument(organizationId, documentId, new AbortController().signal),
    ).rejects.toThrow('no corresponde');
  });
  it('rejects mixed-tenant document list rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ items: [summary], total: 1, offset: 0, limit: 25 }),
        ),
    );
    await expect(
      listDocuments(organizationId, 0, new AbortController().signal),
    ).rejects.toThrow('no corresponde');
  });
  it('rejects a cross-tenant upload response before a destination is selected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(detail)));
    await expect(
      uploadDocument(
        organizationId,
        new File(['%PDF-demo'], 'demo.pdf', { type: 'application/pdf' }),
        'invoice',
      ),
    ).rejects.toThrow('no corresponde');
  });
});

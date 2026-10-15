import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDocument,
  listDocuments,
  uploadDocument,
  updateDocumentMetadata,
} from './api';
const organizationId = '00000000-0000-4000-8000-000000000001';
const otherOrganizationId = '00000000-0000-4000-8000-000000000002';
const documentId = '00000000-0000-4000-8000-000000000003';
const summary = {
  id: documentId,
  organizationId: otherOrganizationId,
  filename: 'demo.pdf',
  metadataVersion: 0,
  extractedReference: null,
  operations: [],
  operationCount: 0,
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
  metadataHistory: [],
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

describe('global document controls', () => {
  it('sends search, ordering and pagination to the server rather than filtering a page', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ items: [], total: 0, limit: 25, offset: 25 }),
      );
    vi.stubGlobal('fetch', fetcher);
    await listDocuments(organizationId, 1, new AbortController().signal, {
      q: 'OP / 99',
      sort: 'operation',
      direction: 'asc',
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('offset=25'),
      expect.objectContaining({ credentials: 'include' }),
    );
    const url = new URL(String(fetcher.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.searchParams.get('q')).toBe('OP / 99');
    expect(url.searchParams.get('sort')).toBe('operation');
    expect(url.searchParams.get('direction')).toBe('asc');
  });
  it('rejects a cross-tenant metadata update response before rendering its name or associations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(detail)));
    await expect(
      updateDocumentMetadata(organizationId, documentId, {
        filename: 'renamed.pdf',
        kind: 'invoice',
        expectedMetadataVersion: 0,
        reason: 'Corrected display name',
      }),
    ).rejects.toThrow('no corresponde');
  });
});

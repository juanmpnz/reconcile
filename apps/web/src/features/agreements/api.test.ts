import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AgreementConflictError,
  listAgreements,
  setOperationAgreements,
} from './api';
const organizationId = '00000000-0000-4000-8000-000000000001';
const operationId = '00000000-0000-4000-8000-000000000002';
afterEach(() => vi.unstubAllGlobals());
describe('agreement API boundaries', () => {
  it('rejects malformed agreement responses without reflecting content', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ secret: 'private source text' })),
    );
    await expect(
      listAgreements(organizationId, 0, new AbortController().signal),
    ).rejects.toThrow('La respuesta de acuerdos no es válida');
  });
  it('keeps optimistic conflicts distinguishable without leaking server data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ secret: 'private source text' }, { status: 409 }),
        ),
    );
    await expect(
      setOperationAgreements(organizationId, operationId, {
        expectedFingerprint: '0'.repeat(64),
        reason: 'Reviewed removal',
        bindings: [],
      }),
    ).rejects.toBeInstanceOf(AgreementConflictError);
  });
  it('rejects duplicated invoice selection before making a network request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const binding = {
      invoiceDocumentId: '00000000-0000-4000-8000-000000000003',
      agreementVersionId: '00000000-0000-4000-8000-000000000004',
      serviceDate: '2026-10-16',
      route: 'Barcelona',
      distanceKm: '30.5',
    };
    await expect(
      setOperationAgreements(organizationId, operationId, {
        expectedFingerprint: '0'.repeat(64),
        reason: 'Reviewed selection',
        bindings: [binding, binding],
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

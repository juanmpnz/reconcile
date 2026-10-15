import { afterEach, describe, expect, it, vi } from 'vitest';
import { getReview, getClaim, createClaim, exportClaim } from './api';
const org = '00000000-0000-4000-8000-000000000001',
  op = '00000000-0000-4000-8000-000000000002',
  id = '00000000-0000-4000-8000-000000000003',
  foreign = '00000000-0000-4000-8000-000000000004';
const finding = {
  documentId: id,
  lineId: 'pickup',
  service: 'pickup',
  status: 'confirmed',
  code: 'EXCLUDED_SERVICE_OTHER_PROVIDER',
  expected: '0',
  invoiced: '62',
  difference: '62',
  currency: 'USD',
  explanation: 'Evidence',
  evidence: [],
};
const decision = {
  id,
  runId: id,
  findingIndex: 0,
  action: 'confirm',
  reason: 'Reviewed',
  actorId: id,
  ordinal: 1,
  createdAt: '2026-10-15T00:00:00.000Z',
};
const claim = {
  id,
  organizationId: org,
  operationId: op,
  documentId: id,
  runId: id,
  findingIndex: 0,
  version: 1,
  kind: 'correction',
  provider: 'Demo',
  amount: '62',
  currency: 'USD',
  status: 'draft',
  stale: false,
  dueDate: null,
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
  finding,
  snapshot: { organizationId: org, operationReference: 'DEMO', documents: [] },
  sourceFingerprint: '0'.repeat(64),
  decision,
  drafts: [],
  events: [],
  sources: [],
  exports: [],
  capabilities: { canWrite: true },
};
afterEach(() => vi.unstubAllGlobals());
describe('review and claim client boundaries', () => {
  it('rejects cross-tenant review data before showing decisions or claims', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          organizationId: foreign,
          operationId: op,
          version: 0,
          fingerprint: '0'.repeat(64),
          decisions: [],
          claims: [],
          capabilities: { canWrite: true },
        }),
      ),
    );
    await expect(
      getReview(org, op, new AbortController().signal),
    ).rejects.toThrow('no corresponde');
  });
  it('rejects a claim with a foreign historical snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          ...claim,
          snapshot: { ...claim.snapshot, organizationId: foreign },
        }),
      ),
    );
    await expect(
      getClaim(org, op, id, new AbortController().signal),
    ).rejects.toThrow('no corresponde');
  });
  it('does not open a claim returned for another operation after creation', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ ...claim, operationId: foreign })),
    );
    await expect(
      createClaim(org, op, {
        runId: id,
        findingIndex: 0,
        expectedVersion: 0,
        expectedFingerprint: '0'.repeat(64),
      }),
    ).rejects.toThrow('no corresponde');
  });
  it('blocks forbidden exports with a safe message and never returns a file', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ code: 'private-server-detail' }, { status: 403 }),
        ),
    );
    await expect(exportClaim(org, op, id, 1, 'dossier')).rejects.toThrow(
      'No tenés acceso',
    );
  });
});

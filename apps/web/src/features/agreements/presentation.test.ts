import { describe, expect, it } from 'vitest';
import { agreementVersionSchema } from '@reconcile/contracts';
import { applicabilityNotes, pricingLabel } from './presentation';
const agreement = agreementVersionSchema.parse({
  id: '00000000-0000-4000-8000-000000000001',
  organizationId: '00000000-0000-4000-8000-000000000002',
  name: 'Annual synthetic tariff',
  scope: 'reusable',
  operationId: null,
  sourceDocumentId: '00000000-0000-4000-8000-000000000003',
  sourceExtractionRunId: '00000000-0000-4000-8000-000000000004',
  sourceSha256: '0'.repeat(64),
  sourceMetadataVersion: 0,
  sourceCorrectionRevision: 0,
  terms: {
    agreementBasis: 'accepted',
    provider: 'Traginers',
    currency: 'EUR',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    route: 'Barcelona',
    service: 'pickup',
    pricing: {
      type: 'distance-bands',
      bands: [
        {
          fromKm: '0',
          toKm: '30',
          basis: 'fixed-trip',
          amount: '62.15',
          evidence: [
            {
              documentId: '00000000-0000-4000-8000-000000000003',
              extractionRunId: '00000000-0000-4000-8000-000000000004',
              page: 1,
              snippet: 'Synthetic tariff',
            },
          ],
        },
        {
          fromKm: '30',
          toKm: '50',
          basis: 'per-km',
          amount: '2.03',
          evidence: [
            {
              documentId: '00000000-0000-4000-8000-000000000003',
              extractionRunId: '00000000-0000-4000-8000-000000000004',
              page: 1,
              snippet: 'Synthetic tariff',
            },
          ],
        },
      ],
    },
    evidence: [
      {
        documentId: '00000000-0000-4000-8000-000000000003',
        extractionRunId: '00000000-0000-4000-8000-000000000004',
        page: 1,
        snippet: 'Synthetic tariff',
      },
    ],
  },
  actorId: '00000000-0000-4000-8000-000000000005',
  reason: 'Synthetic reviewed fixture',
  createdAt: '2026-10-16T00:00:00.000Z',
});
describe('operator agreement feedback', () => {
  it('shows exact decimal rates and distinguishes trip from kilometer bands', () => {
    expect(pricingLabel(agreement.terms.pricing)).toBe(
      '[0, 30) km: 62.15 por viaje · [30, 50) km: 2.03 por km',
    );
  });
  it('accepts adjacent lower-inclusive band boundaries and inclusive end date', () => {
    expect(
      applicabilityNotes(
        agreement,
        'Traginers',
        'EUR',
        '2026-12-31',
        'Barcelona',
        '30',
      ),
    ).toEqual([]);
  });
  it('flags the excluded final boundary and missing distance', () => {
    expect(
      applicabilityNotes(
        agreement,
        'Traginers',
        'EUR',
        '2026-10-16',
        'Barcelona',
        '50',
      ),
    ).toContain('La distancia no tiene un tramo tarifario.');
    expect(
      applicabilityNotes(
        agreement,
        'Traginers',
        'EUR',
        '2026-10-16',
        'Barcelona',
        '',
      ),
    ).toContain('Falta una distancia positiva revisada.');
  });
  it('compares high precision distance boundaries exactly', () => {
    const precise = structuredClone(agreement);
    const evidence = precise.terms.evidence;
    precise.terms.pricing = {
      type: 'distance-bands',
      bands: [
        {
          fromKm: '999999999999.00000001',
          toKm: '999999999999.00000002',
          basis: 'per-km',
          amount: '2.03',
          evidence,
        },
      ],
    };
    expect(
      applicabilityNotes(
        precise,
        'Traginers',
        'EUR',
        '2026-10-16',
        'Barcelona',
        '999999999999.00000001',
      ),
    ).toEqual([]);
    expect(
      applicabilityNotes(
        precise,
        'Traginers',
        'EUR',
        '2026-10-16',
        'Barcelona',
        '999999999999.00000002',
      ),
    ).toContain('La distancia no tiene un tramo tarifario.');
  });
  it('reports malformed distances and nonaccepted estimates as pending', () => {
    const estimate = structuredClone(agreement);
    estimate.terms.agreementBasis = 'internal-estimate';
    estimate.terms.pricing = {
      type: 'per-km',
      amount: '2.03',
      evidence: estimate.terms.evidence,
    };
    expect(
      applicabilityNotes(
        estimate,
        'Traginers',
        'EUR',
        '2026-10-16',
        'Barcelona',
        'abc',
      ),
    ).toContain('Falta una distancia positiva revisada.');
    expect(
      applicabilityNotes(
        estimate,
        'Traginers',
        'EUR',
        '2026-10-16',
        'Barcelona',
        '10',
      ),
    ).toContain('El acuerdo no está confirmado como aceptado por las partes.');
  });
  it('does not conceal conflicting provider, currency, validity or route', () => {
    expect(
      applicabilityNotes(
        agreement,
        'Hapag',
        'USD',
        '2027-01-01',
        'Madrid',
        '10',
      ),
    ).toHaveLength(4);
  });
});

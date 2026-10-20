import { describe, expect, it } from 'vitest';
import { analysisLineSchema } from './agreement-conditions.js';
import { analysisResultSchema } from './analysis.js';

const evidence = [
  {
    documentId: '10000000-0000-4000-8000-000000000001',
    extractionRunId: '10000000-0000-4000-8000-000000000002',
    page: 1,
    snippet: 'Synthetic terms',
    revisionId: null,
  },
];
const line = {
  id: 'rate',
  description: 'Synthetic monthly service',
  service: 'unknown',
  route: null,
  quantity: null,
  unit: 'MONTH',
  unitPrice: '47',
  amount: null,
  evidence,
};

describe('additive comparison contracts', () => {
  it('reads historical results without observational comparisons', () => {
    expect(
      analysisResultSchema.parse({ ruleVersion: 'logistics-v4', findings: [] })
        .comparisonCandidates,
    ).toBeUndefined();
    expect(analysisLineSchema.parse(line).pricingTerms).toBeUndefined();
  });
  it('requires evidence and rejects reversed or invalid price periods', () => {
    const terms = {
      behavior: 'fixed',
      cadence: 'monthly',
      dateBasis: 'service-date',
      validFrom: '2026-02-01',
      validUntil: '2026-01-01',
      evidence,
    };
    expect(
      analysisLineSchema.safeParse({ ...line, pricingTerms: terms }).success,
    ).toBe(false);
    expect(
      analysisLineSchema.safeParse({
        ...line,
        pricingTerms: { ...terms, validUntil: '2026-02-30' },
      }).success,
    ).toBe(false);
    expect(
      analysisLineSchema.safeParse({
        ...line,
        pricingTerms: { ...terms, validUntil: '2026-03-01', evidence: [] },
      }).success,
    ).toBe(false);
  });
  it('keeps a valid evidenced monthly rate distinct from an invoice quantity', () => {
    const parsed = analysisLineSchema.parse({
      ...line,
      pricingTerms: {
        behavior: 'fixed',
        cadence: 'monthly',
        dateBasis: 'service-date',
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        evidence,
      },
    });
    expect(parsed.quantity).toBeNull();
    expect(parsed.pricingTerms?.cadence).toBe('monthly');
  });
});

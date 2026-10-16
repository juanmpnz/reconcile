import { describe, expect, it } from 'vitest';
import { agreementPricingSchema } from './agreements.js';
const evidence = [
  {
    documentId: '10000000-0000-4000-8000-000000000001',
    extractionRunId: '10000000-0000-4000-8000-000000000002',
    page: 1,
    snippet: 'Accepted price',
  },
];
describe('commercial pricing transport boundaries', () => {
  it('rejects malformed decimals without throwing at the API schema boundary', () => {
    for (const amount of [
      'abc',
      '1e3',
      '-1',
      '0',
      '0.000000001',
      '9999999999999',
    ]) {
      expect(() =>
        agreementPricingSchema.safeParse({
          type: 'fixed-trip',
          amount,
          evidence,
        }),
      ).not.toThrow();
      expect(
        agreementPricingSchema.safeParse({
          type: 'fixed-trip',
          amount,
          evidence,
        }).success,
      ).toBe(false);
    }
    expect(() =>
      agreementPricingSchema.safeParse({
        type: 'distance-bands',
        bands: [
          {
            fromKm: 'invalid',
            toKm: '30',
            basis: 'per-km',
            amount: '2',
            evidence,
          },
        ],
      }),
    ).not.toThrow();
  });
  it('compares sub-centimeter boundaries exactly even at maximum integer precision', () => {
    const band = (fromKm: string, toKm: string) => ({
      fromKm,
      toKm,
      basis: 'per-km',
      amount: '2',
      evidence,
    });
    expect(
      agreementPricingSchema.safeParse({
        type: 'distance-bands',
        bands: [
          band('999999999999.00000001', '999999999999.00000002'),
          band('999999999999.00000002', '999999999999.00000003'),
        ],
      }).success,
    ).toBe(true);
    expect(
      agreementPricingSchema.safeParse({
        type: 'distance-bands',
        bands: [
          band('0', '999999999999.00000002'),
          band('999999999999.00000001', '999999999999.00000003'),
        ],
      }).success,
    ).toBe(false);
    expect(
      agreementPricingSchema.safeParse({
        type: 'distance-bands',
        bands: [band('5', '5')],
      }).success,
    ).toBe(false);
  });
});

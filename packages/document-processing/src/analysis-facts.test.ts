import { describe, expect, it } from 'vitest';
import type { ExtractionResult } from '@reconcile/contracts';
import { deriveAnalysisFacts } from './analysis-facts.js';

const documentId = '10000000-0000-4000-8000-000000000001';
const extractionRunId = '10000000-0000-4000-8000-000000000002';
function facts(row: string) {
  const result: ExtractionResult = {
    engine: 'pdfjs-text-v1',
    pages: [{ page: 2, text: `Route: Barcelona to Port\n${row}` }],
    fields: [],
    warnings: [],
  };
  return deriveAnalysisFacts({
    documentId,
    extractionRunId,
    kind: 'invoice',
    result,
    corrections: [],
  });
}

describe('bounded invoice table kilometre extraction', () => {
  it.each(['km', 'KM', 'Km'])(
    'preserves decimal values, route and original page evidence for %s',
    (unit) => {
      const row = `Pickup - Barcelona to Port 30.25 ${unit} 2.50 75.625`;
      expect(facts(row).lines).toEqual([
        {
          id: 'line-1',
          description: 'Pickup - Barcelona to Port',
          service: 'pickup',
          route: 'Barcelona to Port',
          quantity: '30.25',
          unit: 'km',
          unitPrice: '2.50',
          amount: '75.625',
          evidence: [
            {
              documentId,
              extractionRunId,
              page: 2,
              snippet: row,
              revisionId: null,
            },
          ],
        },
      ]);
    },
  );
  it('keeps existing trip/service syntax and rejects unsupported units or incomplete rows', () => {
    expect(
      facts('Pickup - Barcelona to Port 1 trip 62 62').lines[0]?.unit,
    ).toBe('trip');
    expect(facts('Ocean handling 1 service 150 150').lines[0]?.service).toBe(
      'ocean-handling',
    );
    for (const row of [
      'Pickup - Barcelona to Port 30 mile 2.5 75',
      'Pickup - Barcelona to Port 30 km 2.5',
      'Total 75 km 1 75',
    ]) {
      const result = facts(row);
      expect(result.lines).toHaveLength(0);
      expect(result.warnings).toContain('LINE_ITEMS_MISSING');
    }
  });
});

import { describe, expect, it } from 'vitest';
import { groupEvidence } from './evidence';
import { findingCounts, findingGroup } from './presentation';
import type { AnalysisRun } from '@reconcile/contracts';
const citation = {
  documentId: '00000000-0000-4000-8000-000000000001',
  extractionRunId: '00000000-0000-4000-8000-000000000002',
  revisionId: null,
  page: 1,
  snippet: 'Texto literal completo de la fuente.',
};
describe('comparison presentation without changing financial meaning', () => {
  it('deduplicates only identical citations and keeps page/version/revision provenance', () => {
    const groups = groupEvidence([
      citation,
      { ...citation },
      { ...citation, page: 2 },
      { ...citation, extractionRunId: '00000000-0000-4000-8000-000000000003' },
      { ...citation, revisionId: '00000000-0000-4000-8000-000000000004' },
      { ...citation, documentId: '00000000-0000-4000-8000-000000000005' },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.items).toHaveLength(4);
    expect(groups[1]?.items).toHaveLength(1);
    expect(groups[0]?.items[0]?.snippet).toBe(citation.snippet);
  });
  it('counts outcomes without summing overlapping or differently denominated amounts', () => {
    const base = {
      documentId: citation.documentId,
      lineId: 'one',
      service: 'pickup',
      code: 'EXCLUDED_SERVICE',
      expected: '0',
      invoiced: '62',
      difference: '62',
      currency: 'USD',
      explanation: 'Evidence',
      evidence: [],
    };
    const findings: NonNullable<AnalysisRun['result']>['findings'] = [
      { ...base, status: 'confirmed' },
      { ...base, status: 'matched', currency: 'EUR' },
      { ...base, status: 'not-verifiable', difference: null },
    ];
    expect(findingCounts(findings)).toEqual({
      confirmed: 1,
      probable: 0,
      matched: 1,
      'not-verifiable': 1,
    });
    expect(findingGroup('LINE_ARITHMETIC')).toBe('arithmetic');
    expect(findingGroup('EXCLUDED_SERVICE')).toBe('service');
    expect(findingGroup('TOTAL_INCONSISTENT')).toBe('arithmetic');
  });
});

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

describe('agreement identity and bounded evidence extraction', () => {
  function extract(text: string) {
    return deriveAnalysisFacts({
      documentId,
      extractionRunId,
      kind: 'quotation',
      result: {
        engine: 'pdfjs-text-v1',
        pages: [{ page: 1, text }],
        fields: [],
        warnings: [],
      },
      corrections: [],
    });
  }
  it('keeps agreement, booking and BL identities separate without fabricating operation identity', () => {
    const result = extract(
      'Quotation reference: Q2603BCN00826\nBooking reference: BK-42\nBL reference: BL-99',
    );
    expect(result.operationReference).toBeNull();
    expect(result.references?.map((r) => [r.type, r.value])).toEqual([
      ['quotation', 'Q2603BCN00826'],
      ['booking', 'BK-42'],
      ['bl', 'BL-99'],
    ]);
    expect(result.references?.every((r) => r.evidence[0]?.page === 1)).toBe(
      true,
    );
  });
  it('preserves directional route, equipment and contractual date basis without invoice-date fallback', () => {
    const result = extract(
      'Origin: Valencia\nDestination: Mundra\nEquipment type: 40HC\nValidity date basis: shipment-date\nInvoice date: 2026-05-01\nValid from: 2026-04-01\nValid until: 2026-12-31',
    );
    expect(result.origin).toBe('Valencia');
    expect(result.destination).toBe('Mundra');
    expect(result.equipmentType).toBe('40HC');
    expect(result.shipmentDate).toBeNull();
    expect(result.invoiceDate).toBe('2026-05-01');
    expect(result.applicability?.dateBasis).toBe('shipment-date');
  });
  it('preserves negative amounts and never adds matrix columns without a supported table layout', () => {
    const result = facts('Ocean handling 1 service -15 -15');
    expect(result.lines[0]?.amount).toBe('-15');
    expect(
      extract('20’STD 40’STD 40’HC\nUSD EUR INR\nIncluded in lumpsum').lines,
    ).toEqual([]);
  });
});

it('extracts only explicitly associated line currency, equipment, basis and inclusion', () => {
  const result = facts(
    'Charge: THC; ocean-handling; container; 40HC; 2; -10; -20; USD; Ocean package',
  );
  expect(result.lines[0]).toMatchObject({
    currency: 'USD',
    equipmentType: '40HC',
    billingBasis: 'container',
    quantity: '2',
    unitPrice: '-10',
    amount: '-20',
    includedIn: 'Ocean package',
  });
});

it('accepts explicit agreement-number labels without treating document numbers as operation references', () => {
  const result = facts(
    'Contract number: ANNUAL-2026\nQuote number: QUOTE-2\nBill of lading: BL-7\nDocument number: INV-1',
  );
  expect(result.references?.map((r) => [r.type, r.value])).toEqual([
    ['agreement', 'ANNUAL-2026'],
    ['quotation', 'QUOTE-2'],
    ['bl', 'BL-7'],
  ]);
  expect(result.operationReference).toBeNull();
});

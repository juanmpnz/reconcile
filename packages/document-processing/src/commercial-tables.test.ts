import { describe, expect, it } from 'vitest';
import type { DocumentKind } from '@reconcile/contracts';
import { deriveAnalysisFacts } from './analysis-facts.js';
import { commercialDecimal } from './commercial-tables.js';
const documentId = '10000000-0000-4000-8000-000000000001';
const extractionRunId = '10000000-0000-4000-8000-000000000002';
const facts = (text: string, kind: DocumentKind = 'invoice') =>
  deriveAnalysisFacts({
    documentId,
    extractionRunId,
    kind,
    corrections: [],
    result: {
      engine: 'pdfjs-text-v1',
      pages: [{ page: 1, text }],
      fields: [],
      warnings: [],
    },
  });
const header =
  'Concepto original   Precio tarifa   Divisa   Qty   Ud.   Importe EUR   IVA';
describe('commercial invoice tables', () => {
  it('preserves original tariff and billed currency without inventing FX', () => {
    const result = facts(
      `001 CONT. 40’ X 9'6" HIGH CUBE CONT.\n${header}\nPORT SERVICE   72,00   EUR   2   CTR   144,00   AZ\nMARINE CHARGE   182,50   USD   2   CTR   320,10   AZ\nCREDIT   -44,00   USD   1   CTR   -39,70   AZ\n1 USD = 0,877000 EUR`,
    );
    expect(result.lines).toHaveLength(3);
    expect(result.lines[0]).toMatchObject({
      unitPrice: '72.00',
      quantity: '2',
      amount: '144.00',
      currency: 'EUR',
      equipmentType: '40HC',
    });
    expect(result.lines[1]).toMatchObject({
      tariffUnitPrice: '182.50',
      tariffCurrency: 'USD',
      unitPrice: null,
      amount: '320.10',
      currency: 'EUR',
      service: 'unknown',
      chargeKey: 'marine charge',
    });
    expect(result.lines[2]?.amount).toBe('-39.70');
    expect(result.exchangeRates?.[0]).toMatchObject({
      from: 'USD',
      to: 'EUR',
      rate: '0.877000',
    });
    expect(result.provider).toBeNull();
  });
  it('requires the header and separates BL fees from container equipment', () => {
    expect(facts('PORT SERVICE 72,00 EUR 1 CTR 72,00 AZ').lines).toHaveLength(
      0,
    );
    const result = facts(
      `${header}\nDOCUMENT FEE 41,00 EUR 1 BIL 41,00 AZ\n001 CONT. 20' X 8'6" GENERAL PURPOSE CONT.\n${header}\nPORT SERVICE 72,00 EUR 1 CTR 72,00 AZ`,
    );
    expect(result.lines[0]).toMatchObject({
      billingBasis: 'bl',
      equipmentType: null,
    });
    expect(result.lines[1]).toMatchObject({
      billingBasis: 'container',
      equipmentType: '20STD',
    });
  });
  it('keeps malformed and ambiguous decimal rows out of verified extraction', () => {
    const malformed = facts(
      `${header}\nPORT SERVICE 2,14.00 EUR 1 CTR 20,00 AZ`,
    );
    expect(malformed.lines).toHaveLength(0);
    expect(malformed.warnings).toContain('COMMERCIAL_ROWS_PARTIAL');
    const symbols = facts(`${header}\n--- 70 EUR 1 CTR 70 AZ`);
    expect(symbols.lines).toHaveLength(0);
    expect(symbols.warnings).toContain('COMMERCIAL_ROWS_PARTIAL');
    expect(commercialDecimal('1.234,50')).toBe('1234.50');
    expect(commercialDecimal('1,234.50')).toBeNull();
  });
  it('records incomplete source and preserves final destination rather than VIA', () => {
    const result = facts(
      'No se recibió la página 2 del original.\nDE: PORT A | VIA: PORT B | A: CITY C',
    );
    expect(result.warnings).toContain('SOURCE_INCOMPLETE');
    expect(result.origin).toBe('PORT A');
    expect(result.destination).toBe('CITY C');
  });
});
describe('commercial quotation matrices', () => {
  it('splits equipment alternatives, signs and currencies without inventing quantities or totals', () => {
    const result = facts(
      'Freight Charges Curr 20’STD 40’STD 40’HC\nLumpsum USD -211 -512 -512\nSurcharge / Concept Curr 20’STD 40’STD 40’HC\nTerminal Charge EUR 201 240 240\nSubject to Document Charge: EUR 48 per Bill of Lading',
      'quotation',
    );
    expect(result.lines).toHaveLength(7);
    expect(result.lines[0]).toMatchObject({
      unitPrice: '-211',
      amount: null,
      quantity: null,
      equipmentType: '20STD',
      currency: 'USD',
    });
    expect(result.lines[6]).toMatchObject({
      unitPrice: '48',
      billingBasis: 'bl',
      equipmentType: null,
    });
    expect(result.total).toBeNull();
  });
  it('retains uncertain charge evidence but no numeric price', () => {
    const result = facts(
      'Subject to Destination Fee: INR 4200 per Bill of Lading [LECTURA A CONFIRMAR]\nThe Lumpsum includes the following assessorial charges:',
      'quotation',
    );
    expect(result.lines[0]).toMatchObject({
      unitPrice: null,
      tariffUnitPrice: null,
      amount: null,
    });
    expect(result.lines[0]?.evidence[0]?.snippet).toContain(
      'LECTURA A CONFIRMAR',
    );
    expect(result.warnings).toContain('UNCERTAIN_CHARGE_REQUIRES_REVIEW');
    expect(result.warnings).toContain('INCLUSIONS_REQUIRE_REVIEW');
  });
});

describe('commercial parser section and resource bounds', () => {
  it('stops invoice and matrix tables at footer sections', () => {
    const invoice = facts(
      `${header}\nPORT SERVICE 70,00 EUR 1 CTR 70,00 AZ\nSUMMARY PER TARIFF CURRENCY\nFOOTER VALUE 50,00 EUR 1 CTR 50,00 AZ`,
    );
    expect(invoice.lines).toHaveLength(1);
    const matrix = facts(
      'Freight Charges Curr 20STD 40HC\nPORT SERVICE EUR 70 90\nConditions and contact\nFOOTER VALUE EUR 100 200',
      'quotation',
    );
    expect(matrix.lines).toHaveLength(2);
  });
  it('supports one/two equipment alternatives and rejects malformed unsupported matrices', () => {
    expect(
      facts('Freight Charges Curr 20STD\nSERVICE EUR 70', 'quotation').lines,
    ).toHaveLength(1);
    expect(
      facts('Freight Charges Curr 20STD 40HC\nSERVICE EUR 70 90', 'quotation')
        .lines,
    ).toHaveLength(2);
    for (const text of [
      'Freight Charges Curr 20STD 40HC\nSERVICE EUR 70 bad',
      'Freight Charges Curr 20STD 40HC 45HC\nSERVICE EUR 70 90 100',
    ]) {
      const result = facts(text, 'quotation');
      expect(result.lines).toHaveLength(0);
      expect(result.warnings).toContain('COMMERCIAL_ROWS_PARTIAL');
    }
  });
  it('deduplicates reference rates preserving page evidence but never invoice rows', () => {
    const text = 'Freight Charges Curr 20STD\nSERVICE EUR 70';
    const result = deriveAnalysisFacts({
      documentId,
      extractionRunId,
      kind: 'quotation',
      corrections: [],
      result: {
        engine: 'pdfjs-text-v1',
        pages: [
          { page: 1, text },
          { page: 2, text },
        ],
        fields: [],
        warnings: [],
      },
    });
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.evidence.map((e) => e.page)).toEqual([1, 2]);
    expect(
      facts(`${header}\nSERVICE 70 EUR 1 CTR 70 AZ\nSERVICE 70 EUR 1 CTR 70 AZ`)
        .lines,
    ).toHaveLength(2);
  });
  it('bounds rows, long values, equipment groups and exchange rates without losing all extraction', () => {
    const text = `${header}\n${Array.from({ length: 101 }, (_, i) => `SERVICE ${i} 70 EUR 1 CTR 70 AZ`).join('\n')}\n${'1 USD = 0.9 EUR\n'.repeat(51)}\n${"001 CONT. 20' X STANDARD CONT.\n".repeat(51)}`;
    const result = facts(text);
    expect(result.lines).toHaveLength(100);
    expect(result.exchangeRates).toHaveLength(50);
    expect(result.equipmentQuantities).toHaveLength(50);
    expect(result.warnings).toContain('COMMERCIAL_ROWS_PARTIAL');
    expect(
      facts(`${header}\n${'A'.repeat(501)} 70 EUR 1 CTR 70 AZ`).lines,
    ).toHaveLength(0);
    expect(commercialDecimal('123.456.789.012.345.678.901,00')).toBeNull();
    expect(
      facts("999999999999999999999999999 CONT. 20' X STANDARD CONT.")
        .equipmentQuantities,
    ).toHaveLength(0);
  });
});

describe('evidence-bound comparison metadata', () => {
  it('preserves route evidence and final delivery destination rather than VIA', () => {
    const result = facts(
      'From PORT A, AA (Port) to PORT B, BB (Port)',
      'quotation',
    );
    expect(result.applicability?.origin?.evidence[0]?.snippet).toContain(
      'From PORT A',
    );
    expect(result.applicability?.destination?.evidence[0]?.snippet).toContain(
      'to PORT B',
    );
    const delivery = facts('DE: PORT A | VIA: PORT B | A: CITY C');
    expect(delivery.destination).toBe('CITY C');
    expect(delivery.evidence[0]?.snippet).toContain('VIA: PORT B');
  });
  it('does not confuse billing periods or calendar month labels with contract validity or fixed prices', () => {
    const result = facts(
      `Billing period: 2026-05-01 to 2026-05-31\nInvoice month: May 2026\nValid from: 2026-01-01\nValid until: 2026-12-31\n${header}\nSubscription 80 EUR 1 MONTH 80 EX`,
    );
    expect(result.billingPeriod).toMatchObject({
      from: '2026-05-01',
      to: '2026-05-31',
    });
    expect(result.validFrom).toBe('2026-01-01');
    expect(result.lines[0]).toMatchObject({
      unit: 'MONTH',
      quantity: '1',
      billingBasis: 'other',
    });
    expect(result.lines[0]?.pricingTerms).toMatchObject({
      behavior: 'unknown',
      cadence: 'monthly',
    });
    expect(facts('Billing period: May 2026').billingPeriod).toBeUndefined();
  });
  it('extracts only explicitly scoped fixed terms and marks contradictory terms unknown', () => {
    const result = facts(
      'All rates are fixed from 2026-01-01 to 2026-12-31.\nFreight Charges Curr 20STD\nBase freight EUR 90',
      'quotation',
    );
    expect(result.lines[0]?.pricingTerms).toMatchObject({
      behavior: 'fixed',
      cadence: 'unknown',
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
    });
    expect(result.lines[0]?.pricingTerms?.evidence[0]?.snippet).toContain(
      'All rates are fixed',
    );
    const conflict = facts(
      'All rates are fixed.\nAll rates are variable.\nFreight Charges Curr 20STD\nBase freight EUR 90',
      'quotation',
    );
    expect(conflict.lines[0]?.pricingTerms).toBeUndefined();
    expect(conflict.warnings).toContain('PRICING_TERMS_REQUIRE_REVIEW');
  });
  it('marks only surcharge matrix rows variable without inventing base price behavior', () => {
    const result = facts(
      'Freight Charges Curr 20STD\nBase freight EUR 90\nSurcharge / Concept Curr 20STD\nFuel charge EUR 20\nAll surcharges as valid at time of shipment apply.',
      'quotation',
    );
    expect(result.lines[0]?.pricingTerms).toBeUndefined();
    expect(result.lines[1]?.pricingTerms).toMatchObject({
      behavior: 'variable',
      cadence: 'unknown',
      validFrom: null,
      validUntil: null,
    });
  });
  it('retains unknown provider when only issuing agent or corporate footer is present', () => {
    const result = facts(
      'ISSUING AGENT: SYNTHETIC PORT AGENT\nRegistered office: SYNTHETIC SHIPPING COMPANY',
    );
    expect(result.provider).toBeNull();
  });
  it('rejects invalid or ambiguous billing period evidence', () => {
    expect(
      facts('Billing period: 2026-02-30 to 2026-03-01').billingPeriod,
    ).toBeUndefined();
    const ambiguous = facts(
      'Billing period: 2026-01-01 to 2026-01-31\nBilling period: 2026-02-01 to 2026-02-28',
    );
    expect(ambiguous.billingPeriod).toBeUndefined();
    expect(ambiguous.warnings).toContain('BILLING_PERIOD_REQUIRES_REVIEW');
  });
});

it('keeps explicit pricing date basis separate from invoice date and preserves calendar validation', () => {
  const result = facts(
    `All rates are fixed from 2026-01-01 to 2026-12-31.\nPrice validity date basis: shipment-date\n${header}\nSubscription 80 EUR 1 YEAR 80 EX`,
  );
  expect(result.lines[0]?.pricingTerms).toMatchObject({
    behavior: 'fixed',
    cadence: 'annual',
    dateBasis: 'shipment-date',
  });
  const unsupported = facts(
    'All rates are fixed from 2026-02-30 to 2026-03-01.\nFreight Charges Curr 20STD\nBase freight EUR 90',
    'quotation',
  );
  expect(unsupported.lines[0]?.pricingTerms).toBeUndefined();
  expect(unsupported.warnings).toContain('PRICING_TERMS_REQUIRE_REVIEW');
  const reversed = facts(
    'All rates are fixed from 2026-12-31 to 2026-01-01.\nFreight Charges Curr 20STD\nBase freight EUR 90',
    'quotation',
  );
  expect(reversed.lines[0]?.pricingTerms).toBeUndefined();
});

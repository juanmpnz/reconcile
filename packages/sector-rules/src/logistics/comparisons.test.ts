import { describe, expect, it } from 'vitest';
import type {
  AnalysisDocument,
  AnalysisLine,
  AnalysisSnapshot,
} from '@reconcile/domain';
import { compareReferenceLines } from './comparisons.js';
import { evaluateLogistics } from './evaluate.js';
import { canonicalConcept } from './concepts.js';

const evidence = [
  {
    documentId: 'synthetic',
    extractionRunId: 'demo-run',
    revisionId: null,
    page: 1,
    snippet: 'Independently invented DEMO evidence',
  },
];
const line = (
  id: string,
  description: string,
  price: string,
): AnalysisLine => ({
  id,
  description,
  chargeKey: description,
  service: 'unknown',
  route: 'Port Cedar → Port Maple',
  quantity: '2',
  unit: 'container',
  billingBasis: 'container',
  equipmentType: '40HC',
  unitPrice: price,
  amount: String(Number(price) * 2),
  currency: 'USD',
  evidence,
  pricingTerms: {
    behavior: 'fixed',
    cadence: 'per-unit',
    validFrom: null,
    validUntil: null,
    evidence,
  },
});
const doc = (
  id: string,
  kind: AnalysisDocument['kind'],
  lines: AnalysisLine[],
): AnalysisDocument => ({
  documentId: id,
  extractionRunId: 'demo-run',
  revisionId: null,
  kind,
  provider: 'DEMO Cedar Carrier',
  operationReference: null,
  currency: 'USD',
  total: null,
  taxAmount: '0',
  serviceDate: '2027-06-13',
  serviceReference: null,
  route: 'Port Cedar → Port Maple',
  validFrom: '2027-01-01',
  validUntil: '2027-12-31',
  agreementBasis: 'accepted',
  excludedServices: [],
  assignedProvider: null,
  performedProvider: null,
  serviceStatus: 'unknown',
  lines,
  evidence,
  warnings: [],
});
function setup(): AnalysisSnapshot {
  return {
    organizationId: 'demo-tenant',
    operationReference: 'any-local-label',
    documents: [
      doc('invoice', 'invoice', [line('charged', 'Flete marítimo', '73')]),
      doc('reference', 'agreement', [line('quoted', 'Ocean freight', '68')]),
    ],
  };
}
const invoice = (data: AnalysisSnapshot) => data.documents[0]!;
const reference = (data: AnalysisSnapshot) => data.documents[1]!;
const compare = (data: AnalysisSnapshot) => compareReferenceLines(data)[0]!;

describe('observational contract to invoice comparisons', () => {
  it('compares bilingual commercial concepts despite unknown broad service', () => {
    const result = compare(setup());
    expect(result).toMatchObject({
      concept: 'ocean-freight',
      referenceDocumentId: 'reference',
      referenceLineId: 'quoted',
      priceStatus: 'different',
      status: 'difference',
      expectedUnitPrice: '68',
      actualUnitPrice: '73',
      expectedAmount: '136',
      actualAmount: '146',
      difference: '10',
      claimable: false,
    });
    expect(result.evidence.length).toBeGreaterThan(0);
  });
  it('reports a correspondence without creating a claimable result', () => {
    const data = setup();
    invoice(data).lines[0] = line('charged', 'Ocean freight', '68');
    expect(compare(data)).toMatchObject({
      status: 'correct',
      priceStatus: 'equal',
      claimable: false,
    });
  });
  it('keeps price evidence visible when provider and acceptance are unknown', () => {
    const data = setup();
    invoice(data).provider = null;
    reference(data).agreementBasis = 'unknown';
    const result = compare(data);
    expect(result).toMatchObject({
      status: 'pending',
      priceStatus: 'different',
      difference: '10',
    });
    expect(
      result.conditions.some(
        (condition) =>
          condition.name === 'accepted' && condition.state === 'unknown',
      ),
    ).toBe(true);
  });
  it('compares original source price while conversion remains pending', () => {
    const data = setup();
    const charged = invoice(data).lines[0]!;
    charged.tariffUnitPrice = '73';
    charged.tariffCurrency = 'USD';
    charged.currency = 'EUR';
    charged.unitPrice = null;
    charged.amount = '131';
    expect(compare(data)).toMatchObject({
      status: 'pending',
      priceStatus: 'different',
      currency: 'USD',
      actualUnitPrice: '73',
      difference: '10',
    });
    expect(
      compare(data).conditions.some(
        (condition) => condition.name === 'fx-review',
      ),
    ).toBe(true);
  });
  it('does not compare unknown aliases, even identical amounts or descriptions', () => {
    const data = setup();
    invoice(data).lines[0] = line('charged', 'Invented miscellaneous', '68');
    reference(data).lines[0] = line('quoted', 'Invented miscellaneous', '68');
    expect(compare(data)).toMatchObject({
      status: 'pending',
      priceStatus: 'unknown',
      referenceLineId: null,
    });
  });
  it('uses a comparable booked amount and exposes arithmetic inconsistency', () => {
    const data = setup();
    invoice(data).lines[0]!.amount = '151';
    const result = compare(data);
    expect(result).toMatchObject({
      status: 'pending',
      actualAmount: '151',
      expectedAmount: '136',
      difference: '15',
    });
    expect(
      result.conditions.some(
        (condition) =>
          condition.name === 'line-arithmetic' &&
          condition.state === 'contradictory',
      ),
    ).toBe(true);
  });
  it('never computes quantity-based source totals without row evidence', () => {
    const data = setup();
    invoice(data).lines[0]!.evidence = [];
    expect(compare(data)).toMatchObject({
      status: 'pending',
      quantity: null,
      expectedAmount: null,
      difference: null,
    });
  });
  it('keeps origin and destination handling distinct', () => {
    const data = setup();
    invoice(data).lines[0] = line('charged', 'THC origen', '68');
    reference(data).lines[0] = line(
      'quoted',
      'Destination handling charge',
      '68',
    );
    expect(compare(data).referenceLineId).toBeNull();
    expect(canonicalConcept(line('x', 'Manipulación origen', '1'))).toBe(
      'origin-handling',
    );
  });
  it('uses the correct equipment alternative and reports genuinely duplicated scope as ambiguous', () => {
    const data = setup();
    const other = line('other-equipment', 'Ocean freight', '61');
    other.equipmentType = '20STD';
    reference(data).lines.push(other);
    expect(compareReferenceLines(data)).toHaveLength(1);
    expect(compare(data).status).toBe('difference');
    reference(data).lines.push(line('duplicate', 'Ocean freight', '68'));
    expect(compareReferenceLines(data)).toHaveLength(2);
    expect(
      compareReferenceLines(data).every((item) => item.status === 'pending'),
    ).toBe(true);
  });
  it('bounds ambiguous alternatives without silently selecting a price', () => {
    const data = setup();
    reference(data).lines = Array.from({ length: 19 }, (_, index) =>
      line(`alternative-${index}`, 'Ocean freight', String(39 + index)),
    );
    const result = compareReferenceLines(data);
    expect(result).toHaveLength(8);
    expect(
      result.every(
        (item) =>
          item.status === 'pending' &&
          item.conditions.some(
            (condition) => condition.name === 'candidate-limit',
          ),
      ),
    ).toBe(true);
  });
  it('does not turn an opposite delta into an automatic net claim', () => {
    const data = setup();
    invoice(data).lines.push(line('other-charge', 'Precinto', '12'));
    reference(data).lines.push(line('other-rate', 'Seal fee', '17'));
    const results = compareReferenceLines(data);
    expect(results.map((item) => item.difference)).toEqual(['10', '-10']);
    expect(results.every((item) => item.claimable === false)).toBe(true);
  });
  it('keeps variable clauses, absent dates, partial extraction and missing quantities pending', () => {
    const data = setup();
    reference(data).lines[0]!.pricingTerms!.behavior = 'variable';
    expect(compare(data).status).toBe('pending');
    reference(data).lines[0]!.pricingTerms!.behavior = 'fixed';
    reference(data).validUntil = null;
    expect(compare(data).status).toBe('pending');
    reference(data).validUntil = '2027-12-31';
    invoice(data).warnings = ['COMMERCIAL_ROWS_PARTIAL'];
    expect(compare(data).status).toBe('pending');
    invoice(data).warnings = [];
    invoice(data).lines[0]!.quantity = null;
    expect(compare(data)).toMatchObject({
      status: 'pending',
      expectedAmount: null,
    });
  });
  it('rejects incompatible billing unit and preserves yearly period uncertainty', () => {
    const data = setup();
    reference(data).lines[0]!.billingBasis = 'bl';
    expect(compare(data)).toMatchObject({
      status: 'pending',
      priceStatus: 'unknown',
      expectedAmount: null,
      difference: null,
    });
    reference(data).lines[0]!.billingBasis = 'container';
    reference(data).lines[0]!.pricingTerms!.cadence = 'annual';
    expect(compare(data).status).toBe('pending');
    invoice(data).billingPeriod = {
      from: '2027-06-01',
      to: '2027-06-30',
      evidence,
    };
    reference(data).lines[0]!.pricingTerms!.validFrom = '2027-01-01';
    reference(data).lines[0]!.pricingTerms!.validUntil = '2027-12-31';
    expect(compare(data).status).toBe('pending');
  });
  it.each(['variable', 'monthly', 'expired'] as const)(
    'never emits a claimable legacy price difference for %s commercial terms',
    (scenario) => {
      const data = setup();
      const charged = invoice(data).lines[0]!,
        quoted = reference(data).lines[0]!;
      charged.service = 'ocean-handling';
      quoted.service = 'ocean-handling';
      charged.chargeKey = 'Ocean freight';
      quoted.chargeKey = 'Ocean freight';
      if (scenario === 'variable') quoted.pricingTerms!.behavior = 'variable';
      if (scenario === 'monthly') quoted.pricingTerms!.cadence = 'monthly';
      if (scenario === 'expired')
        quoted.pricingTerms = {
          behavior: 'fixed',
          cadence: 'per-unit',
          validFrom: '2027-01-01',
          validUntil: '2027-02-28',
          dateBasis: 'service-date',
          evidence,
        };
      const result = evaluateLogistics(data);
      expect(result.comparisonCandidates?.[0]?.status).toBe('pending');
      expect(
        result.findings.some(
          (finding) =>
            finding.lineId === charged.id && finding.status === 'confirmed',
        ),
      ).toBe(false);
    },
  );
  it('keeps per-unit row validity pending without an explicit date basis', () => {
    const data = setup();
    reference(data).lines[0]!.pricingTerms!.validFrom = '2027-01-01';
    reference(data).lines[0]!.pricingTerms!.validUntil = '2027-12-31';
    expect(
      compare(data).conditions.some(
        (condition) =>
          condition.name === 'line-validity' && condition.state === 'unknown',
      ),
    ).toBe(true);
  });
  it('does not interpret quantity two as two months or compare monthly to annual prices', () => {
    const data = setup();
    reference(data).lines[0]!.pricingTerms!.cadence = 'monthly';
    invoice(data).lines[0]!.pricingTerms!.cadence = 'annual';
    expect(compare(data)).toMatchObject({
      status: 'pending',
      priceStatus: 'unknown',
      expectedAmount: null,
      actualAmount: null,
      difference: null,
      calculation: null,
    });
  });
  it.each(['price', 'currency'] as const)(
    'never assembles a source price/currency from mismatched fields when missing %s',
    (missing) => {
      const data = setup();
      const charged = invoice(data).lines[0]!;
      charged.currency = 'EUR';
      charged.tariffCurrency = missing === 'currency' ? null : 'USD';
      charged.tariffUnitPrice = missing === 'price' ? null : '79';
      const result = compare(data);
      expect(result.status).toBe('pending');
      expect(result.priceStatus).toBe('unknown');
      expect(result.actualUnitPrice).toBeNull();
      expect(result.actualCurrency).toBeNull();
    },
  );
  it('does not conflate generic freight with maritime pricing without mode evidence', () => {
    const data = setup();
    invoice(data).lines[0] = line('charged', 'Freight', '73');
    expect(compare(data)).toMatchObject({
      status: 'pending',
      priceStatus: 'different',
    });
    invoice(data).transportMode = 'air';
    expect(
      compare(data).conditions.some(
        (condition) =>
          condition.name === 'freight-transport-mode' &&
          condition.state === 'contradictory',
      ),
    ).toBe(true);
    invoice(data).transportMode = 'sea';
    expect(compare(data).status).toBe('difference');
  });
  it.each([
    ['Wharfage orig', 'Muellaje en origen', 'origin-wharfage'],
    [
      'Equipment transfer orig',
      'Traslado de equipo en origen',
      'origin-equipment-transfer',
    ],
    ['Carrier security fee', 'Cargo seguridad naviera', 'carrier-security'],
    [
      'Marinefuel recover',
      'Recuperación combustible marino',
      'marine-fuel-recovery',
    ],
    ['EU emiss allowance', 'Derechos de emisión', 'emission-allowance'],
    [
      'Equipment maintenance',
      'Mantenimiento de equipo',
      'equipment-maintenance',
    ],
    ['Import service fee', 'Servicio de importación', 'import-service'],
    [
      'Terminal handling charge orig',
      'Manipulación en origen',
      'origin-handling',
    ],
  ])(
    'recognizes curated public vocabulary %s without matching by price',
    (a, b, concept) => {
      expect(canonicalConcept(line('a', a, '43'))).toBe(concept);
      expect(canonicalConcept(line('b', b, '91'))).toBe(concept);
    },
  );
  it('does not map generic terminal handling to equipment transfer by amount', () => {
    const data = setup();
    invoice(data).lines[0] = line('charged', 'Manejo en terminal', '68');
    reference(data).lines[0] = line(
      'quoted',
      'Equipment transfer origin',
      '68',
    );
    expect(compare(data).referenceLineId).toBeNull();
  });
  it.each(['Marine fuel recovery', 'Emission allowance', 'Lumpsum'])(
    'keeps %s clause applicability pending while showing original rates',
    (concept) => {
      const data = setup();
      const invoiceConcept = concept === 'Lumpsum' ? 'Ocean freight' : concept;
      invoice(data).lines[0] = line('charged', invoiceConcept, '73');
      reference(data).lines[0] = line('quoted', concept, '68');
      reference(data).transportMode = 'sea';
      const result = compare(data);
      expect(result).toMatchObject({
        status: 'pending',
        priceStatus: 'different',
        actualUnitPrice: '73',
        expectedUnitPrice: '68',
        claimable: false,
      });
    },
  );
});

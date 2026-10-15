import { describe, expect, it } from 'vitest';
import type {
  AnalysisDocument,
  AnalysisEvidence,
  AnalysisLine,
  AnalysisSnapshot,
} from '@reconcile/domain';
import { evaluateLogistics } from './evaluate.js';
const source = (id: string): AnalysisEvidence[] => [
  {
    documentId: id,
    extractionRunId: 'run-' + id,
    page: 1,
    snippet: 'Synthetic reviewed evidence',
    revisionId: null,
  },
];
const line = (
  id: string,
  service: AnalysisLine['service'],
  amount: string,
  route: string | null = 'Port A',
): AnalysisLine => ({
  id,
  description: service,
  service,
  route,
  quantity: '1',
  unit: service === 'pickup' ? 'trip' : 'service',
  unitPrice: amount,
  amount,
  evidence: source(id),
});
function document(
  id: string,
  kind: AnalysisDocument['kind'],
): AnalysisDocument {
  return {
    documentId: id,
    extractionRunId: 'run-' + id,
    revisionId: null,
    kind,
    provider: 'Carrier',
    operationReference: 'OP-1',
    currency: 'USD',
    total: '212',
    taxAmount: '0',
    serviceDate: '2026-10-10',
    serviceReference: 'PICK-1',
    route: 'Warehouse A to Port A',
    validFrom: '2026-10-01',
    validUntil: '2026-10-31',
    agreementBasis: 'unknown',
    excludedServices: [],
    assignedProvider: null,
    performedProvider: null,
    serviceStatus: 'unknown',
    lines: [],
    evidence: source(id),
    warnings: [],
  };
}
function snapshot(): AnalysisSnapshot {
  const carrier = document('carrier', 'invoice');
  carrier.lines = [
    line('handling', 'ocean-handling', '150'),
    line('pickup', 'pickup', '62', carrier.route),
  ];
  const agreement = document('agreement', 'agreement');
  agreement.agreementBasis = 'accepted';
  agreement.lines = [line('agreed-handling', 'ocean-handling', '150')];
  agreement.excludedServices = [
    { service: 'pickup', route: carrier.route, evidence: source('agreement') },
  ];
  const transport = document('transport', 'invoice');
  transport.provider = 'Transport';
  transport.total = '62';
  transport.lines = [line('transport-pickup', 'pickup', '62', carrier.route)];
  const record = document('record', 'operational-record');
  record.provider = 'Transport';
  record.assignedProvider = 'Transport';
  record.performedProvider = 'Transport';
  record.serviceStatus = 'completed';
  return {
    organizationId: 'tenant',
    operationReference: 'OP-1',
    documents: [carrier, agreement, transport, record],
  };
}
const get = (data: AnalysisSnapshot, id: string): AnalysisDocument => {
  const result = data.documents.find((item) => item.documentId === id);
  if (!result) throw Error('test fixture missing');
  return result;
};
const carrierFindings = (data: AnalysisSnapshot) =>
  evaluateLogistics(data).findings.filter(
    (item) => item.documentId === 'carrier',
  );
describe('logistics comparison versioned rules', () => {
  it('explains 62 USD with agreement, exact service and another provider bill', () => {
    const result = carrierFindings(snapshot());
    expect(result.find((item) => item.code === 'PRICE_MATCH')?.difference).toBe(
      '0',
    );
    const pickup = result.find(
      (item) => item.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER',
    );
    expect(pickup).toMatchObject({
      difference: '62',
      expected: '0',
      status: 'confirmed',
      currency: 'USD',
    });
    expect(pickup?.evidence.map((item) => item.documentId)).toEqual(
      expect.arrayContaining(['carrier', 'agreement', 'record', 'transport']),
    );
  });
  it.each(['route', 'serviceReference', 'serviceDate'] as const)(
    'does not claim duplicate with a different %s',
    (key) => {
      const data = snapshot();
      get(data, 'record')[key] = 'different';
      expect(
        carrierFindings(data).some(
          (item) => item.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER',
        ),
      ).toBe(false);
      expect(
        carrierFindings(data).some((item) => item.code === 'EXCLUDED_SERVICE'),
      ).toBe(true);
    },
  );
  it.each(['serviceReference', 'serviceDate', 'provider', 'evidence'] as const)(
    'requires corroborating other-provider invoice %s',
    (field) => {
      const data = snapshot();
      const transport = get(data, 'transport');
      if (field === 'evidence')
        transport.lines = transport.lines.map((item) => ({
          ...item,
          evidence: [],
        }));
      else transport[field] = 'different';
      expect(
        carrierFindings(data).some(
          (item) => item.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER',
        ),
      ).toBe(false);
    },
  );
  it('never matches two unknown service identities', () => {
    const data = snapshot();
    get(data, 'carrier').serviceReference = null;
    get(data, 'record').serviceReference = null;
    expect(
      carrierFindings(data).some(
        (item) => item.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER',
      ),
    ).toBe(false);
  });
  it.each(['missing', 'expired', 'estimate', 'unaccepted', 'ambiguous'])(
    'rejects %s agreement',
    (scenario) => {
      const data = snapshot();
      const agreement = get(data, 'agreement');
      if (scenario === 'missing')
        data.documents = data.documents.filter((item) => item !== agreement);
      if (scenario === 'expired') agreement.validUntil = '2026-09-30';
      if (scenario === 'estimate')
        agreement.agreementBasis = 'internal-estimate';
      if (scenario === 'unaccepted') agreement.agreementBasis = 'unknown';
      if (scenario === 'ambiguous')
        data.documents.push({ ...agreement, documentId: 'agreement2' });
      expect(
        carrierFindings(data)
          .filter((item) => item.lineId !== null)
          .every((item) => item.status === 'not-verifiable'),
      ).toBe(true);
    },
  );
  it('ignores agreements for other routes before ambiguity selection', () => {
    const data = snapshot();
    const other = structuredClone(get(data, 'agreement'));
    other.documentId = 'other-scope';
    other.lines = other.lines.map((item) => ({ ...item, route: 'Port B' }));
    other.excludedServices = other.excludedServices.map((item) => ({
      ...item,
      route: 'Warehouse B to Port B',
    }));
    data.documents.push(other);
    expect(
      carrierFindings(data).some((item) => item.code === 'AGREEMENT_AMBIGUOUS'),
    ).toBe(false);
    get(data, 'carrier').lines[0]!.route = 'Port B';
    expect(
      carrierFindings(data).find((item) => item.lineId === 'handling')?.code,
    ).toBe('PRICE_MATCH');
  });
  it('rejects blank identities and invalid calendar dates', () => {
    const data = snapshot();
    get(data, 'carrier').serviceDate = '2026-02-31';
    expect(
      carrierFindings(data).every((item) => item.code === 'AGREEMENT_MISSING'),
    ).toBe(true);
    const second = snapshot();
    get(second, 'carrier').provider = ' ';
    get(second, 'agreement').provider = ' ';
    expect(
      carrierFindings(second).every(
        (item) => item.code === 'AGREEMENT_MISSING',
      ),
    ).toBe(true);
  });
  it('does not convert currencies without a supported rule', () => {
    const data = snapshot();
    get(data, 'agreement').currency = 'EUR';
    expect(
      carrierFindings(data).every(
        (item) => item.code === 'CURRENCY_UNVERIFIABLE',
      ),
    ).toBe(true);
  });
  it('detects compensating line errors without netting', () => {
    const data = snapshot();
    const invoice = get(data, 'carrier');
    invoice.total = '300';
    invoice.lines = [
      line('a', 'ocean-handling', '160'),
      line('b', 'pickup', '140', invoice.route),
    ];
    const agreement = get(data, 'agreement');
    agreement.excludedServices = [];
    agreement.lines = [
      line('agreed-a', 'ocean-handling', '150'),
      line('agreed-b', 'pickup', '150', invoice.route),
    ];
    expect(carrierFindings(data).map((item) => item.difference)).toEqual([
      '10',
      '-10',
    ]);
  });
  it('preserves cent precision and flags quantity and unit differences', () => {
    const data = snapshot();
    const invoice = get(data, 'carrier');
    invoice.total = '0.30';
    invoice.lines = [
      {
        ...line('a', 'ocean-handling', '0.30'),
        quantity: '3',
        unitPrice: '0.10',
      },
    ];
    const agreement = get(data, 'agreement');
    agreement.lines = [
      {
        ...line('agreed-a', 'ocean-handling', '0.20'),
        quantity: '2',
        unitPrice: '0.10',
      },
    ];
    expect(carrierFindings(data)[0]?.difference).toBe('0.1');
    const first = invoice.lines[0];
    if (first) first.unit = 'container';
    expect(carrierFindings(data)[0]?.code).toBe('UNIT_MISMATCH');
  });
  it('reports missing tax and mismatched total independently', () => {
    const data = snapshot();
    get(data, 'carrier').taxAmount = null;
    expect(
      carrierFindings(data).some((item) => item.code === 'TAX_UNVERIFIABLE'),
    ).toBe(true);
    get(data, 'carrier').taxAmount = '1';
    expect(
      carrierFindings(data).find((item) => item.code === 'TOTAL_INCONSISTENT')
        ?.difference,
    ).toBe('-1');
  });
  it('keeps full precision for the largest supported decimal factors', () => {
    const data = snapshot();
    const invoice = get(data, 'carrier');
    const agreement = get(data, 'agreement');
    const quantity = '999999999999999999999999999999.999999999999';
    const unitPrice = quantity;
    const charge = line('huge', 'ocean-handling', '1');
    charge.quantity = quantity;
    charge.unitPrice = unitPrice;
    invoice.lines = [charge];
    invoice.total = '1';
    agreement.lines = [
      { ...charge, id: 'huge-agreed', evidence: source('agreement') },
    ];
    expect(
      carrierFindings(data).find((item) => item.code === 'LINE_ARITHMETIC')
        ?.expected,
    ).toBe(
      '999999999999999999999999999999999999999998000000000000000000.000000000000000000000001',
    );
  });
  it('does not silently validate nonzero tax without fiscal rules', () => {
    const data = snapshot();
    get(data, 'carrier').taxAmount = '1';
    get(data, 'carrier').total = '213';
    expect(
      carrierFindings(data).some(
        (item) =>
          item.code === 'TAX_REVIEW_REQUIRED' &&
          item.status === 'not-verifiable',
      ),
    ).toBe(true);
  });
  it('is deterministic and does not mutate its snapshot', () => {
    const data = snapshot();
    const before = JSON.stringify(data);
    const first = evaluateLogistics(data);
    expect(evaluateLogistics(data)).toEqual(first);
    expect(JSON.stringify(data)).toBe(before);
    expect(first.ruleVersion).toBe('logistics-v1');
  });
});

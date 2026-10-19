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
      carrierFindings(data).every((item) =>
        [
          'AGREEMENT_MISSING',
          'AGREEMENT_PENDING',
          'AGREEMENT_NOT_APPLICABLE',
        ].includes(item.code),
      ),
    ).toBe(true);
    const second = snapshot();
    get(second, 'carrier').provider = ' ';
    get(second, 'agreement').provider = ' ';
    expect(
      carrierFindings(second).every((item) =>
        [
          'AGREEMENT_MISSING',
          'AGREEMENT_PENDING',
          'AGREEMENT_NOT_APPLICABLE',
        ].includes(item.code),
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
    expect(first.ruleVersion).toBe('logistics-v4');
  });
});

function selectedSnapshot(): AnalysisSnapshot {
  const data = snapshot();
  data.operationId = 'operation-one';
  const invoice = get(data, 'carrier');
  invoice.route = 'Port A';
  invoice.lines = [line('handling', 'ocean-handling', '150')];
  invoice.total = '150';
  const termsEvidence = source('annual').map((item) => ({
    documentId: item.documentId,
    extractionRunId: item.extractionRunId,
    page: item.page,
    snippet: item.snippet,
  }));
  data.agreementBindings = [
    {
      invoiceDocumentId: 'carrier',
      agreementVersionId: 'annual-v1',
      serviceDate: '2026-10-10',
      route: 'Port A',
      distanceKm: '30',
      agreement: {
        id: 'annual-v1',
        organizationId: 'tenant',
        scope: 'reusable',
        operationId: null,
        sourceDocumentId: 'annual',
        sourceExtractionRunId: 'run-annual',
        terms: {
          agreementBasis: 'accepted',
          provider: 'Carrier',
          currency: 'USD',
          validFrom: '2026-01-01',
          validUntil: '2026-12-31',
          route: 'Port A',
          service: 'ocean-handling',
          pricing: {
            type: 'fixed-trip',
            amount: '150',
            evidence: termsEvidence,
          },
          evidence: termsEvidence,
        },
      },
    },
  ];
  return data;
}
const binding = (data: AnalysisSnapshot) => {
  const selected = data.agreementBindings?.[0];
  if (!selected) throw Error('missing test binding');
  return selected;
};
const selectedFinding = (data: AnalysisSnapshot) =>
  carrierFindings(data).find((item) => item.lineId === 'handling');
function bandSnapshot(distance: string): AnalysisSnapshot {
  const data = selectedSnapshot();
  const selected = binding(data);
  selected.distanceKm = distance;
  const evidence = selected.agreement.terms.evidence;
  selected.agreement.terms.pricing = {
    type: 'distance-bands',
    bands: [
      { fromKm: '0', toKm: '30', basis: 'fixed-trip', amount: '100', evidence },
      {
        fromKm: '30',
        toKm: '50',
        basis: 'fixed-trip',
        amount: '150',
        evidence,
      },
      { fromKm: '50', toKm: '100', basis: 'per-km', amount: '2.50', evidence },
    ],
  };
  return data;
}
describe('explicit reusable and spot agreement bindings', () => {
  it('uses the selected annual version without any operation reference or source document in the operation', () => {
    const data = selectedSnapshot();
    get(data, 'agreement').lines[0]!.unitPrice = '999';
    expect(selectedFinding(data)).toMatchObject({
      code: 'PRICE_MATCH',
      expected: '150',
      status: 'matched',
    });
    expect(
      selectedFinding(data)?.evidence.some(
        (item) => item.documentId === 'annual',
      ),
    ).toBe(true);
  });
  it.each([
    ['provider', 'Other carrier', 'AGREEMENT_PROVIDER_MISMATCH'],
    ['currency', 'EUR', 'CURRENCY_UNVERIFIABLE'],
    ['validUntil', '2026-09-01', 'AGREEMENT_DATE_UNVERIFIABLE'],
    ['route', 'Port B', 'AGREEMENT_SCOPE_MISMATCH'],
  ] as const)(
    'rejects selected %s mismatch without falling back to an otherwise matching operation agreement',
    (field, value, code) => {
      const data = selectedSnapshot();
      binding(data).agreement.terms[field] = value;
      expect(selectedFinding(data)).toMatchObject({
        code,
        status: 'not-verifiable',
        expected: null,
      });
    },
  );
  it('rejects ambiguous selections, foreign tenants and evidence copied from another source', () => {
    const data = selectedSnapshot();
    data.agreementBindings?.push(structuredClone(binding(data)));
    expect(selectedFinding(data)?.code).toBe('AGREEMENT_BINDING_AMBIGUOUS');
    const foreign = selectedSnapshot();
    binding(foreign).agreement.organizationId = 'another-tenant';
    expect(selectedFinding(foreign)?.code).toBe('AGREEMENT_BINDING_INVALID');
    const wrongSource = selectedSnapshot();
    binding(wrongSource).agreement.terms.evidence[0]!.documentId = 'unrelated';
    expect(selectedFinding(wrongSource)?.code).toBe(
      'AGREEMENT_BINDING_INVALID',
    );
  });
  it('accepts a pinned spot agreement only for its operation', () => {
    const data = selectedSnapshot();
    binding(data).agreement.scope = 'spot';
    binding(data).agreement.operationId = data.operationId ?? null;
    expect(selectedFinding(data)?.code).toBe('PRICE_MATCH');
    data.operationId = 'other-operation';
    expect(selectedFinding(data)?.code).toBe('AGREEMENT_BINDING_INVALID');
  });
  it.each([
    ['29.99999999', '100'],
    ['30', '150'],
    ['49.99999999', '150'],
  ])(
    'selects lower-inclusive upper-exclusive distance band at %s km',
    (distance, expected) => {
      expect(selectedFinding(bandSnapshot(distance!))?.expected).toBe(expected);
    },
  );
  it('does not fill a distance gap or extend the maximum boundary', () => {
    const data = bandSnapshot('30');
    const pricing = binding(data).agreement.terms.pricing;
    if (pricing.type === 'distance-bands') pricing.bands[1]!.fromKm = '31';
    expect(selectedFinding(data)?.code).toBe('DISTANCE_BAND_MISSING');
    expect(selectedFinding(bandSnapshot('100'))?.code).toBe(
      'DISTANCE_BAND_MISSING',
    );
  });
  it('rejects overlapping bands, missing distance and pricing evidence', () => {
    const data = bandSnapshot('30');
    const pricing = binding(data).agreement.terms.pricing;
    if (pricing.type === 'distance-bands') pricing.bands[1]!.fromKm = '29';
    expect(selectedFinding(data)?.code).toBe('DISTANCE_BANDS_INVALID');
    binding(data).distanceKm = null;
    expect(selectedFinding(data)?.code).toBe('DISTANCE_UNVERIFIABLE');
    const noEvidence = selectedSnapshot();
    const price = binding(noEvidence).agreement.terms.pricing;
    if (price.type !== 'distance-bands') price.evidence = [];
    expect(selectedFinding(noEvidence)?.code).toBe(
      'AGREEMENT_PRICE_UNVERIFIABLE',
    );
  });
  it('multiplies the whole distance by the selected per-km rate with exact decimals, never marginal tiers', () => {
    const data = bandSnapshot('50.12');
    const invoice = get(data, 'carrier');
    invoice.lines = [
      {
        ...line('handling', 'ocean-handling', '125.30'),
        unit: 'km',
        quantity: '50.12',
        unitPrice: '2.50',
      },
    ];
    invoice.total = '125.30';
    expect(selectedFinding(data)).toMatchObject({
      code: 'PRICE_MATCH',
      expected: '125.3',
      difference: '0',
    });
    invoice.lines[0]!.unit = 'service';
    expect(selectedFinding(data)?.code).toBe('AGREEMENT_UNIT_UNVERIFIABLE');
  });
  it('requires distance for a non-banded per-km rate and rejects contradictory invoice facts', () => {
    const data = selectedSnapshot();
    binding(data).agreement.terms.pricing = {
      type: 'per-km',
      amount: '5',
      evidence: binding(data).agreement.terms.evidence,
    };
    binding(data).distanceKm = null;
    expect(selectedFinding(data)?.code).toBe('DISTANCE_UNVERIFIABLE');
    const wrongDate = selectedSnapshot();
    binding(wrongDate).serviceDate = '2026-10-11';
    expect(selectedFinding(wrongDate)?.code).toBe(
      'AGREEMENT_DATE_UNVERIFIABLE',
    );
  });
  it('keeps provider selections separate within the same operation and preserves the legacy excluded service evidence', () => {
    const data = selectedSnapshot();
    const transport = get(data, 'transport');
    const other = structuredClone(binding(data));
    other.invoiceDocumentId = transport.documentId;
    other.agreementVersionId = 'spot-v1';
    other.agreement.id = 'spot-v1';
    other.agreement.scope = 'spot';
    other.agreement.operationId = data.operationId ?? null;
    other.route = transport.route ?? '';
    other.agreement.terms.provider = 'Transport';
    other.agreement.terms.route = other.route;
    other.agreement.terms.service = 'pickup';
    other.agreement.terms.pricing = {
      type: 'fixed-trip',
      amount: '62',
      evidence: other.agreement.terms.evidence,
    };
    data.agreementBindings?.push(other);
    expect(
      evaluateLogistics(data).findings.filter(
        (item) => item.code === 'PRICE_MATCH',
      ),
    ).toHaveLength(2);
    expect(
      carrierFindings(snapshot()).some(
        (item) => item.code === 'EXCLUDED_SERVICE_OTHER_PROVIDER',
      ),
    ).toBe(true);
  });
  it('is immutable and deterministic with pinned terms', () => {
    const data = bandSnapshot('30');
    const before = JSON.stringify(data);
    expect(evaluateLogistics(data)).toEqual(evaluateLogistics(data));
    expect(JSON.stringify(data)).toBe(before);
  });
});

describe('reviewed agreement basis', () => {
  it.each(['internal-estimate', 'unknown'] as const)(
    'does not treat %s as supplier acceptance',
    (basis) => {
      const data = selectedSnapshot();
      binding(data).agreement.terms.agreementBasis = basis;
      expect(selectedFinding(data)).toMatchObject({
        code: 'AGREEMENT_BASIS_UNVERIFIABLE',
        status: 'not-verifiable',
        expected: null,
      });
    },
  );
  it('identifies published reviewed version in the finding evidence', () => {
    expect(
      selectedFinding(selectedSnapshot())?.evidence.find(
        (item) => item.documentId === 'annual',
      )?.revisionId,
    ).toBe('annual-v1');
  });
});

it('does not invent currency rounding or tolerance for a contractual rate', () => {
  const data = selectedSnapshot();
  const selected = binding(data);
  selected.distanceKm = '3';
  selected.agreement.terms.currency = 'EUR';
  selected.agreement.terms.pricing = {
    type: 'per-km',
    amount: '0.33333333',
    evidence: selected.agreement.terms.evidence,
  };
  const invoice = get(data, 'carrier');
  invoice.currency = 'EUR';
  invoice.total = '1';
  invoice.lines = [
    {
      ...line('handling', 'ocean-handling', '1'),
      unit: 'km',
      quantity: '3',
      unitPrice: '0.33333333',
    },
  ];
  const finding = carrierFindings(data).find(
    (item) => item.code === 'PRICE_OR_QUANTITY_DIFFERENCE',
  );
  expect(finding).toMatchObject({
    expected: '0.99999999',
    difference: '0.00000001',
    status: 'confirmed',
  });
});

describe('generic agreement applicability and economic evidence', () => {
  it('uses reusable quotation identity independently from operation reference', () => {
    const data = snapshot();
    const agreement = get(data, 'agreement');
    agreement.operationReference = null;
    agreement.agreementIdentity = 'Q2603BCN00826';
    expect(carrierFindings(data).some((f) => f.code === 'PRICE_MATCH')).toBe(
      true,
    );
  });
  it('keeps contradictory explicit agreement citation inapplicable', () => {
    const data = snapshot();
    get(data, 'carrier').references = [
      {
        type: 'quotation',
        value: 'Q2603BCN00826',
        evidence: source('carrier'),
      },
    ];
    get(data, 'agreement').lines[0]!.route = 'Port A to Warehouse A';
    expect(
      evaluateLogistics(data).agreementDecisions?.find(
        (d) => d.lineId === 'handling',
      )?.state,
    ).toBe('not-applicable');
  });
  it('does not use a booking number as an operation identity', () => {
    const data = snapshot();
    get(data, 'carrier').references = [
      { type: 'booking', value: 'BK-2', evidence: source('carrier') },
    ];
    expect(carrierFindings(data).some((f) => f.code === 'PRICE_MATCH')).toBe(
      true,
    );
    get(data, 'carrier').operationReference = 'OTHER';
    get(data, 'record').references = [
      { type: 'booking', value: 'BK-1', evidence: source('record') },
    ];
    expect(
      carrierFindings(data).some((f) => f.code === 'OPERATION_MISMATCH'),
    ).toBe(true);
  });
  it('keeps unknown required shipment date pending', () => {
    const data = snapshot();
    const agreement = get(data, 'agreement');
    agreement.applicability = { dateBasis: 'shipment-date', restrictions: [] };
    const result = evaluateLogistics(data);
    expect(
      result.agreementDecisions?.find((d) => d.lineId === 'handling')?.state,
    ).toBe('pending');
    expect(
      carrierFindings(data).some(
        (f) => f.status === 'confirmed' && f.expected !== null,
      ),
    ).toBe(false);
  });
  it('does not choose between two compatible agreements', () => {
    const data = snapshot();
    data.documents.push({ ...get(data, 'agreement'), documentId: 'second' });
    expect(
      carrierFindings(data).some((f) => f.code === 'AGREEMENT_AMBIGUOUS'),
    ).toBe(true);
  });
  it.each(['container', 'bl'] as const)(
    'uses operational %s quantity rather than quoted quantity',
    (basis) => {
      const data = snapshot();
      const invoice = get(data, 'carrier');
      const agreement = get(data, 'agreement');
      const billed = invoice.lines[0]!;
      const rate = agreement.lines[0]!;
      rate.billingBasis = basis;
      billed.billingBasis = basis;
      rate.description = billed.description;
      rate.quantity = '9';
      rate.unitPrice = '75';
      rate.equipmentType = basis === 'container' ? '40HC' : null;
      billed.equipmentType = '40HC';
      invoice.equipmentType = '40HC';
      invoice.equipmentQuantities = [
        { equipment: '40HC', quantity: '2', evidence: source('carrier') },
      ];
      invoice.blQuantity = '2';
      expect(
        carrierFindings(data).find((f) => f.lineId === 'handling')?.expected,
      ).toBe('150');
      if (basis === 'container') invoice.equipmentQuantities = [];
      else invoice.blQuantity = null;
      expect(
        carrierFindings(data).find((f) => f.lineId === 'handling')?.code,
      ).toBe('BILLING_QUANTITY_PENDING');
    },
  );
  it('keeps equipment mismatch and package inclusion non financial', () => {
    const data = snapshot();
    get(data, 'agreement').lines[0]!.equipmentType = '20STD';
    get(data, 'carrier').equipmentType = '40HC';
    expect(
      carrierFindings(data).find((f) => f.lineId === 'handling')?.expected,
    ).toBeNull();
    get(data, 'agreement').lines[0]!.equipmentType = null;
    get(data, 'agreement').lines[0]!.includedIn = 'lumpsum';
    expect(
      carrierFindings(data).find((f) => f.lineId === 'handling')?.code,
    ).toBe('INCLUDED_IN_PACKAGE');
  });
  it('preserves negative arithmetic without inferring credit semantics', () => {
    const data = snapshot();
    const invoice = get(data, 'carrier');
    invoice.lines[0]!.amount = '-150';
    invoice.lines[0]!.unitPrice = '-150';
    expect(
      carrierFindings(data).find(
        (f) => f.code === 'PRICE_OR_QUANTITY_DIFFERENCE',
      )?.difference,
    ).toBe('-300');
  });
});

it('keeps missing route pending rather than contradictory', () => {
  const data = snapshot();
  get(data, 'carrier').lines[0]!.route = null;
  expect(
    evaluateLogistics(data).agreementDecisions?.find(
      (d) => d.lineId === 'handling',
    )?.state,
  ).toBe('pending');
});

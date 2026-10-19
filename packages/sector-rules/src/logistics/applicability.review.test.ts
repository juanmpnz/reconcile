import { describe, expect, it } from 'vitest';
import type {
  AnalysisDocument,
  AnalysisEvidence,
  AnalysisLine,
  AnalysisSnapshot,
} from '@reconcile/domain';
import { evaluateLogistics } from './evaluate.js';

const source = (documentId: string): AnalysisEvidence[] => [
  {
    documentId,
    extractionRunId: `run-${documentId}`,
    revisionId: null,
    page: 1,
    snippet: 'DEMO independent review evidence',
  },
];
const charge = (
  id: string,
  billingBasis: 'container' | 'bl',
  amount: string,
): AnalysisLine => ({
  id,
  description: billingBasis === 'bl' ? 'Documentation' : 'Freight',
  service: 'ocean-handling',
  route: 'Valencia → Mundra',
  quantity: '1',
  unit: billingBasis,
  billingBasis,
  unitPrice: amount,
  amount,
  currency: 'USD',
  evidence: source(id),
});
function document(
  documentId: string,
  kind: AnalysisDocument['kind'],
): AnalysisDocument {
  return {
    documentId,
    kind,
    extractionRunId: `run-${documentId}`,
    revisionId: null,
    provider: 'DEMO Carrier',
    operationReference: 'OP-1',
    currency: 'USD',
    total: null,
    taxAmount: null,
    serviceDate: '2026-06-01',
    serviceReference: null,
    route: 'Valencia → Mundra',
    validFrom: '2026-04-01',
    validUntil: '2026-12-31',
    agreementBasis: 'accepted',
    excludedServices: [],
    assignedProvider: null,
    performedProvider: null,
    serviceStatus: 'unknown',
    lines: [],
    evidence: source(documentId),
    warnings: [],
  };
}
function setup(): AnalysisSnapshot {
  const invoice = document('invoice', 'invoice');
  invoice.lines = [
    charge('invoice-freight', 'container', '100'),
    charge('invoice-bl', 'bl', '20'),
  ];
  invoice.equipmentType = '40HC';
  invoice.equipmentQuantities = [
    { equipment: '40HC', quantity: '1', evidence: source('invoice') },
  ];
  invoice.blQuantity = '1';
  const agreement = document('agreement', 'agreement');
  agreement.operationReference = null;
  agreement.agreementIdentity = 'Q2603BCN00826';
  agreement.lines = [
    charge('tariff-freight', 'container', '100'),
    charge('tariff-bl', 'bl', '20'),
  ];
  return {
    organizationId: 'tenant-demo',
    operationReference: 'OP-1',
    documents: [invoice, agreement],
  };
}
function get(snapshot: AnalysisSnapshot, kind: AnalysisDocument['kind']) {
  const item = snapshot.documents.find((doc) => doc.kind === kind);
  if (!item) throw new Error('Missing fixture');
  return item;
}
describe('independent agreement applicability acceptance', () => {
  it('compares distinct BL and container concepts independently in one reusable agreement', () => {
    const result = evaluateLogistics(setup());
    expect(
      result.findings.filter((finding) => finding.code === 'PRICE_MATCH'),
    ).toHaveLength(2);
    expect(
      result.findings.filter((finding) => finding.status === 'confirmed'),
    ).toHaveLength(0);
  });
  it('does not accept an invoice with an explicitly contradictory booking', () => {
    const input = setup();
    const invoice = get(input, 'invoice');
    invoice.operationReference = null;
    invoice.references = [
      { type: 'booking', value: 'OTHER-BOOKING', evidence: source('invoice') },
    ];
    const record = document('booking', 'operational-record');
    record.references = [
      { type: 'booking', value: 'THIS-BOOKING', evidence: source('booking') },
    ];
    input.documents.push(record);
    const result = evaluateLogistics(input);
    expect(
      result.findings.some(
        (finding) =>
          finding.documentId === 'invoice' && finding.code === 'PRICE_MATCH',
      ),
    ).toBe(false);
    expect(
      result.findings.some(
        (finding) =>
          finding.documentId === 'invoice' &&
          /REFERENCE|OPERATION/.test(finding.code),
      ),
    ).toBe(true);
  });
  it('does not convert a missing operational identity into a verified charge', () => {
    const input = setup();
    const invoice = get(input, 'invoice');
    invoice.operationReference = null;
    invoice.lines = [charge('one', 'bl', '20')];
    get(input, 'agreement').lines = [charge('one-rate', 'bl', '20')];
    const result = evaluateLogistics(input);
    expect(
      result.findings.some((finding) => finding.code === 'PRICE_MATCH'),
    ).toBe(false);
    expect(
      result.findings.some((finding) => finding.status === 'not-verifiable'),
    ).toBe(true);
  });
});

it('keeps selected agreement applicability consistent with an incompatible contractual service', () => {
  const input = setup();
  const invoice = get(input, 'invoice');
  input.documents = [invoice];
  const evidence = source('published');
  input.agreementBindings = [
    {
      invoiceDocumentId: invoice.documentId,
      agreementVersionId: 'published-v1',
      serviceDate: '2026-06-01',
      route: 'Valencia → Mundra',
      distanceKm: null,
      agreement: {
        id: 'published-v1',
        organizationId: input.organizationId,
        scope: 'reusable',
        operationId: null,
        sourceDocumentId: 'published',
        sourceExtractionRunId: 'run-published',
        terms: {
          agreementBasis: 'accepted',
          provider: 'DEMO Carrier',
          currency: 'USD',
          validFrom: '2026-04-01',
          validUntil: '2026-12-31',
          route: 'Valencia → Mundra',
          service: 'pickup',
          pricing: { type: 'fixed-trip', amount: '100', evidence },
          evidence,
        },
      },
    },
  ];
  const result = evaluateLogistics(input);
  expect(
    result.findings.some(
      (finding) => finding.code === 'AGREEMENT_SCOPE_MISMATCH',
    ),
  ).toBe(true);
  expect(
    result.agreementDecisions?.every(
      (decision) => decision.state === 'not-applicable',
    ),
  ).toBe(true);
});

it.each([
  ['2026-06-01', 'Valencia', 'Mundra', 'applicable'],
  ['2027-01-01', 'Valencia', 'Mundra', 'not-applicable'],
  [null, 'Valencia', 'Mundra', 'pending'],
  ['2026-06-01', 'Mundra', 'Valencia', 'not-applicable'],
] as const)(
  'evaluates explicit directional conditions and shipment date %s (%s → %s)',
  (shipmentDate, origin, destination, expected) => {
    const input = setup();
    const invoice = get(input, 'invoice');
    invoice.shipmentDate = shipmentDate;
    invoice.origin = origin;
    invoice.destination = destination;
    const agreement = get(input, 'agreement');
    const restricted = (value: string) => ({
      state: 'restricted' as const,
      value,
      evidence: source('agreement'),
    });
    const unrestricted = {
      state: 'unrestricted' as const,
      value: null,
      evidence: source('agreement'),
    };
    agreement.applicability = {
      provider: restricted('DEMO Carrier'),
      contractingParty: unrestricted,
      origin: restricted('Valencia'),
      destination: restricted('Mundra'),
      service: restricted('ocean-handling'),
      transportMode: unrestricted,
      equipmentType: unrestricted,
      dateBasis: 'shipment-date',
      restrictions: [],
    };
    const result = evaluateLogistics(input);
    expect(
      result.agreementDecisions?.every(
        (decision) => decision.state === expected,
      ),
    ).toBe(true);
    if (expected !== 'applicable')
      expect(
        result.findings.some(
          (finding) =>
            finding.code === 'PRICE_MATCH' ||
            finding.code === 'PRICE_OR_QUANTITY_DIFFERENCE',
        ),
      ).toBe(false);
  },
);

it('keeps a missing invoice route pending rather than contradictory', () => {
  const input = setup();
  get(input, 'invoice').lines = [charge('missing-route', 'bl', '20')];
  const invoiceLine = get(input, 'invoice').lines[0];
  if (!invoiceLine) throw new Error('Missing fixture line');
  invoiceLine.route = null;
  const result = evaluateLogistics(input);
  expect(
    result.agreementDecisions?.every(
      (decision) => decision.state === 'pending',
    ),
  ).toBe(true);
});

it.each(['container', 'bl'] as const)(
  'uses corroborated %s counts and retains conflicting count uncertainty',
  (basis) => {
    const input = setup();
    const invoice = get(input, 'invoice');
    invoice.lines = [charge('count', basis, '20')];
    get(input, 'agreement').lines = [charge('count-rate', basis, '20')];
    const record = document('count-record', 'operational-record');
    record.blQuantity = '1';
    record.equipmentQuantities = [
      { equipment: '40HC', quantity: '1', evidence: source(record.documentId) },
    ];
    input.documents.push(record);
    expect(
      evaluateLogistics(input).findings.some(
        (finding) => finding.code === 'PRICE_MATCH',
      ),
    ).toBe(true);
    record.blQuantity = '2';
    record.equipmentQuantities = [
      { equipment: '40HC', quantity: '2', evidence: source(record.documentId) },
    ];
    const result = evaluateLogistics(input);
    expect(
      result.findings.some(
        (finding) =>
          finding.code === 'PRICE_MATCH' ||
          finding.code === 'PRICE_OR_QUANTITY_DIFFERENCE',
      ),
    ).toBe(false);
    expect(
      result.findings.some(
        (finding) => finding.code === 'BILLING_QUANTITY_PENDING',
      ),
    ).toBe(true);
  },
);

it('retains explicit operational restrictions when a published agreement is selected', () => {
  const input = setup();
  const invoice = get(input, 'invoice');
  invoice.references = [
    { type: 'booking', value: 'ACTUAL-BOOKING', evidence: source('invoice') },
  ];
  const agreement = get(input, 'agreement');
  input.documents = [invoice];
  const evidence = source('published');
  input.agreementBindings = [
    {
      invoiceDocumentId: invoice.documentId,
      agreementVersionId: 'published-v1',
      serviceDate: '2026-06-01',
      route: invoice.route,
      distanceKm: null,
      agreement: {
        id: 'published-v1',
        organizationId: input.organizationId,
        scope: 'reusable',
        operationId: null,
        sourceDocumentId: 'published',
        sourceExtractionRunId: 'run-published',
        terms: {
          agreementBasis: 'accepted',
          provider: 'DEMO Carrier',
          currency: 'USD',
          validFrom: '2026-04-01',
          validUntil: '2026-12-31',
          route: 'Valencia → Mundra',
          service: 'ocean-handling',
          lines: agreement.lines,
          references: [
            { type: 'booking', value: 'DIFFERENT-BOOKING', evidence },
          ],
          pricing: { type: 'fixed-trip', amount: '100', evidence },
          evidence,
        },
      },
    },
  ];
  const result = evaluateLogistics(input);
  expect(
    result.agreementDecisions?.every(
      (decision) => decision.state === 'not-applicable',
    ),
  ).toBe(true);
  expect(
    result.findings.some(
      (finding) =>
        finding.code === 'PRICE_MATCH' ||
        finding.code === 'PRICE_OR_QUANTITY_DIFFERENCE',
    ),
  ).toBe(false);
});

it('uses equipment and actual quantity evidenced only by the linked operation record', () => {
  const input = setup();
  const invoice = get(input, 'invoice');
  invoice.equipmentType = null;
  invoice.equipmentQuantities = [];
  invoice.lines = [charge('booking-equipment', 'container', '20')];
  const agreement = get(input, 'agreement');
  agreement.lines = [
    { ...charge('booking-rate', 'container', '20'), equipmentType: '40HC' },
  ];
  const record = document('equipment-record', 'operational-record');
  record.equipmentType = '40HC';
  record.equipmentQuantities = [
    { equipment: '40HC', quantity: '1', evidence: source(record.documentId) },
  ];
  input.documents.push(record);
  expect(
    evaluateLogistics(input).findings.some(
      (finding) => finding.code === 'PRICE_MATCH',
    ),
  ).toBe(true);
});

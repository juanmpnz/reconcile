export type ApplicabilityCondition = {
  state: 'restricted' | 'unrestricted' | 'unknown';
  value: string | null;
  evidence: AnalysisEvidence[];
};
export type AgreementApplicability = {
  provider?: ApplicabilityCondition | undefined;
  contractingParty?: ApplicabilityCondition | undefined;
  origin?: ApplicabilityCondition | undefined;
  destination?: ApplicabilityCondition | undefined;
  service?: ApplicabilityCondition | undefined;
  transportMode?: ApplicabilityCondition | undefined;
  equipmentType?: ApplicabilityCondition | undefined;
  dateBasis:
    | 'service-date'
    | 'shipment-date'
    | 'booking-date'
    | 'invoice-date'
    | 'unknown';
  restrictions: Array<ApplicabilityCondition & { name: string }>;
};
export type AgreementDecision = {
  invoiceDocumentId: string;
  lineId: string;
  agreementDocumentId: string;
  agreementVersionId: string | null;
  state: 'applicable' | 'pending' | 'not-applicable';
  reason: string;
  conditions: Array<{
    name: string;
    state: 'verified' | 'unknown' | 'contradictory' | 'unrestricted';
    reason: string;
    evidence: AnalysisEvidence[];
  }>;
  evidence: AnalysisEvidence[];
};
/** Versioned, transport-independent facts. Null means unknown, never a wildcard. */
export type AnalysisEvidence = {
  documentId: string;
  extractionRunId: string;
  page: number;
  snippet: string;
  revisionId: string | null;
};
export type AnalysisLine = {
  pricingTerms?:
    | {
        behavior: 'fixed' | 'variable' | 'unknown';
        cadence: 'per-unit' | 'monthly' | 'annual' | 'unknown';
        dateBasis?:
          | 'service-date'
          | 'shipment-date'
          | 'booking-date'
          | 'invoice-date'
          | 'unknown'
          | undefined;
        validFrom: string | null;
        validUntil: string | null;
        evidence: AnalysisEvidence[];
      }
    | undefined;
  chargeKey?: string | null | undefined;
  tariffUnitPrice?: string | null | undefined;
  tariffCurrency?: string | null | undefined;
  currency?: string | null | undefined;
  equipmentType?: string | null | undefined;
  billingBasis?:
    'container' | 'bl' | 'shipment' | 'other' | 'unknown' | undefined;
  includedIn?: string | null | undefined;

  id: string;
  description: string;
  service: 'ocean-handling' | 'pickup' | 'unknown';
  route: string | null;
  quantity: string | null;
  unit: string | null;
  unitPrice: string | null;
  amount: string | null;
  evidence: AnalysisEvidence[];
};
export type AnalysisDocument = {
  billingPeriod?:
    { from: string; to: string; evidence: AnalysisEvidence[] } | undefined;
  exchangeRates?:
    | Array<{
        from: string;
        to: string;
        rate: string;
        evidence: AnalysisEvidence[];
      }>
    | undefined;
  references?:
    | Array<{
        type:
          | 'operation'
          | 'shipment'
          | 'booking'
          | 'bl'
          | 'agreement'
          | 'quotation';
        value: string;
        evidence: AnalysisEvidence[];
      }>
    | undefined;
  agreementIdentity?: string | null | undefined;
  applicability?: AgreementApplicability | undefined;
  origin?: string | null | undefined;
  destination?: string | null | undefined;
  transportMode?: string | null | undefined;
  equipmentType?: string | null | undefined;
  contractingParty?: string | null | undefined;
  shipmentDate?: string | null | undefined;
  bookingDate?: string | null | undefined;
  invoiceDate?: string | null | undefined;
  equipmentQuantities?:
    | Array<{
        equipment: string;
        quantity: string | null;
        evidence: AnalysisEvidence[];
      }>
    | undefined;
  blQuantity?: string | null | undefined;
  shipmentQuantity?: string | null | undefined;

  documentId: string;
  extractionRunId: string;
  revisionId: string | null;
  kind: 'invoice' | 'agreement' | 'operational-record';
  provider: string | null;
  operationReference: string | null;
  currency: string | null;
  total: string | null;
  taxAmount: string | null;
  serviceDate: string | null;
  serviceReference: string | null;
  route: string | null;
  validFrom: string | null;
  validUntil: string | null;
  agreementBasis: 'accepted' | 'internal-estimate' | 'unknown';
  excludedServices: Array<{
    service: 'ocean-handling' | 'pickup' | 'unknown';
    route: string | null;
    evidence: AnalysisEvidence[];
  }>;
  assignedProvider: string | null;
  performedProvider: string | null;
  serviceStatus: 'completed' | 'unknown';
  lines: AnalysisLine[];
  evidence: AnalysisEvidence[];
  warnings: string[];
};
/** Reviewed terms preserve original PDF provenance; bands are [fromKm, toKm). */
export type AgreementSourceEvidence = Omit<AnalysisEvidence, 'revisionId'>;
export type AnalysisAgreementBand = {
  fromKm: string;
  toKm: string;
  basis: 'fixed-trip' | 'per-km';
  amount: string;
  evidence: AgreementSourceEvidence[];
};
export type AnalysisAgreementPricing =
  | { type: 'line-items' }
  | {
      type: 'fixed-trip' | 'per-km';
      amount: string;
      evidence: AgreementSourceEvidence[];
    }
  | { type: 'distance-bands'; bands: AnalysisAgreementBand[] };
export type AnalysisAgreementTerms = {
  references?: AnalysisDocument['references'];
  applicability?: AgreementApplicability | undefined;
  agreementIdentity?: string | null | undefined;
  lines?: AnalysisLine[] | undefined;
  agreementBasis: 'accepted' | 'internal-estimate' | 'unknown';
  provider: string;
  currency: string | null;
  validFrom: string;
  validUntil: string;
  route: string;
  service: 'ocean-handling' | 'pickup';
  pricing: AnalysisAgreementPricing;
  evidence: AgreementSourceEvidence[];
};
export type AnalysisAgreementVersion = {
  id: string;
  organizationId: string;
  scope: 'reusable' | 'spot';
  operationId: string | null;
  sourceDocumentId: string;
  sourceExtractionRunId: string;
  terms: AnalysisAgreementTerms;
};
export type AnalysisAgreementBinding = {
  invoiceDocumentId: string;
  agreementVersionId: string;
  serviceDate: string | null;
  route: string | null;
  selectedBy?: string | null | undefined;
  selectedAt?: string | null | undefined;
  selectionReason?: string | null | undefined;
  distanceKm: string | null;
  agreement: AnalysisAgreementVersion;
};
export type AnalysisSnapshot = {
  organizationId: string;
  operationId?: string | undefined;
  agreementBindings?: AnalysisAgreementBinding[] | undefined;
  operationReference: string;
  documents: AnalysisDocument[];
};
export type AnalysisFinding = {
  documentId: string | null;
  lineId: string | null;
  service: string;
  status: 'confirmed' | 'probable' | 'not-verifiable' | 'matched';
  code: string;
  expected: string | null;
  invoiced: string | null;
  difference: string | null;
  currency: string | null;
  explanation: string;
  evidence: AnalysisEvidence[];
};
export type AnalysisResult = {
  comparisonCandidates?: ComparisonCandidate[] | undefined;
  agreementDecisions?: AgreementDecision[] | undefined;
  ruleVersion: string;
  findings: AnalysisFinding[];
};

/** Source-price observations remain separate from claimable findings. */
export type ComparisonCandidate = {
  invoiceDocumentId: string;
  lineId: string;
  referenceDocumentId: string | null;
  referenceLineId: string | null;
  concept: string | null;
  invoiceConcept: string;
  referenceConcept: string | null;
  status: 'correct' | 'difference' | 'pending';
  priceStatus: 'equal' | 'different' | 'unknown';
  claimable: false;
  aliasVersion: string;
  quantity: string | null;
  currency: string | null;
  expectedCurrency: string | null;
  actualCurrency: string | null;
  expectedUnitPrice: string | null;
  actualUnitPrice: string | null;
  expectedAmount: string | null;
  actualAmount: string | null;
  difference: string | null;
  conditions: AgreementDecision['conditions'];
  reasons: string[];
  calculation: string | null;
  evidence: AnalysisEvidence[];
};

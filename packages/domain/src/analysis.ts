/** Versioned, transport-independent facts. Null means unknown, never a wildcard. */
export type AnalysisEvidence = {
  documentId: string;
  extractionRunId: string;
  page: number;
  snippet: string;
  revisionId: string | null;
};
export type AnalysisLine = {
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
  | {
      type: 'fixed-trip' | 'per-km';
      amount: string;
      evidence: AgreementSourceEvidence[];
    }
  | { type: 'distance-bands'; bands: AnalysisAgreementBand[] };
export type AnalysisAgreementTerms = {
  agreementBasis: 'accepted' | 'internal-estimate' | 'unknown';
  provider: string;
  currency: string;
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
  serviceDate: string;
  route: string;
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
  ruleVersion: string;
  findings: AnalysisFinding[];
};

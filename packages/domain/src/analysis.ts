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
export type AnalysisSnapshot = {
  organizationId: string;
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

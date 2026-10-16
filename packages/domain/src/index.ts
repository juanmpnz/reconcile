import { Decimal } from 'decimal.js';
// Monetary values cross transport boundaries as decimal strings, never JSON numbers.
export function subtractAmounts(invoiced: string, expected: string): string {
  const decimalPattern = /^-?\d+(?:\.\d+)?$/;
  if (!decimalPattern.test(invoiced) || !decimalPattern.test(expected)) {
    throw new Error('Amounts must be finite decimal strings');
  }
  // Preserve sufficient precision for both operands, including fractional scale.
  const Arithmetic = Decimal.clone({
    precision: Math.max(40, invoiced.length + expected.length + 2),
  });
  return new Arithmetic(invoiced).minus(expected).toFixed();
}

export type {
  AgreementSourceEvidence,
  AnalysisAgreementBand,
  AnalysisAgreementPricing,
  AnalysisAgreementTerms,
  AnalysisAgreementVersion,
  AnalysisAgreementBinding,
  AnalysisEvidence,
  AnalysisLine,
  AnalysisDocument,
  AnalysisSnapshot,
  AnalysisFinding,
  AnalysisResult,
} from './analysis.js';

import type { AnalysisRun, ClaimDetail } from '@reconcile/contracts';
type Finding = NonNullable<AnalysisRun['result']>['findings'][number];
export function latestDraft(claim: Pick<ClaimDetail, 'drafts'>) {
  return claim.drafts.toSorted((a, b) => b.version - a.version)[0];
}
export function claimEligibility(finding: Finding, run: AnalysisRun) {
  if (run.stale || run.status !== 'completed')
    return {
      eligible: false,
      reason: 'Análisis histórico o incompleto: revisá los datos actuales.',
    };
  const source = run.snapshot.documents.find(
    (item) => item.documentId === finding.documentId,
  );
  if (!source || source.kind !== 'invoice')
    return {
      eligible: false,
      reason:
        'El hallazgo no procede de una factura; no permite preparar un reclamo.',
    };
  if (finding.status === 'matched')
    return { eligible: false, reason: 'La coincidencia no genera un reclamo.' };
  if (
    ['LINE_ARITHMETIC', 'TOTAL_INCONSISTENT', 'TAX_UNVERIFIABLE'].includes(
      finding.code,
    )
  )
    return {
      eligible: false,
      reason:
        'Este control no genera un importe reclamable ni una solicitud de aclaración.',
    };
  if (finding.status === 'probable' || finding.status === 'not-verifiable')
    return {
      eligible: true,
      reason: 'Solicitud de aclaración sin importe solicitado.',
    };
  const positive =
    finding.difference !== null &&
    /^\d+(?:\.\d+)?$/.test(finding.difference) &&
    /[1-9]/.test(finding.difference);
  if (
    finding.status === 'confirmed' &&
    [
      'EXCLUDED_SERVICE',
      'EXCLUDED_SERVICE_OTHER_PROVIDER',
      'PRICE_OR_QUANTITY_DIFFERENCE',
    ].includes(finding.code) &&
    positive &&
    finding.currency &&
    source?.provider
  )
    return {
      eligible: true,
      reason: 'Solicitud de corrección respaldada por el análisis.',
    };
  return {
    eligible: false,
    reason:
      'Faltan un importe positivo verificable, proveedor, moneda o un control compatible.',
  };
}
export function localCalendarDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function followUpSummary(
  claims: { dueDate: string | null; status: string }[],
  today = localCalendarDate(),
) {
  const dates = claims
    .filter((item) => item.status !== 'resolved' && item.status !== 'rejected')
    .flatMap((item) => (item.dueDate ? [item.dueDate] : []))
    .sort();
  return {
    overdue: dates.filter((date) => date < today).length,
    next: dates.find((date) => date >= today) ?? null,
  };
}

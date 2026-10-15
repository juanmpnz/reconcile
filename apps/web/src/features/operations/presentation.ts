import type { AnalysisRun } from '@reconcile/contracts';
type Finding = NonNullable<AnalysisRun['result']>['findings'][number];
export function findingCounts(findings: Finding[]) {
  return findings.reduce(
    (counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }),
    { confirmed: 0, probable: 0, 'not-verifiable': 0, matched: 0 },
  );
}
export function findingGroup(code: string) {
  return code === 'LINE_ARITHMETIC' || code === 'TOTAL_INCONSISTENT'
    ? 'arithmetic'
    : 'service';
}
export const outcomeLabels = {
  confirmed: 'Diferencia respaldada por evidencia',
  probable: 'Posible diferencia',
  'not-verifiable': 'No verificable',
  matched: 'Sin diferencia de precio detectada',
};
export const outcomeIcons = {
  confirmed: '!',
  probable: '?',
  'not-verifiable': '?',
  matched: '✓',
};
export function observedMissingFacts(finding: Finding, run: AnalysisRun) {
  if (finding.code !== 'AGREEMENT_MISSING') return [];
  const invoice = run.snapshot.documents.find(
    (document) => document.documentId === finding.documentId,
  );
  const line = invoice?.lines.find((item) => item.id === finding.lineId);
  return line && !line.route
    ? ['Falta la ruta o el ámbito de esta partida para comprobar el acuerdo.']
    : [];
}

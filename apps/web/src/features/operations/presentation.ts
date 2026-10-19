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

export function invoiceFindings(run: {
  snapshot: {
    documents: Pick<
      AnalysisRun['snapshot']['documents'][number],
      'documentId' | 'kind'
    >[];
  };
  result?: { findings: Finding[] } | null;
}) {
  const invoiceIds = new Set(
    run.snapshot.documents
      .filter((document) => document.kind === 'invoice')
      .map((document) => document.documentId),
  );
  return (
    run.result?.findings.filter(
      (finding) =>
        finding.documentId !== null && invoiceIds.has(finding.documentId),
    ) ?? []
  );
}

export function applicabilityEmptyMessage(
  decisions: NonNullable<AnalysisRun['result']>['agreementDecisions'],
) {
  return decisions === undefined
    ? 'Este resultado no incluye el detalle estructurado de aplicabilidad. Esto no permite determinar su antigüedad. Revisá los motivos del análisis o ejecutá uno nuevo.'
    : 'No se evaluaron acuerdos para ninguna partida. Revisá los datos extraídos de las facturas, los acuerdos disponibles y los motivos del análisis; no se ha confirmado su aplicabilidad.';
}

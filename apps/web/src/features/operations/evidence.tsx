import { Accordion, AccordionTrigger } from '../../design-system/layout';
import type { AnalysisRun } from '@reconcile/contracts';
import { documentPath } from '../documents/api';
type Evidence = NonNullable<
  AnalysisRun['result']
>['findings'][number]['evidence'][number];
export function groupEvidence(evidence: Evidence[]) {
  const seen = new Set<string>();
  const groups = new Map<string, Evidence[]>();
  for (const item of evidence) {
    const key = JSON.stringify([
      item.documentId,
      item.extractionRunId,
      item.revisionId,
      item.page,
      item.snippet,
    ]);
    if (seen.has(key)) continue;
    seen.add(key);
    const group = groups.get(item.documentId) ?? [];
    group.push(item);
    groups.set(item.documentId, group);
  }
  return [...groups.entries()].map(([documentId, items]) => ({
    documentId,
    items,
  }));
}
export function EvidenceList({
  evidence,
  filenames,
  organizationId,
}: {
  evidence: Evidence[];
  filenames: ReadonlyMap<string, string>;
  organizationId: string;
}) {
  const groups = groupEvidence(evidence);
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  if (!count) return <span>Sin evidencia disponible</span>;
  const citations = groups.flatMap((group) => group.items);
  const preview = citations.slice(0, 2);
  const remaining = citations.slice(2);
  function render(items: Evidence[]) {
    return groupEvidence(items).map((group) => (
      <div className="evidence-group" key={group.documentId}>
        <a href={documentPath(organizationId, group.documentId)}>
          {filenames.get(group.documentId) ?? 'Documento original'}
        </a>
        {group.items.map((item, index) => (
          <Accordion className="source-evidence" key={index}>
            <AccordionTrigger>
              Página {item.page} · Leer fragmento completo
            </AccordionTrigger>
            <p>{item.snippet}</p>
          </Accordion>
        ))}
      </div>
    ));
  }
  return (
    <div className="finding-evidence">
      <span className="metadata">Evidencias del hallazgo ({count})</span>
      {render(preview)}
      {remaining.length > 0 && (
        <Accordion>
          <AccordionTrigger>
            Ver {remaining.length} evidencias más
          </AccordionTrigger>
          {render(remaining)}
        </Accordion>
      )}
    </div>
  );
}

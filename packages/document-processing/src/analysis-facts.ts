import {
  analysisDocumentSchema,
  type AnalysisDocumentInput,
  type ExtractionResult,
  type DocumentKind,
} from '@reconcile/contracts';
/** Bounded label/table adapter. Unknown layouts remain missing, never inferred from totals. */
export function deriveAnalysisFacts(input: {
  documentId: string;
  extractionRunId: string;
  kind: DocumentKind;
  result: ExtractionResult;
  corrections: { id: string; field: string; value: string | null }[];
}): AnalysisDocumentInput {
  const { documentId, extractionRunId, result } = input;
  const evidence: AnalysisDocumentInput['evidence'] = [];
  const lines: AnalysisDocumentInput['lines'] = [];
  const excludedServices: AnalysisDocumentInput['excludedServices'] = [];
  const values = new Map(result.fields.map((f) => [f.name as string, f.value]));
  for (const c of input.corrections) values.set(c.field, c.value);
  const ev = (page: number, snippet: string) => ({
    documentId,
    extractionRunId,
    page,
    snippet: snippet.slice(0, 500),
    revisionId: null,
  });
  const label = (pattern: string): string | null => {
    const matches: { value: string; page: number; snippet: string }[] = [];
    for (const p of result.pages)
      for (const line of p.text.split('\n')) {
        const m = line
          .trim()
          .match(new RegExp('^(?:' + pattern + '):\\s*(.+)$', 'i'));
        if (m?.[1])
          matches.push({
            value: m[1].trim(),
            page: p.page,
            snippet: line.trim(),
          });
      }
    if (new Set(matches.map((m) => m.value)).size !== 1) return null;
    const m = matches[0];
    if (!m) return null;
    evidence.push(ev(m.page, m.snippet));
    return m.value;
  };
  const currency = values.get('currency')?.match(/^[A-Z]{3}$/)?.[0] ?? null;
  const total = values.get('total')?.match(/^-?\d+(?:\.\d+)?$/)?.[0] ?? null;
  let route = label('Route');
  const scopes: string[] = [];
  const bases = new Set<string>();
  const parserWarnings: string[] = [];
  let agreementBasis: AnalysisDocumentInput['agreementBasis'] = 'unknown';
  for (const p of result.pages)
    for (const raw of p.text.split('\n')) {
      const text = raw.trim();
      if (
        /^(?:Demo )?agreement accepted \d{4}-\d{2}-\d{2}\. (?:Not an internal estimate\.)?$/i.test(
          text,
        )
      ) {
        agreementBasis = 'accepted';
        bases.add('accepted');
        evidence.push(ev(p.page, text));
      }
      if (
        /internal estimate/i.test(text) &&
        !/not an internal estimate/i.test(text)
      ) {
        agreementBasis = 'internal-estimate';
        bases.add('internal-estimate');
        evidence.push(ev(p.page, text));
      }
      const excluded = text.match(/^Excludes pickup\s+(.+?);/i);
      if (excluded?.[1])
        excludedServices.push({
          service: 'pickup',
          route: excluded[1],
          evidence: [ev(p.page, text)],
        });
      const table = text.match(
        /^(Ocean\s+handling|Pickup\s*-\s*(.+?))\s+(\d+(?:\.\d+)?)\s+(service|trip|km)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/i,
      );
      if (table) {
        lines.push({
          id: 'line-' + (lines.length + 1),
          description: (table[1] ?? text).replace(/\s+/g, ' '),
          service: /^Pickup/i.test(text) ? 'pickup' : 'ocean-handling',
          route: table[2]?.replace(/\s+/g, ' ') ?? null,
          quantity: table[3] ?? null,
          unit: table[4]?.toLowerCase() ?? null,
          unitPrice: table[5] ?? null,
          amount: table[6] ?? null,
          evidence: [ev(p.page, text)],
        });
      }
      const agreement = text.match(
        /^Ocean handling:\s*(\d+(?:\.\d+)?)\s+service at\s+(\d+(?:\.\d+)?)\s+([A-Z]{3})\.?$/i,
      );
      if (agreement && agreement[3] !== currency)
        parserWarnings.push('LINE_CURRENCY_CONFLICT');
      if (agreement && agreement[3] === currency)
        lines.push({
          id: 'line-' + (lines.length + 1),
          description: 'Ocean handling',
          service: 'ocean-handling',
          route: null,
          quantity: agreement[1] ?? null,
          unit: 'service',
          unitPrice: agreement[2] ?? null,
          amount: agreement[1] === '1' ? (agreement[2] ?? null) : null,
          evidence: [ev(p.page, text)],
        });
      const scope = text.match(/^Scope:\s*(.+?) handling for /i);
      if (scope?.[1]) {
        scopes.push(scope[1]);
        evidence.push(ev(p.page, text));
      }
    }
  if (
    new Set(scopes).size > 1 ||
    (route !== null && scopes.length > 0 && scopes.some((s) => s !== route))
  ) {
    route = null;
    parserWarnings.push('AMBIGUOUS_SCOPE');
  } else if (scopes[0]) route = scopes[0];
  if (bases.size > 1) {
    agreementBasis = 'unknown';
    parserWarnings.push('AMBIGUOUS_AGREEMENT_BASIS');
  }
  for (const line of lines)
    if (line.service === 'ocean-handling' && line.route === null)
      line.route = route;
  const taxLabel = label('Tax amount');
  const taxMatch = taxLabel?.match(
    /^(\d+(?:\.\d+)?) ([A-Z]{3})(?: \(synthetic scenario assumption\))?$/,
  );
  const tax = taxMatch?.[2] === currency ? (taxMatch?.[1] ?? null) : null;
  if (taxMatch && taxMatch[2] !== currency)
    parserWarnings.push('TAX_CURRENCY_CONFLICT');
  const date = (value: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
      ? value
      : null;
  };
  const serviceDate = date(label('Service date'));
  const serviceReference = label('Service reference');
  const assignedProvider = label('Assigned provider');
  const performedProvider = label('Recorded performed by');
  const status = label('Status');
  for (const f of result.fields)
    if (f.evidence) evidence.push(ev(f.evidence.page, f.evidence.snippet));
  for (const c of input.corrections) {
    const original = result.fields.find((f) => f.name === c.field)?.evidence;
    if (original)
      evidence.push({
        ...ev(original.page, original.snippet),
        revisionId: c.id,
      });
  }
  return analysisDocumentSchema.parse({
    documentId,
    extractionRunId,
    revisionId: null,
    kind:
      input.kind === 'invoice'
        ? 'invoice'
        : input.kind === 'operational'
          ? 'operational-record'
          : 'agreement',
    provider: values.get('provider') ?? null,
    operationReference: values.get('operationReference') ?? null,
    currency,
    total,
    taxAmount: tax,
    serviceDate,
    serviceReference,
    route,
    validFrom: date(label('Valid from')),
    validUntil: date(label('Valid until')),
    agreementBasis,
    excludedServices,
    assignedProvider,
    performedProvider,
    serviceStatus: status?.match(/^Completed(?:\s|$)/i)
      ? 'completed'
      : 'unknown',
    lines,
    evidence,
    warnings: [
      'LABEL_BASED_EXTRACTION',
      'HUMAN_REVIEW_REQUIRED',
      ...parserWarnings,
      ...(lines.length === 0 && input.kind === 'invoice'
        ? ['LINE_ITEMS_MISSING']
        : []),
    ],
  });
}

import {
  analysisDocumentSchema,
  type AnalysisDocumentInput,
  type ExtractionResult,
  type DocumentKind,
} from '@reconcile/contracts';
import { commercialFacts } from './commercial-tables.js';
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
  const commercial = commercialFacts(result, ev);
  lines.push(...commercial.lines);
  evidence.push(...commercial.metadataEvidence.route);
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
  let route = label('Route') ?? commercial.route;
  const scopes: string[] = [];
  const bases = new Set<string>();
  const parserWarnings: string[] = [...commercial.warnings];
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
        /^(Ocean\s+handling|Pickup\s*-\s*(.+?))\s+(-?\d+(?:\.\d+)?)\s+(service|trip|km)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/i,
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
        /^Ocean handling:\s*(-?\d+(?:\.\d+)?)\s+service at\s+(-?\d+(?:\.\d+)?)\s+([A-Z]{3})\.?$/i,
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
      // Explicit semicolon-delimited rows avoid guessing column associations in matrices.
      const charge = text.match(
        /^Charge:\s*([^;]+);\s*(ocean-handling|pickup|unknown);\s*(container|bl|shipment|other);\s*([^;]+);\s*(-?\d+(?:\.\d+)?);\s*(-?\d+(?:\.\d+)?);\s*(-?\d+(?:\.\d+)?);\s*([A-Z]{3});\s*([^;]+)$/,
      );
      if (charge) {
        const service = charge[2];
        const billingBasis = charge[3];
        if (
          (service === 'ocean-handling' ||
            service === 'pickup' ||
            service === 'unknown') &&
          (billingBasis === 'container' ||
            billingBasis === 'bl' ||
            billingBasis === 'shipment' ||
            billingBasis === 'other')
        )
          lines.push({
            id: 'line-' + (lines.length + 1),
            description: charge[1]?.trim() ?? text,
            service,
            route,
            quantity: charge[5] ?? null,
            unit: billingBasis,
            unitPrice: charge[6] ?? null,
            amount: charge[7] ?? null,
            currency: charge[8] ?? null,
            billingBasis,
            equipmentType:
              charge[4]?.trim() === '-' ? null : (charge[4]?.trim() ?? null),
            includedIn:
              charge[9]?.trim() === '-' ? null : (charge[9]?.trim() ?? null),
            evidence: [ev(p.page, text)],
          });
      }
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
    /^(-?\d+(?:\.\d+)?) ([A-Z]{3})(?: \(synthetic scenario assumption\))?$/,
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
  // Only explicit labels are supported. Unsupported layouts remain reviewable unknowns.
  const references: NonNullable<AnalysisDocumentInput['references']> = [];
  for (const page of result.pages)
    for (const raw of page.text.split('\n')) {
      const match = raw
        .trim()
        .match(
          /^(Operation|Shipment|Booking|BL|Bill of lading|Agreement|Contract|Quotation|Quote)(?: reference| number)?:\s*(.+)$/i,
        );
      if (!match?.[1] || !match[2]) continue;
      const labelType = match[1].toLowerCase();
      const type =
        labelType === 'quote'
          ? 'quotation'
          : labelType === 'bill of lading'
            ? 'bl'
            : labelType;
      if (
        type === 'operation' ||
        type === 'shipment' ||
        type === 'booking' ||
        type === 'bl' ||
        type === 'quotation' ||
        type === 'agreement' ||
        type === 'contract'
      )
        references.push({
          type: type === 'contract' ? 'agreement' : type,
          value: match[2].trim(),
          evidence: [ev(page.page, raw.trim())],
        });
    }
  const origin = label('Origin') ?? commercial.origin;
  const destination = label('Destination') ?? commercial.destination;
  const transportMode = label('Transport mode');
  const equipmentType = label('Equipment type');
  const contractingParty = label('Contracting party');
  const dateBasisLabel = label('Validity date basis');
  const dateBasis =
    dateBasisLabel === 'service-date' ||
    dateBasisLabel === 'shipment-date' ||
    dateBasisLabel === 'booking-date' ||
    dateBasisLabel === 'invoice-date'
      ? dateBasisLabel
      : 'unknown';
  const restriction = (name: string, value: string | null) => {
    const explicit = label(name + ' restriction');
    const conditionValue =
      explicit && explicit !== 'unrestricted' && explicit !== 'unknown'
        ? explicit
        : value;
    return {
      state:
        explicit === 'unrestricted'
          ? ('unrestricted' as const)
          : explicit === 'unknown' || !conditionValue
            ? ('unknown' as const)
            : ('restricted' as const),
      value: conditionValue,
      evidence: [
        ...evidence.filter(
          (e) =>
            e.snippet.toLowerCase().startsWith(name.toLowerCase() + ':') ||
            e.snippet
              .toLowerCase()
              .startsWith(name.toLowerCase() + ' restriction:'),
        ),
        ...(name === 'Origin' && conditionValue === commercial.origin
          ? commercial.metadataEvidence.origin
          : name === 'Destination' && conditionValue === commercial.destination
            ? commercial.metadataEvidence.destination
            : []),
      ].slice(0, 20),
    };
  };
  const serviceLabel = label('Service');
  const supportedServices = [
    ...new Set(
      lines
        .map((line) => line.service)
        .filter((service) => service !== 'unknown'),
    ),
  ];
  const serviceCondition = restriction(
    'Service',
    serviceLabel ??
      (supportedServices.length === 1 ? (supportedServices[0] ?? null) : null),
  );
  if (!serviceLabel && serviceCondition.value)
    serviceCondition.evidence = lines
      .filter((line) => line.service === serviceCondition.value)
      .flatMap((line) => line.evidence);
  const equipmentQuantities: NonNullable<
    AnalysisDocumentInput['equipmentQuantities']
  > = [...commercial.equipmentQuantities];
  for (const page of result.pages)
    for (const raw of page.text.split('\n')) {
      const match = raw
        .trim()
        .match(/^Equipment quantity:\s*([^;]+);\s*(\d+(?:\.\d+)?)$/i);
      if (match?.[1] && match[2])
        equipmentQuantities.push({
          equipment: match[1].trim(),
          quantity: match[2],
          evidence: [ev(page.page, raw.trim())],
        });
    }
  const count = (name: string) => {
    const value = label(name);
    return value && /^\d+(?:\.\d+)?$/.test(value) ? value : null;
  };
  if (lines.length > 100 || equipmentQuantities.length > 50)
    parserWarnings.push('COMMERCIAL_ROWS_PARTIAL');
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
    references,
    agreementIdentity:
      references.find((r) => r.type === 'agreement' || r.type === 'quotation')
        ?.value ?? null,
    origin,
    destination,
    transportMode,
    equipmentType,
    contractingParty,
    shipmentDate: date(label('Shipment date')),
    bookingDate: date(label('Booking date')),
    invoiceDate: date(label('Invoice date')),
    equipmentQuantities: equipmentQuantities.slice(0, 50),
    exchangeRates: commercial.exchangeRates,
    ...(commercial.billingPeriod
      ? { billingPeriod: commercial.billingPeriod }
      : {}),
    blQuantity: count('BL quantity'),
    shipmentQuantity: count('Shipment quantity'),
    ...(input.kind === 'quotation' || input.kind === 'tariff'
      ? {
          applicability: {
            provider: restriction('Provider', values.get('provider') ?? null),
            service: serviceCondition,
            origin: restriction('Origin', origin),
            destination: restriction('Destination', destination),
            transportMode: restriction('Transport mode', transportMode),
            equipmentType: restriction('Equipment type', equipmentType),
            contractingParty: restriction(
              'Contracting party',
              contractingParty,
            ),
            dateBasis,
            restrictions: [],
          },
        }
      : {}),
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
    lines: lines.slice(0, 100),
    evidence,
    warnings: [
      'LABEL_BASED_EXTRACTION',
      'HUMAN_REVIEW_REQUIRED',
      ...(input.kind !== 'invoice' && lines.length === 0
        ? ['PRICING_LAYOUT_REQUIRES_REVIEW']
        : []),
      ...parserWarnings,
      ...(lines.length === 0 && input.kind === 'invoice'
        ? ['LINE_ITEMS_MISSING']
        : []),
    ],
  });
}

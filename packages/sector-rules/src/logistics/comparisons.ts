import { Decimal } from 'decimal.js';
import type {
  AnalysisDocument,
  AnalysisEvidence,
  AnalysisLine,
  AnalysisSnapshot,
  ComparisonCandidate,
} from '@reconcile/domain';
import { decideAgreement, operationContradiction } from './applicability.js';
import {
  canonicalBillingUnit,
  canonicalConcept,
  compatibleConcepts,
  canonicalEquipment,
} from './concepts.js';

const Money = Decimal.clone({ precision: 128 });
const numeric = (value: string | null | undefined): value is string =>
  value != null && /^-?\d{1,30}(?:\.\d{1,12})?$/.test(value);
const same = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(
    a?.trim() && b?.trim() && a.trim().toLowerCase() === b.trim().toLowerCase(),
  );
const version = 'commercial-concepts-v1';
const incomplete = (doc: AnalysisDocument) =>
  doc.warnings.some((warning) =>
    [
      'SOURCE_INCOMPLETE',
      'COMMERCIAL_ROWS_PARTIAL',
      'COMMERCIAL_TABLE_LIMIT',
    ].includes(warning),
  );
const uniqueEvidence = (items: AnalysisEvidence[]) =>
  items.filter(
    (item, index) =>
      items.findIndex(
        (other) => JSON.stringify(other) === JSON.stringify(item),
      ) === index,
  );
const hasOriginal = (line: AnalysisLine) =>
  line.tariffUnitPrice != null || line.tariffCurrency != null;
const sourcePrice = (line: AnalysisLine) =>
  hasOriginal(line)
    ? line.tariffCurrency?.trim()
      ? (line.tariffUnitPrice ?? null)
      : null
    : line.unitPrice;
const sourceCurrency = (doc: AnalysisDocument, line: AnalysisLine) =>
  hasOriginal(line)
    ? numeric(line.tariffUnitPrice)
      ? (line.tariffCurrency ?? null)
      : null
    : (line.currency ?? doc.currency);

function candidate(
  snapshot: AnalysisSnapshot,
  invoice: AnalysisDocument,
  line: AnalysisLine,
  reference: AnalysisDocument | null,
  rate: AnalysisLine | null,
  ambiguous: boolean,
  limited = false,
): ComparisonCandidate {
  const concept = canonicalConcept(line);
  const decision = reference
    ? decideAgreement(reference, invoice, line, snapshot)
    : null;
  const conditions: ComparisonCandidate['conditions'] = decision
    ? decision.conditions.filter(
        (condition) =>
          !(
            concept &&
            rate &&
            rate.evidence.length > 0 &&
            line.evidence.length > 0 &&
            ['service-route', 'service'].includes(condition.name) &&
            condition.state === 'unknown'
          ),
      )
    : [];
  const add = (
    name: string,
    state: 'verified' | 'unknown' | 'contradictory',
    reason: string,
    evidence: AnalysisEvidence[] = line.evidence,
  ) => conditions.push({ name, state, reason, evidence });
  if (!reference || !rate)
    add(
      'concept',
      'unknown',
      concept
        ? 'No hay una partida de referencia con alias reconocido para este concepto.'
        : 'Concepto sin alias explícito reconocido; no se empareja por importe ni similitud.',
    );
  else
    add(
      'concept',
      'verified',
      'Alias bilingüe explícito del mismo concepto; origen y destino no son intercambiables.',
      rate.evidence,
    );
  if (operationContradiction(invoice, snapshot))
    add(
      'invoice-reference',
      'contradictory',
      'La factura contradice referencias externas documentadas de la operación.',
    );
  if (limited)
    add(
      'candidate-limit',
      'unknown',
      'Existen más de ocho alternativas; se muestran hasta ocho y se requiere acotar o seleccionar explícitamente.',
    );
  if (ambiguous)
    add(
      'candidate-selection',
      'unknown',
      'Hay varias condiciones candidatas; requiere selección explícita y revisión.',
    );
  if (rate && reference) {
    const unit = canonicalBillingUnit(line),
      expectedUnit = canonicalBillingUnit(rate);
    add(
      'billing-unit',
      !unit || !expectedUnit
        ? 'unknown'
        : unit === expectedUnit
          ? 'verified'
          : 'contradictory',
      'La base de cobro debe estar documentada y ser compatible.',
      [...line.evidence, ...rate.evidence],
    );
    if (unit === 'container' || expectedUnit === 'container') {
      const actualEquipment = canonicalEquipment(
        line.equipmentType ?? invoice.equipmentType,
      );
      const expectedEquipment = canonicalEquipment(
        rate.equipmentType ?? reference.equipmentType,
      );
      add(
        'equipment',
        !actualEquipment || !expectedEquipment
          ? 'unknown'
          : actualEquipment === expectedEquipment
            ? 'verified'
            : 'contradictory',
        'La tarifa depende del equipo; los tipos desconocidos no equivalen.',
        [...line.evidence, ...rate.evidence],
      );
    }
    if (!line.route || !rate.route)
      add(
        'comparison-route',
        'unknown',
        'Falta la ruta de la partida o de la referencia.',
      );
    else
      add(
        'comparison-route',
        same(line.route, rate.route) ? 'verified' : 'contradictory',
        'Comparación direccional de ruta documentada.',
        [...line.evidence, ...rate.evidence],
      );
    if ([concept, canonicalConcept(rate)].includes('base-freight')) {
      const oceanMode = (value: string | null | undefined) =>
        Boolean(
          value &&
          ['ocean', 'sea', 'maritime', 'maritimo'].includes(
            value.trim().toLowerCase(),
          ),
        );
      const invoiceOcean =
        canonicalConcept(line) === 'ocean-freight' ||
        (oceanMode(invoice.transportMode) && invoice.evidence.length > 0);
      const referenceOcean =
        canonicalConcept(rate) === 'ocean-freight' ||
        (oceanMode(reference.transportMode) && reference.evidence.length > 0);
      const wrongMode = [invoice.transportMode, reference.transportMode].some(
        (mode) => mode && !oceanMode(mode),
      );
      add(
        'freight-transport-mode',
        wrongMode
          ? 'contradictory'
          : invoiceOcean && referenceOcean
            ? 'verified'
            : 'unknown',
        'Freight/flete genérico requiere contexto marítimo documentado en ambos lados; no se infiere por el importe.',
        [...line.evidence, ...rate.evidence],
      );
    }
    const terms = rate.pricingTerms;
    if (terms && (terms.validFrom || terms.validUntil)) {
      const basis = terms.dateBasis;
      const date =
        basis === 'service-date'
          ? invoice.serviceDate
          : basis === 'shipment-date'
            ? invoice.shipmentDate
            : basis === 'booking-date'
              ? invoice.bookingDate
              : basis === 'invoice-date'
                ? invoice.invoiceDate
                : null;
      const valid = (value: string | null | undefined): value is string =>
        Boolean(
          value &&
          /^\d{4}-\d{2}-\d{2}$/.test(value) &&
          Number.isFinite(new Date(value + 'T00:00:00Z').getTime()) &&
          new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value,
        );
      add(
        'line-validity',
        !valid(date) || !valid(terms.validFrom) || !valid(terms.validUntil)
          ? 'unknown'
          : terms.validFrom <= date && date <= terms.validUntil
            ? 'verified'
            : 'contradictory',
        'La vigencia específica de la partida se evalúa con su base de fecha explícita; no se sustituye por la fecha de factura.',
        terms.evidence,
      );
    }
    if (terms?.dateBasis === 'unknown')
      add(
        'line-date-basis',
        'unknown',
        'La base de fecha de la partida no está documentada.',
        terms.evidence,
      );
    if (!terms || terms.behavior !== 'fixed' || terms.evidence.length === 0)
      add(
        'pricing-terms',
        'unknown',
        'El carácter fijo o variable del precio requiere evidencia de las condiciones.',
        rate.evidence,
      );
    if (terms?.cadence === 'unknown')
      add(
        'pricing-cadence',
        'unknown',
        'Falta la periodicidad documentada del precio.',
        terms.evidence,
      );
    if (terms?.cadence === 'monthly' || terms?.cadence === 'annual') {
      add(
        'recurring-calculation',
        'unknown',
        'Una tarifa periódica requiere verificar duración y unidad temporal; no se equipara a una tarifa por unidad.',
        terms.evidence,
      );
      const period = invoice.billingPeriod;
      add(
        'billing-period',
        !period ||
          !terms.validFrom ||
          !terms.validUntil ||
          period.evidence.length === 0
          ? 'unknown'
          : period.from >= terms.validFrom && period.to <= terms.validUntil
            ? 'verified'
            : 'contradictory',
        'La periodicidad y vigencia deben cubrir el periodo facturado.',
        terms.evidence,
      );
    }
    if ([line, rate].some((item) => /\blump\s*sum\b/i.test(item.description)))
      add(
        'freight-package',
        'unknown',
        'El precio corresponde a un paquete/lumpsum; revisar sus inclusiones y desglose antes de atribuir diferencias.',
        rate.evidence,
      );
    if (concept === 'emission-allowance')
      add(
        'emissions-scope',
        'unknown',
        'El recargo de emisiones requiere verificar ámbito geográfico, periodo y condiciones; el alias no demuestra aplicabilidad.',
        rate.evidence,
      );
    if (rate.includedIn)
      add(
        'included-package',
        'unknown',
        'Concepto incluido en un paquete; requiere reconciliar el desglose y evitar doble cómputo.',
        rate.evidence,
      );
    if (concept === 'bunker-adjustment' || concept === 'marine-fuel-recovery')
      add(
        'variable-surcharge',
        'unknown',
        'El recargo puede depender de cláusulas variables; revisar sus condiciones y fecha.',
        rate.evidence,
      );
  }
  if (line.pricingTerms?.behavior === 'variable')
    add(
      'invoice-variable-price',
      'unknown',
      'La factura identifica precio variable; revisar la cláusula aplicable.',
      line.pricingTerms.evidence,
    );
  const actualUnit = canonicalBillingUnit(line),
    expectedUnit = rate ? canonicalBillingUnit(rate) : null;
  const unitCompatible = Boolean(
    actualUnit && expectedUnit && actualUnit === expectedUnit,
  );
  const equipmentActual = canonicalEquipment(
    line.equipmentType ?? invoice.equipmentType,
  );
  const equipmentExpected = canonicalEquipment(
    rate?.equipmentType ?? reference?.equipmentType,
  );
  const equipmentCompatible =
    (actualUnit !== 'container' && expectedUnit !== 'container') ||
    Boolean(
      equipmentActual &&
      equipmentExpected &&
      equipmentActual === equipmentExpected,
    );
  const priceBasisCompatible = unitCompatible && equipmentCompatible;
  const expectedPrice = rate ? sourcePrice(rate) : null;
  const actualPrice = sourcePrice(line);
  const expectedCurrency =
    rate && reference ? sourceCurrency(reference, rate) : null;
  const actualCurrency = sourceCurrency(invoice, line);
  const compatibleCurrency = same(expectedCurrency, actualCurrency);
  add(
    'price-currency',
    !expectedCurrency || !actualCurrency
      ? 'unknown'
      : compatibleCurrency
        ? 'verified'
        : 'contradictory',
    'Los precios originales solo se comparan dentro de la misma moneda.',
  );
  const currency = compatibleCurrency ? actualCurrency : null;
  const cadenceActual = line.pricingTerms?.cadence;
  const cadenceExpected = rate?.pricingTerms?.cadence;
  const cadenceMismatch =
    cadenceActual &&
    cadenceExpected &&
    cadenceActual !== 'unknown' &&
    cadenceExpected !== 'unknown' &&
    cadenceActual !== cadenceExpected;
  if (cadenceMismatch)
    add(
      'price-cadence',
      'contradictory',
      'Las tarifas expresan periodicidades diferentes y no se comparan como precios equivalentes.',
    );
  const recurring = [cadenceActual, cadenceExpected].some(
    (cadence) => cadence === 'monthly' || cadence === 'annual',
  );
  const pricesKnown =
    priceBasisCompatible &&
    !cadenceMismatch &&
    numeric(expectedPrice) &&
    numeric(actualPrice) &&
    compatibleCurrency;
  const priceStatus = pricesKnown
    ? new Money(expectedPrice).equals(actualPrice)
      ? 'equal'
      : 'different'
    : 'unknown';
  if (!pricesKnown)
    add(
      'source-price',
      'unknown',
      'Faltan precios originales comparables con moneda documentada.',
    );
  const quantity =
    numeric(line.quantity) &&
    line.evidence.length > 0 &&
    new Money(line.quantity).gt(0)
      ? line.quantity
      : null;
  add(
    'quantity',
    quantity ? 'verified' : 'unknown',
    quantity
      ? 'Cantidad explícita de la factura; no se reutiliza una cantidad de la cotización.'
      : 'Falta una cantidad positiva documentada para calcular importes.',
  );
  const aggregateSupported =
    !recurring && priceBasisCompatible && !cadenceMismatch;
  const expectedAmount =
    aggregateSupported &&
    numeric(expectedPrice) &&
    quantity &&
    compatibleCurrency
      ? new Money(expectedPrice).times(quantity).toFixed()
      : null;
  const calculatedActual =
    aggregateSupported && numeric(actualPrice) && quantity && compatibleCurrency
      ? new Money(actualPrice).times(quantity).toFixed()
      : null;
  const bookedCurrency = line.currency ?? invoice.currency;
  const actualAmount =
    aggregateSupported &&
    same(actualCurrency, bookedCurrency) &&
    numeric(line.amount) &&
    compatibleCurrency
      ? line.amount
      : calculatedActual;
  const difference =
    expectedAmount !== null && actualAmount !== null
      ? new Money(actualAmount).minus(expectedAmount).toFixed()
      : null;
  if (
    same(actualCurrency, bookedCurrency) &&
    calculatedActual !== null &&
    numeric(line.amount) &&
    !new Money(calculatedActual).equals(line.amount)
  )
    add(
      'line-arithmetic',
      'contradictory',
      'El precio original por cantidad no coincide con el importe de la partida; requiere revisión.',
    );
  if (actualCurrency && bookedCurrency && !same(actualCurrency, bookedCurrency))
    add(
      'fx-review',
      'unknown',
      'Se comparan las tarifas en moneda original; la conversión al importe contabilizado requiere revisión independiente.',
    );
  if (!invoice.provider || !reference?.provider)
    add(
      'comparison-provider',
      'unknown',
      'Falta identificar el proveedor; la vinculación manual no acredita aplicabilidad.',
    );
  if (incomplete(invoice) || (reference && incomplete(reference)))
    add(
      'source-completeness',
      'unknown',
      'La extracción está incompleta; no se afirma una diferencia comercial confirmada.',
    );
  if (line.evidence.length === 0 || (rate && rate.evidence.length === 0))
    add(
      'source-evidence',
      'unknown',
      'Falta evidencia documental de una partida.',
    );
  const pending = conditions.some(
    (condition) =>
      condition.state === 'unknown' || condition.state === 'contradictory',
  );
  return {
    invoiceDocumentId: invoice.documentId,
    lineId: line.id,
    referenceDocumentId: reference?.documentId ?? null,
    referenceLineId: rate?.id ?? null,
    concept,
    invoiceConcept: line.description,
    referenceConcept: rate?.description ?? null,
    status:
      pending || priceStatus === 'unknown'
        ? 'pending'
        : priceStatus === 'different'
          ? 'difference'
          : 'correct',
    priceStatus,
    claimable: false,
    aliasVersion: version,
    quantity,
    currency,
    expectedCurrency,
    actualCurrency,
    expectedUnitPrice: numeric(expectedPrice) ? expectedPrice : null,
    actualUnitPrice: numeric(actualPrice) ? actualPrice : null,
    expectedAmount,
    actualAmount,
    difference,
    conditions: conditions.map((condition) => ({
      ...condition,
      evidence: condition.evidence.slice(0, 8),
    })),
    reasons: conditions
      .filter(
        (condition) =>
          condition.state === 'unknown' || condition.state === 'contradictory',
      )
      .map((condition) => condition.reason),
    calculation:
      aggregateSupported &&
      quantity &&
      numeric(expectedPrice) &&
      numeric(actualPrice) &&
      compatibleCurrency
        ? `Tarifa original × cantidad: esperado ${expectedPrice} × ${quantity} = ${expectedAmount}; observado ${actualPrice} × ${quantity} = ${calculatedActual} ${currency}; importe observado comparable ${actualAmount} ${currency}.`
        : null,
    evidence: uniqueEvidence([
      ...line.evidence.slice(0, 8),
      ...(rate?.evidence.slice(0, 8) ?? []),
      ...conditions.flatMap((condition) => condition.evidence.slice(0, 2)),
    ]),
  };
}

/** Observational comparisons never enter the claimable finding pipeline. */
export function compareReferenceLines(
  snapshot: AnalysisSnapshot,
): ComparisonCandidate[] {
  const references = snapshot.documents.filter(
    (document) => document.kind === 'agreement',
  );
  return snapshot.documents
    .filter((document) => document.kind === 'invoice')
    .flatMap((invoice) =>
      invoice.lines.flatMap((line) => {
        const concept = canonicalConcept(line);
        const matches = concept
          ? references.flatMap((reference) =>
              reference.lines
                .filter((rate) => compatibleConcepts(line, rate))
                .map((rate) => ({ reference, rate })),
            )
          : [];
        if (!matches.length)
          return [candidate(snapshot, invoice, line, null, null, false)];
        // Known incompatible equipment or units cannot make another exact scope ambiguous.
        const compatible = matches.filter(({ reference, rate }) => {
          const a = canonicalBillingUnit(line),
            b = canonicalBillingUnit(rate);
          const equipmentA = canonicalEquipment(
            line.equipmentType ?? invoice.equipmentType,
          );
          const equipmentB = canonicalEquipment(
            rate.equipmentType ?? reference.equipmentType,
          );
          return (
            !(a && b && a !== b) &&
            !(
              (a === 'container' || b === 'container') &&
              equipmentA &&
              equipmentB &&
              equipmentA !== equipmentB
            )
          );
        });
        const candidates = compatible.length ? compatible : matches;
        return candidates
          .slice(0, 8)
          .map(({ reference, rate }) =>
            candidate(
              snapshot,
              invoice,
              line,
              reference,
              rate,
              candidates.length > 1,
              candidates.length > 8,
            ),
          );
      }),
    );
}

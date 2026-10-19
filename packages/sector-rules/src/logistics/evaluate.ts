import { Decimal } from 'decimal.js';
import {
  decideAgreement,
  sameCharge,
  operationContradiction,
  operationContext,
} from './applicability.js';
import type {
  AnalysisAgreementBinding,
  AgreementSourceEvidence,
  AnalysisDocument,
  AnalysisEvidence,
  AnalysisFinding,
  AnalysisLine,
  AnalysisResult,
  AnalysisSnapshot,
} from '@reconcile/domain';
export const LOGISTICS_RULE_VERSION = 'logistics-v5';
const Arithmetic = Decimal.clone({ precision: 128 });
const decimal = (value: string | null | undefined): value is string =>
  value != null && /^-?\d{1,30}(?:\.\d{1,12})?$/.test(value);
const same = (
  a: string | null | undefined,
  b: string | null | undefined,
): boolean =>
  a != null &&
  b != null &&
  a.trim().length > 0 &&
  b.trim().length > 0 &&
  a.trim().toLowerCase() === b.trim().toLowerCase();
const validDate = (value: string | null | undefined): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};
const subtract = (a: string, b: string): string =>
  new Arithmetic(a).minus(b).toFixed();
const sum = (values: string[]): string =>
  values.reduce(
    (total, value) => new Arithmetic(total).plus(value).toFixed(),
    '0',
  );
const evidence = (...groups: AnalysisEvidence[][]): AnalysisEvidence[] =>
  groups
    .flat()
    .filter(
      (item, i, all) =>
        all.findIndex(
          (other) => JSON.stringify(other) === JSON.stringify(item),
        ) === i,
    );
function finding(
  doc: AnalysisDocument,
  line: AnalysisLine | null,
  code: string,
  explanation: string,
  status: AnalysisFinding['status'] = 'not-verifiable',
  expected: string | null = null,
  sources: AnalysisEvidence[] = [],
): AnalysisFinding {
  const invoiced = line?.amount ?? doc.total;
  return {
    documentId: doc.documentId,
    lineId: line?.id ?? null,
    service: line?.description ?? 'Documento',
    status,
    code,
    expected,
    invoiced,
    difference:
      decimal(invoiced) && decimal(expected)
        ? subtract(invoiced, expected)
        : null,
    currency: line?.currency ?? doc.currency,
    explanation,
    evidence: evidence(doc.evidence, line?.evidence ?? [], sources),
  };
}
function sameService(
  invoice: AnalysisDocument,
  line: AnalysisLine,
  record: AnalysisDocument,
): boolean {
  return (
    same(invoice.operationReference, record.operationReference) &&
    same(invoice.serviceReference, record.serviceReference) &&
    same(invoice.serviceDate, record.serviceDate) &&
    same(line.route, record.route)
  );
}
function selectedContext(
  snapshot: AnalysisSnapshot,
  invoice: AnalysisDocument,
  line: AnalysisLine,
  binding: AnalysisAgreementBinding,
) {
  const agreement = binding.agreement,
    terms = agreement.terms;
  const context: AnalysisDocument = {
    ...invoice,
    serviceDate:
      !terms.applicability || terms.applicability.dateBasis === 'service-date'
        ? (invoice.serviceDate ?? binding.serviceDate)
        : invoice.serviceDate,
    route: invoice.route ?? binding.route,
    lines: invoice.lines.map((item) => ({
      ...item,
      route: item.route ?? binding.route,
    })),
  };
  const candidate: AnalysisDocument = {
    ...invoice,
    documentId: agreement.sourceDocumentId,
    extractionRunId: agreement.sourceExtractionRunId,
    revisionId: agreement.id,
    kind: 'agreement',
    operationReference: null,
    provider: terms.provider,
    currency: terms.currency,
    validFrom: terms.validFrom,
    validUntil: terms.validUntil,
    agreementBasis: terms.agreementBasis,
    lines: terms.lines ?? [
      { ...line, service: terms.service, route: terms.route },
    ],
    evidence: terms.evidence.map((e) => ({ ...e, revisionId: agreement.id })),
    applicability: terms.applicability,
    agreementIdentity: terms.agreementIdentity,
    references: terms.references ?? [],
    excludedServices: [],
    route: terms.route,
  };
  const decision = decideAgreement(
    candidate,
    context,
    { ...line, route: line.route ?? binding.route },
    snapshot,
  );
  if (
    (binding.serviceDate &&
      invoice.serviceDate &&
      !same(binding.serviceDate, invoice.serviceDate)) ||
    (binding.route &&
      ((line.route && !same(binding.route, line.route)) ||
        (invoice.route && !same(binding.route, invoice.route))))
  ) {
    decision.state = 'not-applicable';
    decision.reason =
      'La selección revisada contradice datos explícitos de la factura.';
    decision.conditions.push({
      name: 'selection-context',
      state: 'contradictory',
      reason: decision.reason,
      evidence: invoice.evidence,
    });
  }
  if (
    agreement.organizationId !== snapshot.organizationId ||
    (agreement.scope === 'spot' &&
      agreement.operationId !== snapshot.operationId) ||
    agreement.id !== binding.agreementVersionId
  ) {
    decision.state = 'not-applicable';
    decision.reason =
      'La selección no pertenece a esta operación u organización.';
  }
  return { candidate, context, decision };
}
/** Selected terms are immutable reviewed facts, never inferred from another agreement. */
function evaluateBinding(
  snapshot: AnalysisSnapshot,
  invoice: AnalysisDocument,
  line: AnalysisLine,
  bindings: AnalysisAgreementBinding[],
): AnalysisFinding {
  const binding = bindings[0];
  const unavailable = (code: string, explanation: string) =>
    finding(invoice, line, code, explanation);
  if (bindings.length !== 1 || !binding)
    return unavailable(
      'AGREEMENT_BINDING_AMBIGUOUS',
      'La factura requiere una única selección explícita de acuerdo.',
    );
  const agreement = binding.agreement;
  const terms = agreement.terms;
  const trusted = (items: AgreementSourceEvidence[]) =>
    items.length > 0 &&
    items.every(
      (item) =>
        item.documentId === agreement.sourceDocumentId &&
        item.extractionRunId === agreement.sourceExtractionRunId &&
        Number.isInteger(item.page) &&
        item.page > 0 &&
        item.snippet.trim().length > 0,
    );
  if (
    agreement.id !== binding.agreementVersionId ||
    agreement.organizationId !== snapshot.organizationId ||
    (agreement.scope === 'spot' &&
      (!snapshot.operationId ||
        agreement.operationId !== snapshot.operationId)) ||
    (agreement.scope === 'reusable' && agreement.operationId !== null) ||
    !trusted(terms.evidence)
  )
    return unavailable(
      'AGREEMENT_BINDING_INVALID',
      'La selección o la evidencia del acuerdo no es verificable para esta operación.',
    );
  if (
    binding.serviceDate &&
    invoice.serviceDate &&
    !same(binding.serviceDate, invoice.serviceDate)
  )
    return unavailable(
      'AGREEMENT_DATE_UNVERIFIABLE',
      'La fecha revisada contradice la fecha explícita del servicio.',
    );
  if (
    binding.route &&
    ((line.route && !same(binding.route, line.route)) ||
      (invoice.route && !same(binding.route, invoice.route)))
  )
    return unavailable(
      'AGREEMENT_SCOPE_MISMATCH',
      'El trayecto revisado contradice los datos explícitos de la factura.',
    );
  if (terms.applicability || terms.lines || terms.references?.length) {
    const { candidate, context, decision } = selectedContext(
      snapshot,
      invoice,
      line,
      binding,
    );
    if (decision.state !== 'applicable')
      return unavailable(
        decision.state === 'pending'
          ? 'AGREEMENT_PENDING'
          : 'AGREEMENT_NOT_APPLICABLE',
        decision.reason,
      );
    if (terms.lines) {
      const result = evaluateLogistics({
        ...snapshot,
        agreementBindings: [],
        documents: [
          context,
          candidate,
          ...snapshot.documents.filter(
            (doc) => doc.kind === 'operational-record',
          ),
        ],
      });
      return (
        result.findings.find(
          (f) => f.lineId === line.id && f.code !== 'LINE_ARITHMETIC',
        ) ?? unavailable('SERVICE_NOT_AGREED', 'No hay una tarifa verificable.')
      );
    }
  }
  if (terms.agreementBasis !== 'accepted')
    return unavailable(
      'AGREEMENT_BASIS_UNVERIFIABLE',
      'El documento seleccionado no acredita un precio aceptado por el proveedor.',
    );
  if (!same(terms.provider, invoice.provider))
    return unavailable(
      'AGREEMENT_PROVIDER_MISMATCH',
      'El proveedor de la factura no coincide con el acuerdo seleccionado.',
    );
  if (!same(terms.currency, line.currency ?? invoice.currency))
    return unavailable(
      'CURRENCY_UNVERIFIABLE',
      'Las monedas no coinciden; no hay conversión respaldada.',
    );
  if (
    !validDate(binding.serviceDate) ||
    !validDate(terms.validFrom) ||
    !validDate(terms.validUntil) ||
    terms.validFrom > terms.validUntil ||
    binding.serviceDate < terms.validFrom ||
    binding.serviceDate > terms.validUntil ||
    (invoice.serviceDate !== null &&
      !same(invoice.serviceDate, binding.serviceDate))
  )
    return unavailable(
      'AGREEMENT_DATE_UNVERIFIABLE',
      'La fecha del servicio falta, contradice la factura o queda fuera de la vigencia seleccionada.',
    );
  if (
    terms.service !== line.service ||
    !same(terms.route, binding.route) ||
    (line.route !== null && !same(line.route, binding.route)) ||
    (invoice.route !== null && !same(invoice.route, binding.route))
  )
    return unavailable(
      'AGREEMENT_SCOPE_MISMATCH',
      'El servicio o trayecto no coincide con el ámbito del acuerdo seleccionado.',
    );
  if (terms.pricing.type === 'line-items')
    return unavailable(
      'SERVICE_NOT_AGREED',
      'Faltan partidas de tarifa verificables en el acuerdo.',
    );
  let basis: 'fixed-trip' | 'per-km';
  let amount: string;
  let sources: AgreementSourceEvidence[];
  if (terms.pricing.type === 'distance-bands') {
    if (
      !decimal(binding.distanceKm) ||
      new Arithmetic(binding.distanceKm).lte(0)
    )
      return unavailable(
        'DISTANCE_UNVERIFIABLE',
        'Falta una distancia positiva y verificada para seleccionar el tramo.',
      );
    const bands = terms.pricing.bands;
    const validBands =
      bands.length > 0 &&
      bands.every((band, i) => {
        const previous = bands[i - 1];
        return (
          decimal(band.fromKm) &&
          decimal(band.toKm) &&
          decimal(band.amount) &&
          new Arithmetic(band.amount).gt(0) &&
          new Arithmetic(band.toKm).gt(band.fromKm) &&
          (!previous || new Arithmetic(band.fromKm).gte(previous.toKm)) &&
          trusted(band.evidence)
        );
      });
    if (!validBands)
      return unavailable(
        'DISTANCE_BANDS_INVALID',
        'Los tramos no son verificables, están superpuestos o carecen de evidencia.',
      );
    const distance = new Arithmetic(binding.distanceKm);
    const matching = bands.filter(
      (band) => distance.gte(band.fromKm) && distance.lt(band.toKm),
    );
    const band = matching[0];
    if (matching.length !== 1 || !band)
      return unavailable(
        'DISTANCE_BAND_MISSING',
        'La distancia no está cubierta por un único tramo [desde, hasta).',
      );
    basis = band.basis;
    amount = band.amount;
    sources = band.evidence;
  } else {
    basis = terms.pricing.type;
    amount = terms.pricing.amount;
    sources = terms.pricing.evidence;
  }
  if (!decimal(amount) || new Arithmetic(amount).lte(0) || !trusted(sources))
    return unavailable(
      'AGREEMENT_PRICE_UNVERIFIABLE',
      'El precio seleccionado carece de importe o evidencia verificable.',
    );
  let expected: string;
  if (basis === 'per-km') {
    if (
      !decimal(binding.distanceKm) ||
      new Arithmetic(binding.distanceKm).lte(0)
    )
      return unavailable(
        'DISTANCE_UNVERIFIABLE',
        'Falta una distancia positiva y verificada para calcular el precio por kilómetro.',
      );
    if (
      !same(line.unit, 'km') ||
      !decimal(line.quantity) ||
      !new Arithmetic(line.quantity).equals(binding.distanceKm)
    )
      return unavailable(
        'AGREEMENT_UNIT_UNVERIFIABLE',
        'La partida debe expresar kilómetros y una cantidad igual a la distancia verificada.',
      );
    expected = new Arithmetic(amount).times(binding.distanceKm).toFixed();
  } else {
    const unit = terms.service === 'pickup' ? 'trip' : 'service';
    if (
      !same(line.unit, unit) ||
      !decimal(line.quantity) ||
      !new Arithmetic(line.quantity).equals(1)
    )
      return unavailable(
        'AGREEMENT_UNIT_UNVERIFIABLE',
        'El precio total requiere una sola unidad de viaje o servicio compatible.',
      );
    expected = amount;
  }
  const different =
    !decimal(line.amount) || !new Arithmetic(line.amount).equals(expected);
  return finding(
    invoice,
    line,
    different ? 'PRICE_OR_QUANTITY_DIFFERENCE' : 'PRICE_MATCH',
    different
      ? 'El importe facturado difiere de las condiciones revisadas del acuerdo seleccionado.'
      : 'El importe coincide con las condiciones revisadas del acuerdo seleccionado; no acredita por sí solo la prestación.',
    different ? 'confirmed' : 'matched',
    expected,
    [...terms.evidence, ...sources].map((item) => ({
      ...item,
      revisionId: agreement.id,
    })),
  );
}
/** Pure deterministic comparison; never mutates financial/accounting state. */
export function evaluateLogistics(snapshot: AnalysisSnapshot): AnalysisResult {
  const findings: AnalysisFinding[] = [];
  const agreementDecisions: NonNullable<AnalysisResult['agreementDecisions']> =
    [];
  const documents = snapshot.documents.filter(
    (doc) => !operationContradiction(doc, snapshot),
  );
  for (const doc of snapshot.documents.filter(
    (item) => item.kind === 'invoice' && operationContradiction(item, snapshot),
  ))
    findings.push(
      finding(
        doc,
        null,
        'OPERATION_MISMATCH',
        'Las referencias externas del mismo tipo contradicen un documento operativo asignado.',
      ),
    );
  const invoices = documents.filter((doc) => doc.kind === 'invoice');
  const agreements = snapshot.documents.filter(
    (doc) => doc.kind === 'agreement',
  );
  for (const invoice of invoices) {
    if (invoice.lines.length === 0)
      findings.push(
        finding(
          invoice,
          null,
          'LINES_MISSING',
          'No hay partidas verificables.',
        ),
      );
    const allAmounts = invoice.lines.map((line) => line.amount);
    if (
      invoice.lines.some(
        (l) => !same(l.currency ?? invoice.currency, invoice.currency),
      )
    )
      findings.push(
        finding(
          invoice,
          null,
          'CURRENCY_UNVERIFIABLE',
          'El total contiene partidas en monedas distintas; no se suman sin conversión documentada.',
        ),
      );

    if (!decimal(invoice.taxAmount))
      findings.push(
        finding(
          invoice,
          null,
          'TAX_UNVERIFIABLE',
          'Falta un importe fiscal explícito y verificable.',
        ),
      );
    if (
      decimal(invoice.taxAmount) &&
      !new Arithmetic(invoice.taxAmount).isZero()
    )
      findings.push(
        finding(
          invoice,
          null,
          'TAX_REVIEW_REQUIRED',
          'El documento incluye impuestos. Las reglas fiscales aplicables no están implementadas; requieren revisión separada.',
        ),
      );
    if (
      !invoice.warnings.some((warning) =>
        [
          'COMMERCIAL_ROWS_PARTIAL',
          'SOURCE_INCOMPLETE',
          'COMMERCIAL_TABLE_LIMIT',
        ].includes(warning),
      ) &&
      decimal(invoice.total) &&
      decimal(invoice.taxAmount) &&
      allAmounts.every(decimal) &&
      invoice.lines.length > 0 &&
      invoice.lines.every((l) =>
        same(l.currency ?? invoice.currency, invoice.currency),
      )
    ) {
      const calculated = sum([...allAmounts, invoice.taxAmount]);
      if (!new Arithmetic(calculated).equals(invoice.total))
        findings.push(
          finding(
            invoice,
            null,
            'TOTAL_INCONSISTENT',
            'La suma de partidas e impuestos no coincide con el total.',
            'confirmed',
            calculated,
          ),
        );
    }
    for (const line of invoice.lines) {
      if (
        line.tariffCurrency &&
        !same(line.tariffCurrency, line.currency ?? invoice.currency)
      ) {
        findings.push(
          finding(
            invoice,
            line,
            'FX_CONVERSION_REVIEW',
            'La tarifa original y el importe facturado están en monedas distintas; la conversión requiere revisión documentada.',
          ),
        );
        continue;
      }
      if (line.service === 'unknown') {
        findings.push(
          finding(
            invoice,
            line,
            'CONCEPT_UNVERIFIABLE',
            'La partida fue extraída, pero su concepto no tiene una regla de comparación soportada.',
          ),
        );
        continue;
      }
      if (!invoice.provider) {
        findings.push(
          finding(
            invoice,
            line,
            'PROVIDER_UNVERIFIABLE',
            'La partida fue extraída, pero falta identificar y revisar el proveedor de la factura.',
          ),
        );
        continue;
      }
      if (
        !decimal(line.amount) ||
        !decimal(line.quantity) ||
        !decimal(line.unitPrice) ||
        !line.unit ||
        !(line.currency ?? invoice.currency) ||
        !invoice.provider ||
        line.evidence.length === 0
      ) {
        findings.push(
          finding(
            invoice,
            line,
            'LINE_INCOMPLETE',
            'Faltan concepto, cantidades, unidad, moneda, proveedor o evidencia.',
          ),
        );
        continue;
      }
      const calculated = new Arithmetic(line.quantity)
        .times(line.unitPrice)
        .toFixed();
      if (!new Arithmetic(calculated).equals(line.amount))
        findings.push(
          finding(
            invoice,
            line,
            'LINE_ARITHMETIC',
            'Cantidad por precio unitario no coincide con el importe de la partida.',
            'confirmed',
            calculated,
          ),
        );
      const selected =
        snapshot.agreementBindings?.filter(
          (binding) => binding.invoiceDocumentId === invoice.documentId,
        ) ?? [];
      if (selected.length > 0) {
        for (const binding of selected) {
          const { decision } = selectedContext(
            snapshot,
            invoice,
            line,
            binding,
          );
          agreementDecisions.push(decision);
        }
        findings.push(evaluateBinding(snapshot, invoice, line, selected));
        continue;
      }
      const decisions = agreements.map((agreement) =>
        decideAgreement(agreement, invoice, line, snapshot),
      );
      agreementDecisions.push(...decisions);
      const applicable = agreements.filter((agreement) =>
        decisions.some(
          (d) =>
            d.agreementDocumentId === agreement.documentId &&
            d.state === 'applicable',
        ),
      );
      const pending = decisions.some((d) => d.state === 'pending');
      if (applicable.length !== 1 || pending) {
        findings.push(
          finding(
            invoice,
            line,
            applicable.length > 1
              ? 'AGREEMENT_AMBIGUOUS'
              : pending
                ? 'AGREEMENT_PENDING'
                : decisions.length
                  ? 'AGREEMENT_NOT_APPLICABLE'
                  : 'AGREEMENT_MISSING',
            'Se requiere un único acuerdo aceptado y vigente para la fecha de servicio.',
          ),
        );
        continue;
      }
      const agreement = applicable[0];
      if (!agreement) continue;
      if (
        !same(line.currency ?? invoice.currency, agreement.currency) &&
        !agreement.lines.some((l) =>
          same(l.currency, line.currency ?? invoice.currency),
        )
      ) {
        findings.push(
          finding(
            invoice,
            line,
            'CURRENCY_UNVERIFIABLE',
            'Las monedas no coinciden; no hay conversión respaldada.',
            'not-verifiable',
            null,
            agreement.evidence,
          ),
        );
        continue;
      }
      const exclusion = agreement.excludedServices.find(
        (item) =>
          !line.chargeKey &&
          item.service === line.service &&
          same(item.route, line.route) &&
          item.evidence.length > 0,
      );
      if (exclusion) {
        const record = documents.find(
          (item) =>
            item.kind === 'operational-record' &&
            item.serviceStatus === 'completed' &&
            same(item.assignedProvider, item.performedProvider) &&
            !same(item.performedProvider, invoice.provider) &&
            sameService(invoice, line, item) &&
            item.evidence.length > 0,
        );
        const otherInvoice =
          record &&
          invoices.find(
            (other) =>
              other.documentId !== invoice.documentId &&
              same(other.provider, record.performedProvider) &&
              sameService(other, line, record) &&
              other.lines.some(
                (otherLine) =>
                  otherLine.service === line.service &&
                  same(otherLine.route, line.route) &&
                  otherLine.evidence.length > 0,
              ),
          );
        findings.push(
          finding(
            invoice,
            line,
            otherInvoice
              ? 'EXCLUDED_SERVICE_OTHER_PROVIDER'
              : 'EXCLUDED_SERVICE',
            otherInvoice
              ? 'Servicio excluido por el acuerdo, registrado como realizado y facturado por otro proveedor para la misma referencia, fecha y tramo. Revisar posible doble facturación.'
              : 'El acuerdo excluye expresamente este servicio y tramo. Requiere revisión humana.',
            'confirmed',
            '0',
            evidence(
              agreement.evidence,
              exclusion.evidence,
              record?.evidence ?? [],
              otherInvoice?.evidence ?? [],
              otherInvoice?.lines.flatMap((item) => item.evidence) ?? [],
            ),
          ),
        );
        continue;
      }
      const resolvedInvoice = operationContext(snapshot, invoice).context;
      const agreedLines = agreement.lines.filter(
        (item) =>
          item.service === line.service &&
          sameCharge(item, line) &&
          same(item.route, line.route) &&
          (!item.billingBasis ||
            (item.billingBasis === line.billingBasis &&
              (Boolean(item.chargeKey || line.chargeKey) ||
                same(item.description, line.description)))) &&
          (!item.equipmentType ||
            same(
              item.equipmentType,
              line.equipmentType ?? resolvedInvoice.equipmentType,
            )) &&
          same(
            item.currency ?? agreement.currency,
            line.currency ?? invoice.currency,
          ),
      );
      const agreed = agreedLines.length === 1 ? agreedLines[0] : undefined;
      if (
        !agreed ||
        !decimal(agreed.unitPrice) ||
        (!agreed.billingBasis && !decimal(agreed.quantity)) ||
        !agreed.unit ||
        agreed.evidence.length === 0
      ) {
        findings.push(
          finding(
            invoice,
            line,
            'SERVICE_NOT_AGREED',
            'No hay una condición única y verificable para esta partida.',
            'not-verifiable',
            null,
            agreement.evidence,
          ),
        );
        continue;
      }
      if (!same(line.unit, agreed.unit)) {
        findings.push(
          finding(
            invoice,
            line,
            'UNIT_MISMATCH',
            'La unidad de cobro no coincide con la acordada.',
            'confirmed',
            null,
            agreed.evidence,
          ),
        );
        continue;
      }
      if (agreed.includedIn) {
        findings.push(
          finding(
            invoice,
            line,
            'INCLUDED_IN_PACKAGE',
            'El concepto está incluido en un paquete; no se suma como tarifa adicional.',
            'not-verifiable',
            null,
            agreed.evidence,
          ),
        );
        continue;
      }
      let quantity: string | null = agreed.quantity;
      const quantityRecords = documents.filter(
        (doc) =>
          doc.kind === 'operational-record' &&
          !operationContradiction(doc, snapshot) &&
          (same(doc.operationReference, invoice.operationReference) ||
            doc.references?.some((ref) =>
              invoice.references?.some(
                (other) =>
                  other.type === ref.type && same(other.value, ref.value),
              ),
            )),
      );
      const quantitiesFromRecords = (
        key: 'blQuantity' | 'shipmentQuantity',
      ) => {
        const values = [
          ...new Set(
            [invoice, ...quantityRecords]
              .map((doc) => doc[key])
              .filter(decimal)
              .map((value) => new Arithmetic(value).toFixed()),
          ),
        ];
        return values.length === 1 ? (values[0] ?? null) : null;
      };
      if (agreed.billingBasis) {
        if (agreed.billingBasis === 'container') {
          const equipment = line.equipmentType ?? resolvedInvoice.equipmentType;
          const quantities = [
            ...(invoice.equipmentQuantities ?? []),
            ...quantityRecords.flatMap((doc) => doc.equipmentQuantities ?? []),
          ].filter(
            (q) => same(q.equipment, equipment) && q.evidence.length > 0,
          );
          const values = [
            ...new Set(
              quantities
                .map((q) => q.quantity)
                .filter(decimal)
                .map((value) => new Arithmetic(value).toFixed()),
            ),
          ];
          quantity = values.length === 1 ? (values[0] ?? null) : null;
        } else if (agreed.billingBasis === 'bl')
          quantity = quantitiesFromRecords('blQuantity');
        else if (agreed.billingBasis === 'shipment')
          quantity = quantitiesFromRecords('shipmentQuantity');
        else quantity = null;
        if (!decimal(quantity)) {
          findings.push(
            finding(
              invoice,
              line,
              'BILLING_QUANTITY_PENDING',
              'Falta cantidad documentada para la base de cálculo; no se reutiliza la cantidad de la cotización.',
            ),
          );
          continue;
        }
      }
      // A rate may omit quantity, but a calculation never may.
      if (!decimal(quantity)) {
        findings.push(
          finding(
            invoice,
            line,
            'BILLING_QUANTITY_PENDING',
            'Falta cantidad documentada para calcular el importe esperado.',
          ),
        );
        continue;
      }
      const expected = new Arithmetic(agreed.unitPrice)
        .times(quantity)
        .toFixed();
      const different =
        !new Arithmetic(line.amount).equals(expected) ||
        !new Arithmetic(line.quantity).equals(quantity) ||
        !new Arithmetic(line.unitPrice).equals(agreed.unitPrice);
      findings.push(
        finding(
          invoice,
          line,
          different ? 'PRICE_OR_QUANTITY_DIFFERENCE' : 'PRICE_MATCH',
          different
            ? 'El importe, la cantidad o el precio unitario difiere de la condición acordada.'
            : 'Precio y cantidad coinciden con el acuerdo. Esto no acredita por sí solo la prestación.',
          different ? 'confirmed' : 'matched',
          expected,
          evidence(
            agreement.evidence,
            agreed.evidence,
            ...quantityRecords.map((doc) => doc.evidence),
            ...quantityRecords.flatMap(
              (doc) => doc.equipmentQuantities?.map((q) => q.evidence) ?? [],
            ),
            ...(invoice.equipmentQuantities?.map((q) => q.evidence) ?? []),
          ),
        ),
      );
    }
  }
  if (invoices.length === 0 && findings.length === 0)
    findings.push({
      documentId: null,
      lineId: null,
      service: 'Operación',
      status: 'not-verifiable',
      code: 'INVOICE_MISSING',
      expected: null,
      invoiced: null,
      difference: null,
      currency: null,
      explanation: 'No hay facturas asociadas a esta operación.',
      evidence: [],
    });
  return { ruleVersion: LOGISTICS_RULE_VERSION, findings, agreementDecisions };
}

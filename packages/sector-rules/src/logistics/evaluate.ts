import { Decimal } from 'decimal.js';
import type {
  AnalysisDocument,
  AnalysisEvidence,
  AnalysisFinding,
  AnalysisLine,
  AnalysisResult,
  AnalysisSnapshot,
} from '@reconcile/domain';
export const LOGISTICS_RULE_VERSION = 'logistics-v1';
const Arithmetic = Decimal.clone({ precision: 128 });
const decimal = (value: string | null): value is string =>
  value !== null && /^\d{1,30}(?:\.\d{1,12})?$/.test(value);
const same = (a: string | null, b: string | null): boolean =>
  a !== null &&
  b !== null &&
  a.trim().length > 0 &&
  b.trim().length > 0 &&
  a.trim().toLowerCase() === b.trim().toLowerCase();
const validDate = (value: string | null): value is string => {
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
    currency: doc.currency,
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
/** Pure deterministic comparison; never mutates financial/accounting state. */
export function evaluateLogistics(snapshot: AnalysisSnapshot): AnalysisResult {
  const findings: AnalysisFinding[] = [];
  const documents = snapshot.documents.filter(
    (doc) => doc.operationReference === snapshot.operationReference,
  );
  for (const doc of snapshot.documents.filter(
    (item) => item.operationReference !== snapshot.operationReference,
  ))
    findings.push(
      finding(
        doc,
        null,
        'OPERATION_MISMATCH',
        'La referencia del documento no coincide con la operación.',
      ),
    );
  const invoices = documents.filter((doc) => doc.kind === 'invoice');
  const agreements = documents.filter((doc) => doc.kind === 'agreement');
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
      decimal(invoice.total) &&
      decimal(invoice.taxAmount) &&
      allAmounts.every(decimal) &&
      invoice.lines.length > 0
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
        line.service === 'unknown' ||
        !decimal(line.amount) ||
        !decimal(line.quantity) ||
        !decimal(line.unitPrice) ||
        !line.unit ||
        !invoice.currency ||
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
      const applicable = agreements.filter(
        (agreement) =>
          same(agreement.provider, invoice.provider) &&
          agreement.agreementBasis === 'accepted' &&
          agreement.evidence.length > 0 &&
          [...agreement.lines, ...agreement.excludedServices].some(
            (condition) =>
              condition.service === line.service &&
              same(condition.route, line.route),
          ) &&
          validDate(invoice.serviceDate) &&
          validDate(agreement.validFrom) &&
          validDate(agreement.validUntil) &&
          agreement.validFrom <= invoice.serviceDate &&
          invoice.serviceDate <= agreement.validUntil,
      );
      if (applicable.length !== 1) {
        findings.push(
          finding(
            invoice,
            line,
            applicable.length > 1 ? 'AGREEMENT_AMBIGUOUS' : 'AGREEMENT_MISSING',
            'Se requiere un único acuerdo aceptado y vigente para la fecha de servicio.',
          ),
        );
        continue;
      }
      const agreement = applicable[0];
      if (!agreement) continue;
      if (!same(invoice.currency, agreement.currency)) {
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
      const agreedLines = agreement.lines.filter(
        (item) => item.service === line.service && same(item.route, line.route),
      );
      const agreed = agreedLines.length === 1 ? agreedLines[0] : undefined;
      if (
        !agreed ||
        !decimal(agreed.unitPrice) ||
        !decimal(agreed.quantity) ||
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
      const expected = new Arithmetic(agreed.unitPrice)
        .times(agreed.quantity)
        .toFixed();
      const different =
        !new Arithmetic(line.amount).equals(expected) ||
        !new Arithmetic(line.quantity).equals(agreed.quantity) ||
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
          evidence(agreement.evidence, agreed.evidence),
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
  return { ruleVersion: LOGISTICS_RULE_VERSION, findings };
}

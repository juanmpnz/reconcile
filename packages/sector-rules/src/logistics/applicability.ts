import type {
  AnalysisDocument,
  AnalysisLine,
  AnalysisSnapshot,
  AgreementDecision,
} from '@reconcile/domain';
const same = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(
    a?.trim() && b?.trim() && a.trim().toLowerCase() === b.trim().toLowerCase(),
  );
export function operationContradiction(
  doc: AnalysisDocument,
  snapshot: AnalysisSnapshot,
): boolean {
  const refs = doc.references?.filter((r) => r.type === 'operation') ?? [];
  const operational =
    doc.references?.filter((r) =>
      ['booking', 'bl', 'shipment'].includes(r.type),
    ) ?? [];
  const anchor = snapshot.documents
    .filter(
      (other) =>
        other.documentId !== doc.documentId &&
        other.kind === 'operational-record' &&
        same(other.operationReference, snapshot.operationReference),
    )
    .flatMap((other) => other.references ?? []);
  const conflict = operational.some((ref) => {
    const known = anchor.filter((other) => other.type === ref.type);
    return (
      known.length > 0 && !known.some((other) => same(other.value, ref.value))
    );
  });
  return (
    conflict ||
    refs.some((r) => !same(r.value, snapshot.operationReference)) ||
    (doc.operationReference !== null &&
      !same(doc.operationReference, snapshot.operationReference))
  );
}
export function operationContext(
  snapshot: AnalysisSnapshot,
  invoice: AnalysisDocument,
) {
  const linked = snapshot.documents.filter(
    (doc) =>
      doc.kind === 'operational-record' &&
      !operationContradiction(doc, snapshot) &&
      (same(doc.operationReference, snapshot.operationReference) ||
        doc.references?.some(
          (ref) =>
            ref.type !== 'agreement' &&
            ref.type !== 'quotation' &&
            invoice.references?.some(
              (other) =>
                other.type === ref.type && same(other.value, ref.value),
            ),
        )),
  );
  const context = { ...invoice };
  for (const key of [
    'origin',
    'destination',
    'transportMode',
    'equipmentType',
    'contractingParty',
    'shipmentDate',
    'bookingDate',
    'invoiceDate',
    'serviceDate',
  ] as const) {
    if (context[key]) continue;
    const values = [
      ...new Set(
        linked
          .map((doc) => doc[key])
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    if (values.length === 1) context[key] = values[0] ?? null;
  }
  return { linked, context };
}
export function decideAgreement(
  agreement: AnalysisDocument,
  invoice: AnalysisDocument,
  line: AnalysisLine,
  snapshot: AnalysisSnapshot,
): AgreementDecision {
  const { linked, context } = operationContext(snapshot, invoice);
  const conditions: AgreementDecision['conditions'] = [];
  const add = (
    name: string,
    state: AgreementDecision['conditions'][number]['state'],
    reason: string,
    sources = agreement.evidence,
  ) => conditions.push({ name, state, reason, evidence: sources });
  const check = (
    name: string,
    expected: string | null | undefined,
    actual: string | null | undefined,
    sources = agreement.evidence,
  ) =>
    add(
      name,
      !expected || !actual
        ? 'unknown'
        : same(expected, actual)
          ? 'verified'
          : 'contradictory',
      !expected || !actual
        ? 'Falta evidencia de la condición o de la operación.'
        : 'Comparación explícita de condiciones.',
      sources,
    );
  if (operationContradiction(agreement, snapshot))
    add(
      'operation-reference',
      'contradictory',
      'El acuerdo contiene una referencia explícita de otra operación.',
    );
  for (const ref of agreement.references ?? []) {
    if (['agreement', 'quotation', 'operation'].includes(ref.type)) continue;
    const actual = [
      ...(invoice.references ?? []),
      ...linked.flatMap((d) => d.references ?? []),
    ].filter((r) => r.type === ref.type);
    add(
      `reference:${ref.type}`,
      actual.length === 0
        ? 'unknown'
        : actual.some((r) => same(r.value, ref.value))
          ? 'verified'
          : 'contradictory',
      'Las referencias se comparan únicamente dentro del mismo tipo.',
      ref.evidence,
    );
  }
  add(
    'accepted',
    agreement.agreementBasis === 'accepted' && agreement.evidence.length > 0
      ? 'verified'
      : 'unknown',
    'Se requiere evidencia de condiciones aceptadas.',
  );
  const citation = [
    ...(invoice.references ?? []),
    ...linked.flatMap((d) => d.references ?? []),
  ].filter((ref) => ref.type === 'agreement' || ref.type === 'quotation');
  const identities = [
    agreement.agreementIdentity,
    ...(agreement.references ?? [])
      .filter((ref) => ref.type === 'agreement' || ref.type === 'quotation')
      .map((ref) => ref.value),
  ].filter((value): value is string => Boolean(value));
  if (
    citation.some((ref) =>
      identities.some((identity) => same(ref.value, identity)),
    )
  )
    add(
      'agreement-citation',
      'verified',
      'La operación cita explícitamente este acuerdo; sus condiciones se verifican por separado.',
      citation.flatMap((ref) => ref.evidence),
    );
  if (
    !invoice.operationReference &&
    !(invoice.references ?? []).some(
      (ref) =>
        ref.type === 'operation' &&
        same(ref.value, snapshot.operationReference),
    ) &&
    !linked.some((doc) =>
      doc.references?.some((ref) =>
        invoice.references?.some(
          (other) => other.type === ref.type && same(other.value, ref.value),
        ),
      ),
    )
  )
    add(
      'operation-link',
      'unknown',
      'Falta evidencia de vinculación de la factura con la operación.',
    );
  for (const key of [
    'contractingParty',
    'origin',
    'destination',
    'transportMode',
    'equipmentType',
    'shipmentDate',
    'bookingDate',
  ] as const) {
    if (
      invoice[key] &&
      linked.some((doc) => doc[key] && !same(doc[key], invoice[key]))
    )
      add(
        `operation-context:${key}`,
        'contradictory',
        'Los documentos vinculados contienen datos incompatibles.',
        linked.flatMap((doc) => doc.evidence),
      );
  }
  if (
    line.equipmentType &&
    linked.some(
      (doc) =>
        doc.equipmentType && !same(doc.equipmentType, line.equipmentType),
    )
  )
    add(
      'line-equipment',
      'contradictory',
      'El equipo facturado contradice el documento operativo.',
      linked.flatMap((doc) => doc.evidence),
    );
  const model = agreement.applicability;
  if (model) {
    const facts = {
      provider: invoice.provider,
      contractingParty: context.contractingParty,
      origin: context.origin,
      destination: context.destination,
      service: line.service === 'unknown' ? null : line.service,
      transportMode: context.transportMode,
      equipmentType: line.equipmentType ?? context.equipmentType,
    };
    for (const name of [
      'provider',
      'contractingParty',
      'origin',
      'destination',
      'service',
      'transportMode',
      'equipmentType',
    ] as const) {
      const condition = model[name];
      if (condition?.state === 'unrestricted' && condition.evidence.length > 0)
        add(
          name,
          'unrestricted',
          'Ausencia de restricción documentada.',
          condition.evidence,
        );
      else if (
        condition?.state === 'restricted' &&
        condition.evidence.length > 0
      )
        check(name, condition.value, facts[name], condition.evidence);
      else add(name, 'unknown', 'No se han documentado las condiciones.');
    }
    for (const condition of model.restrictions)
      add(
        condition.name,
        condition.state === 'unrestricted' && condition.evidence.length > 0
          ? 'unrestricted'
          : 'unknown',
        'La restricción adicional requiere verificación explícita.',
        condition.evidence,
      );
  } else {
    check('provider', agreement.provider, invoice.provider);
    const routes = [...agreement.lines, ...agreement.excludedServices].filter(
      (c) => c.service === line.service,
    );
    if (routes.some((c) => same(c.route, line.route)))
      add(
        'service-route',
        'verified',
        'Servicio y ruta direccional documentados.',
      );
    else
      add(
        'service-route',
        (routes.length > 0 && line.route) ||
          (routes.length === 0 &&
            line.service !== 'unknown' &&
            agreement.lines.some((item) => item.service !== 'unknown'))
          ? 'contradictory'
          : 'unknown',
        'Servicio o ruta no acreditados o incompatibles.',
      );
  }
  const basis = model?.dateBasis ?? 'service-date';
  const date =
    basis === 'service-date'
      ? context.serviceDate
      : basis === 'shipment-date'
        ? context.shipmentDate
        : basis === 'booking-date'
          ? context.bookingDate
          : basis === 'invoice-date'
            ? context.invoiceDate
            : null;
  const calendar = (value: string | null | undefined) =>
    Boolean(
      value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(new Date(value + 'T00:00:00Z').getTime()) &&
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value,
    );
  add(
    'validity',
    !calendar(date) ||
      !calendar(agreement.validFrom) ||
      !calendar(agreement.validUntil) ||
      !date ||
      !agreement.validFrom ||
      !agreement.validUntil
      ? 'unknown'
      : agreement.validFrom <= date && date <= agreement.validUntil
        ? 'verified'
        : 'contradictory',
    `Vigencia evaluada con ${basis}; no se sustituye la fecha exigida.`,
  );
  const state = conditions.some((c) => c.state === 'contradictory')
    ? 'not-applicable'
    : conditions.some((c) => c.state === 'unknown')
      ? 'pending'
      : 'applicable';
  return {
    invoiceDocumentId: invoice.documentId,
    lineId: line.id,
    agreementDocumentId: agreement.documentId,
    agreementVersionId: agreement.revisionId ?? agreement.extractionRunId,
    state,
    reason:
      state === 'applicable'
        ? 'Condiciones verificadas.'
        : state === 'pending'
          ? 'Falta evidencia para confirmar aplicabilidad.'
          : 'Existen condiciones explícitamente incompatibles.',
    conditions,
    evidence: [
      ...agreement.evidence,
      ...invoice.evidence,
      ...linked.flatMap((d) => d.evidence),
    ],
  };
}

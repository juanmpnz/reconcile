import type { AnalysisLine } from '@reconcile/domain';

const text = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\borig\b/g, 'origin')
    .replace(/\bdest\b/g, 'destination');

/** Explicit bilingual aliases only; unknown descriptions never match by amount or similarity. */
const aliases: Record<string, string> = {
  'ocean freight': 'ocean-freight',
  'sea freight': 'ocean-freight',
  'flete maritimo': 'ocean-freight',
  flete: 'base-freight',
  freight: 'base-freight',
  ohc: 'origin-handling',
  'origin handling charge': 'origin-handling',
  'origin terminal handling': 'origin-handling',
  'terminal handling origin': 'origin-handling',
  'thc origin': 'origin-handling',
  'origin thc': 'origin-handling',
  'terminal handling charge origin': 'origin-handling',
  'manipulacion origin': 'origin-handling',
  'manipulacion en origen': 'origin-handling',
  'thc origen': 'origin-handling',
  'manipulacion origen': 'origin-handling',
  'gastos de manipulacion en origen': 'origin-handling',
  dhc: 'destination-handling',
  'destination handling charge': 'destination-handling',
  'destination terminal handling': 'destination-handling',
  'terminal handling destination': 'destination-handling',
  'thc destination': 'destination-handling',
  'destination thc': 'destination-handling',
  'terminal handling charge destination': 'destination-handling',
  'manipulacion destination': 'destination-handling',
  'manipulacion en destino': 'destination-handling',
  'thc destino': 'destination-handling',
  'manipulacion destino': 'destination-handling',
  'gastos de manipulacion en destino': 'destination-handling',
  documentation: 'documentation',
  'documentation fee': 'documentation',
  documentacion: 'documentation',
  'gastos documentales': 'documentation',
  'bill of lading fee': 'documentation',
  'bl fee': 'documentation',
  'seal fee': 'seal',
  precinto: 'seal',
  'gastos de precinto': 'seal',
  lumpsum: 'base-freight',
  'lump sum': 'base-freight',
  'origin wharfage': 'origin-wharfage',
  'wharfage origin': 'origin-wharfage',
  'muellaje origen': 'origin-wharfage',
  'muellaje en origen': 'origin-wharfage',
  'origin equipment transfer': 'origin-equipment-transfer',
  'equipment transfer origin': 'origin-equipment-transfer',
  'traslado equipo origen': 'origin-equipment-transfer',
  'traslado de equipo en origen': 'origin-equipment-transfer',
  'carrier security fee': 'carrier-security',
  'carr security fee': 'carrier-security',
  'cargo seguridad naviera': 'carrier-security',
  'marine fuel recovery': 'marine-fuel-recovery',
  'marinefuel recovery': 'marine-fuel-recovery',
  'marinefuel recover': 'marine-fuel-recovery',
  'marine fuel recover': 'marine-fuel-recovery',
  mfr: 'marine-fuel-recovery',
  'recuperacion combustible marino': 'marine-fuel-recovery',
  'emission allowance': 'emission-allowance',
  'emissions allowance': 'emission-allowance',
  'eu emission allowance': 'emission-allowance',
  'eu emiss allowance': 'emission-allowance',
  'derechos de emision': 'emission-allowance',
  'equipment maintenance': 'equipment-maintenance',
  'equipment maintenance fee': 'equipment-maintenance',
  'mantenimiento equipo': 'equipment-maintenance',
  'mantenimiento de equipo': 'equipment-maintenance',
  'import service': 'import-service',
  'import service fee': 'import-service',
  'servicio importacion': 'import-service',
  'servicio de importacion': 'import-service',
  baf: 'bunker-adjustment',
  'bunker adjustment factor': 'bunker-adjustment',
  'recargo combustible': 'bunker-adjustment',
};
export function canonicalConcept(line: AnalysisLine): string | null {
  return aliases[text(line.chargeKey ?? line.description)] ?? null;
}
export function canonicalEquipment(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const key = text(value).replace(/ /g, '');
  const equipment: Record<string, string> = {
    '20std': '20STD',
    '20dv': '20STD',
    '20gp': '20STD',
    '40std': '40STD',
    '40dv': '40STD',
    '40gp': '40STD',
    '40hc': '40HC',
    '40hq': '40HC',
  };
  return equipment[key] ?? null;
}
export function canonicalBillingUnit(line: AnalysisLine): string | null {
  if (line.billingBasis && !['unknown', 'other'].includes(line.billingBasis))
    return line.billingBasis;
  const units: Record<string, string> = {
    container: 'container',
    contenedor: 'container',
    cntr: 'container',
    bl: 'bl',
    'bill of lading': 'bl',
    shipment: 'shipment',
    envio: 'shipment',
  };
  return line.unit ? (units[text(line.unit)] ?? null) : null;
}

export function compatibleConcepts(a: AnalysisLine, b: AnalysisLine): boolean {
  const left = canonicalConcept(a),
    right = canonicalConcept(b);
  return Boolean(
    left &&
    right &&
    (left === right ||
      ([left, right].includes('base-freight') &&
        [left, right].includes('ocean-freight'))),
  );
}

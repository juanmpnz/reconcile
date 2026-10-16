import { agreementDateSchema } from '@reconcile/contracts';
import type { AgreementTerms, AgreementVersion } from '@reconcile/contracts';
export function pricingLabel(pricing: AgreementTerms['pricing']): string {
  if (pricing.type === 'fixed-trip') return `${pricing.amount} por viaje`;
  if (pricing.type === 'per-km') return `${pricing.amount} por km`;
  return pricing.bands
    .map(
      (band) =>
        `[${band.fromKm}, ${band.toKm}) km: ${band.amount} ${band.basis === 'per-km' ? 'por km' : 'por viaje'}`,
    )
    .join(' · ');
}
function scaledDistance(value: string): bigint | null {
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(value)) return null;
  const [integer = '0', fraction = ''] = value.split('.');
  return BigInt(integer) * 100000000n + BigInt(fraction.padEnd(8, '0'));
}
export function applicabilityNotes(
  agreement: AgreementVersion,
  provider: string | null,
  currency: string | null,
  date: string,
  route: string,
  distance: string,
): string[] {
  const notes: string[] = [];
  if (agreement.terms.agreementBasis !== 'accepted')
    notes.push('El acuerdo no está confirmado como aceptado por las partes.');
  if (!provider) notes.push('Falta revisar el proveedor de la factura.');
  else if (
    provider.trim().toLowerCase() !==
    agreement.terms.provider.trim().toLowerCase()
  )
    notes.push('El proveedor de la factura no coincide con el acuerdo.');
  if (!currency || currency !== agreement.terms.currency)
    notes.push('Falta revisar la moneda o no coincide con el acuerdo.');
  if (!agreementDateSchema.safeParse(date).success)
    notes.push('Falta una fecha válida del servicio.');
  else if (
    date < agreement.terms.validFrom ||
    date > agreement.terms.validUntil
  )
    notes.push('La fecha está fuera de la vigencia del acuerdo.');
  if (
    !route ||
    route.trim().toLowerCase() !== agreement.terms.route.trim().toLowerCase()
  )
    notes.push('La ruta o ámbito no coincide con el acuerdo.');
  const distanceValue = scaledDistance(distance);
  if (
    agreement.terms.pricing.type !== 'fixed-trip' &&
    (distanceValue === null || distanceValue <= 0n)
  )
    notes.push('Falta una distancia positiva revisada.');
  if (
    agreement.terms.pricing.type === 'distance-bands' &&
    distanceValue !== null &&
    distanceValue > 0n &&
    !agreement.terms.pricing.bands.some((band) => {
      const from = scaledDistance(band.fromKm),
        to = scaledDistance(band.toKm);
      return (
        from !== null &&
        to !== null &&
        distanceValue >= from &&
        distanceValue < to
      );
    })
  )
    notes.push('La distancia no tiene un tramo tarifario.');
  return notes;
}

import { z } from 'zod';
import {
  agreementCreateSchema,
  agreementListSchema,
  agreementVersionSchema,
  operationAgreementsSchema,
  operationDetailSchema,
} from '@reconcile/contracts';
import { organizationKey } from '../organizations/queries';
export const agreementsKey = (userId: string, organizationId: string) => [
  ...organizationKey(userId, organizationId),
  'agreements',
];
const endpoint = (organizationId: string) =>
  `/api/v1/organizations/${encodeURIComponent(organizationId)}/agreements`;
export class AgreementConflictError extends Error {}
async function request<T>(
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit,
) {
  const response = await fetch(url, { ...init, credentials: 'include' });
  if (response.status === 409)
    throw new AgreementConflictError(
      'Los datos cambiaron o hay un análisis activo. Recargá y revisá tu selección antes de guardar.',
    );
  if (response.status === 422 || response.status === 400) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = z.object({ code: z.string().max(100) }).safeParse(body);
    const messages: Record<string, string> = {
      AGREEMENT_OUTSIDE_VALIDITY:
        'La fecha del servicio está fuera de la vigencia. Elegí otro acuerdo o corregí la fecha revisada.',
      AGREEMENT_ROUTE_MISMATCH:
        'El ámbito no coincide con el acuerdo o con la factura. Revisá los datos antes de seleccionar.',
      AGREEMENT_DISTANCE_REQUIRED:
        'Indicá una distancia positiva revisada para la tarifa por kilómetros o tramos.',
      AGREEMENT_PROVIDER_MISMATCH:
        'El proveedor de la factura no coincide con el acuerdo. Seleccioná el acuerdo correcto o revisá los datos de la factura.',
      AGREEMENT_CURRENCY_MISMATCH:
        'La moneda de la factura no coincide con el acuerdo. No se aplica conversión automática.',
      AGREEMENT_DATE_MISMATCH:
        'La fecha seleccionada no coincide con la fecha revisada de la factura.',
      INVALID_AGREEMENT_EVIDENCE:
        'La cita no corresponde al texto de la página original. Revisá la evidencia.',
    };
    throw new Error(
      parsed.success
        ? (messages[parsed.data.code] ??
            'Revisá los campos, las vigencias y la evidencia del PDF.')
        : 'Revisá los campos, las vigencias y la evidencia del PDF.',
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 404
        ? 'El acuerdo no está disponible o cambió tu acceso.'
        : response.status === 400 || response.status === 422
          ? 'Revisá los campos, las vigencias y la evidencia del PDF.'
          : 'No se pudo completar la solicitud. Volvé a intentar.',
    );
  const body: unknown = await response.json();
  const result = schema.safeParse(body);
  if (!result.success)
    throw new Error(
      'La respuesta de acuerdos no es válida. Recargá los datos.',
    );
  return result.data;
}
export async function listAgreements(
  organizationId: string,
  page: number,
  signal: AbortSignal,
) {
  const result = await request(
    `${endpoint(organizationId)}?limit=25&offset=${page * 25}`,
    agreementListSchema,
    { signal },
  );
  if (result.items.some((item) => item.organizationId !== organizationId))
    throw new Error('La respuesta no corresponde a esta organización.');
  return result;
}
export async function createAgreement(
  organizationId: string,
  input: z.infer<typeof agreementCreateSchema>,
) {
  const result = await request(
    endpoint(organizationId),
    agreementVersionSchema,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(agreementCreateSchema.parse(input)),
    },
  );
  if (result.organizationId !== organizationId)
    throw new Error('La respuesta no corresponde a esta organización.');
  return result;
}
export async function setOperationAgreements(
  organizationId: string,
  operationId: string,
  input: z.infer<typeof operationAgreementsSchema>,
) {
  const result = await request(
    `/api/v1/organizations/${encodeURIComponent(organizationId)}/operations/${encodeURIComponent(operationId)}/agreements`,
    operationDetailSchema,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(operationAgreementsSchema.parse(input)),
    },
  );
  if (result.organizationId !== organizationId || result.id !== operationId)
    throw new Error('La respuesta no corresponde a esta operación.');
  return result;
}

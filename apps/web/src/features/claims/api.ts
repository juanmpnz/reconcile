import {
  httpFetch,
  HttpError,
  parseHttpResponse,
  readHttpJson,
} from '../../lib/http';
import { z } from 'zod';
import {
  claimCreateInputSchema,
  claimRebaseInputSchema,
  claimDetailSchema,
  claimDraftInputSchema,
  claimEventInputSchema,
  findingDecisionInputSchema,
  operationReviewSchema,
} from '@reconcile/contracts';
import { organizationKey } from '../organizations/queries';
export const reviewKey = (
  userId: string,
  organizationId: string,
  operationId: string,
) => [...organizationKey(userId, organizationId), 'review', operationId];
const base = (organizationId: string, operationId: string) =>
  `/api/v1/organizations/${encodeURIComponent(organizationId)}/operations/${encodeURIComponent(operationId)}`;
export class ClaimConflictError extends HttpError {
  constructor(
    override readonly code: string,
    message: string,
  ) {
    super(409, message, code);
  }
}
const errorMessages: Record<string, string> = {
  STALE_OPERATION:
    'Los datos de la operación cambiaron. Recargá y revisá antes de continuar.',
  STALE_ANALYSIS:
    'El análisis o sus fuentes cambiaron. Revisá la ejecución actual antes de emitir una solicitud.',
  REVIEW_CHANGED:
    'La última decisión cambió. Confirmá y actualizá el respaldo antes de emitir otra solicitud.',
  CONFIRMED_REVIEW_REQUIRED:
    'Confirmá el hallazgo con un motivo antes de preparar o emitir una solicitud.',
  STALE_REVIEW:
    'Otra persona cambió la revisión. Recargá y revisá tu borrador.',
  CONCURRENT_UPDATE: 'Los datos cambiaron. Recargá antes de volver a guardar.',
  STALE_CLAIM:
    'El reclamo cambió. Recargá y compará tu borrador antes de guardar.',
  CLAIM_NOT_CURRENT:
    'La confirmación o las fuentes cambiaron. Este reclamo se conserva como histórico y requiere revisión.',
  CLAIM_EXISTS:
    'Ya existe un reclamo para este cargo. Consultá el reclamo existente.',
  DECISION_REQUIRED:
    'Confirmá el hallazgo con un motivo antes de preparar el reclamo.',
  FINDING_NOT_ELIGIBLE:
    'Este control no permite preparar una solicitud monetaria. Revisá el resultado y sus fuentes.',
};
async function checked(response: Response) {
  if (response.ok) return response;
  const body: unknown = await response.json().catch(() => null);
  const parsed = z.object({ code: z.string().max(100) }).safeParse(body);
  const code = parsed.success ? parsed.data.code : '';
  const message = Object.hasOwn(errorMessages, code)
    ? (errorMessages[code] ?? 'No se pudo completar la acción.')
    : response.status === 401
      ? 'Tu sesión expiró. Volvé a iniciar sesión.'
      : response.status === 403 || response.status === 404
        ? 'No tenés acceso a esta revisión o reclamo.'
        : response.status === 409
          ? 'Los datos cambiaron o esta acción necesita una revisión previa. Recargá y revisá antes de reintentar.'
          : response.status === 400 || response.status === 422
            ? 'Revisá la decisión, los campos y las fechas antes de guardar.'
            : 'No pudimos completar la acción. Volvé a intentar.';
  if (response.status === 409) throw new ClaimConflictError(code, message);
  throw new HttpError(response.status, message, code);
}
const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  credentials: 'include',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
async function request(url: string, init: RequestInit = {}) {
  const response = await checked(
    await httpFetch(url, { ...init, credentials: 'include' }),
  );
  const body: unknown = await readHttpJson(
    response,
    'La respuesta de revisiones no es válida. Recargá y volvé a intentar.',
  );
  return body;
}
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  return parseHttpResponse(
    schema,
    body,
    'La respuesta de revisiones no es válida. Recargá y volvé a intentar.',
  );
}
export async function getReview(
  organizationId: string,
  operationId: string,
  signal: AbortSignal,
) {
  const result = parse(
    operationReviewSchema,
    await request(`${base(organizationId, operationId)}/review`, { signal }),
  );
  if (
    result.organizationId !== organizationId ||
    result.operationId !== operationId ||
    result.claims.some(
      (claim) =>
        claim.organizationId !== organizationId ||
        claim.operationId !== operationId,
    )
  )
    throw new Error('La revisión no corresponde a esta operación.');
  return result;
}
export async function decideFinding(
  organizationId: string,
  operationId: string,
  runId: string,
  input: z.infer<typeof findingDecisionInputSchema>,
) {
  await request(
    `${base(organizationId, operationId)}/analyses/${encodeURIComponent(runId)}/decisions`,
    json(findingDecisionInputSchema.parse(input)),
  );
}
function checkedClaim(
  body: unknown,
  organizationId: string,
  operationId: string,
  claimId?: string,
) {
  const claim = parse(claimDetailSchema, body);
  if (
    claim.organizationId !== organizationId ||
    claim.operationId !== operationId ||
    claim.snapshot.organizationId !== organizationId ||
    (claimId && claim.id !== claimId)
  )
    throw new Error('El reclamo no corresponde a esta operación.');
  return claim;
}
export async function createClaim(
  organizationId: string,
  operationId: string,
  input: z.infer<typeof claimCreateInputSchema>,
) {
  return checkedClaim(
    await request(
      `${base(organizationId, operationId)}/claims`,
      json(claimCreateInputSchema.parse(input)),
    ),
    organizationId,
    operationId,
  );
}
export async function getClaim(
  organizationId: string,
  operationId: string,
  claimId: string,
  signal: AbortSignal,
) {
  return checkedClaim(
    await request(
      `${base(organizationId, operationId)}/claims/${encodeURIComponent(claimId)}`,
      { signal },
    ),
    organizationId,
    operationId,
    claimId,
  );
}
export async function saveClaim(
  organizationId: string,
  operationId: string,
  claimId: string,
  input: z.infer<typeof claimDraftInputSchema>,
) {
  return checkedClaim(
    await request(
      `${base(organizationId, operationId)}/claims/${encodeURIComponent(claimId)}`,
      json(claimDraftInputSchema.parse(input), 'PATCH'),
    ),
    organizationId,
    operationId,
    claimId,
  );
}
export async function recordEvent(
  organizationId: string,
  operationId: string,
  claimId: string,
  input: z.infer<typeof claimEventInputSchema>,
) {
  return checkedClaim(
    await request(
      `${base(organizationId, operationId)}/claims/${encodeURIComponent(claimId)}/events`,
      json(claimEventInputSchema.parse(input)),
    ),
    organizationId,
    operationId,
    claimId,
  );
}
export async function exportClaim(
  organizationId: string,
  operationId: string,
  claimId: string,
  expectedVersion: number,
  format: 'text' | 'dossier',
) {
  const response = await checked(
    await httpFetch(
      `${base(organizationId, operationId)}/claims/${encodeURIComponent(claimId)}/export`,
      json({ expectedVersion, format }),
    ),
  );
  return response.blob();
}
export async function rebaseClaim(
  organizationId: string,
  operationId: string,
  claimId: string,
  input: z.infer<typeof claimRebaseInputSchema>,
) {
  return checkedClaim(
    await request(
      `${base(organizationId, operationId)}/claims/${encodeURIComponent(claimId)}/rebase`,
      json(claimRebaseInputSchema.parse(input)),
    ),
    organizationId,
    operationId,
    claimId,
  );
}
export async function downloadClaimExport(
  organizationId: string,
  operationId: string,
  claimId: string,
  exportId: string,
) {
  const response = await checked(
    await httpFetch(
      `${base(organizationId, operationId)}/claims/${encodeURIComponent(claimId)}/exports/${encodeURIComponent(exportId)}`,
      { credentials: 'include' },
    ),
  );
  return response.blob();
}

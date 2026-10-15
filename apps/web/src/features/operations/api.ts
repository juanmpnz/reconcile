import type { z } from 'zod';
import {
  analysisRunSchema,
  analysisHistorySchema,
  factRevisionInputSchema,
  operationCreateSchema,
  operationDetailSchema,
  operationDocumentsSchema,
  operationListSchema,
} from '@reconcile/contracts';
import type { AnalysisDocumentInput } from '@reconcile/contracts';
import { organizationKey } from '../organizations/queries';
export const operationsKey = (userId: string, organizationId: string) => [
  ...organizationKey(userId, organizationId),
  'operations',
];
export const operationPath = (organizationId: string, operationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}/operations/${encodeURIComponent(operationId)}`;
const endpoint = (organizationId: string, operationId?: string) =>
  `/api/v1/organizations/${encodeURIComponent(organizationId)}/operations${operationId ? `/${encodeURIComponent(operationId)}` : ''}`;
async function request(url: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, credentials: 'include' });
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Tu sesión expiró. Volvé a iniciar sesión.'
        : response.status === 403 || response.status === 404
          ? 'La operación no está disponible o cambió tu acceso.'
          : response.status === 409
            ? 'Los datos cambiaron o ya hay un análisis activo. Actualizá antes de reintentar.'
            : response.status === 400 || response.status === 422
              ? 'Revisá los campos y la evidencia de los documentos.'
              : 'No pudimos completar la solicitud. Volvé a intentar.',
    );
  const body: unknown = await response.json().catch(() => {
    throw new Error(
      'La respuesta del servicio no es válida. Volvé a intentar.',
    );
  });
  return body;
}
function parseResponse<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new Error(
      'La respuesta del servicio no es válida. Actualizá o volvé a intentar.',
    );
  return parsed.data;
}
const json = (body: unknown, method = 'POST'): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
export async function listOperations(
  organizationId: string,
  page: number,
  signal: AbortSignal,
) {
  const result = parseResponse(
    operationListSchema,
    await request(`${endpoint(organizationId)}?limit=25&offset=${page * 25}`, {
      signal,
    }),
  );
  if (result.items.some((item) => item.organizationId !== organizationId))
    throw new Error('La respuesta no corresponde a esta organización.');
  return result;
}
export async function getOperation(
  organizationId: string,
  operationId: string,
  signal: AbortSignal,
) {
  const result = parseResponse(
    operationDetailSchema,
    await request(endpoint(organizationId, operationId), { signal }),
  );
  if (
    result.id !== operationId ||
    result.organizationId !== organizationId ||
    result.analyses.some(
      (run) =>
        run.operationId !== operationId ||
        run.organizationId !== organizationId ||
        run.snapshot.organizationId !== organizationId,
    )
  )
    throw new Error('La respuesta no corresponde a la operación solicitada.');
  return result;
}
export async function createOperation(
  organizationId: string,
  input: { reference: string; name: string },
) {
  const result = parseResponse(
    operationDetailSchema,
    await request(
      endpoint(organizationId),
      json(operationCreateSchema.parse(input)),
    ),
  );
  if (result.organizationId !== organizationId)
    throw new Error('La respuesta no corresponde a esta organización.');
  return result;
}
export async function linkDocuments(
  organizationId: string,
  operationId: string,
  documentIds: string[],
) {
  await request(
    `${endpoint(organizationId, operationId)}/documents`,
    json(operationDocumentsSchema.parse({ documentIds }), 'PUT'),
  );
}
export async function saveFacts(
  organizationId: string,
  operationId: string,
  expectedFingerprint: string,
  document: AnalysisDocumentInput,
  reason: string,
) {
  await request(
    `${endpoint(organizationId, operationId)}/fact-revisions`,
    json(
      factRevisionInputSchema.parse({ expectedFingerprint, document, reason }),
    ),
  );
}
export async function requestAnalysis(
  organizationId: string,
  operationId: string,
  idempotencyKey: string,
) {
  const run = parseResponse(
    analysisRunSchema,
    await request(
      `${endpoint(organizationId, operationId)}/analyses`,
      json({ idempotencyKey }),
    ),
  );
  if (
    run.organizationId !== organizationId ||
    run.operationId !== operationId ||
    run.snapshot.organizationId !== organizationId
  )
    throw new Error('El análisis no corresponde a esta operación.');
  return run;
}

export async function listAnalysisHistory(
  organizationId: string,
  operationId: string,
  page: number,
  signal: AbortSignal,
) {
  const result = parseResponse(
    analysisHistorySchema,
    await request(
      `${endpoint(organizationId, operationId)}/analyses?limit=25&offset=${page * 25}`,
      { signal },
    ),
  );
  if (
    result.items.some(
      (run) =>
        run.organizationId !== organizationId ||
        run.operationId !== operationId,
    )
  )
    throw new Error('El historial no corresponde a esta operación.');
  return result;
}
export async function getAnalysis(
  organizationId: string,
  operationId: string,
  runId: string,
  signal: AbortSignal,
) {
  const run = parseResponse(
    analysisRunSchema,
    await request(
      `${endpoint(organizationId, operationId)}/analyses/${encodeURIComponent(runId)}`,
      { signal },
    ),
  );
  if (
    run.id !== runId ||
    run.organizationId !== organizationId ||
    run.operationId !== operationId ||
    run.snapshot.organizationId !== organizationId
  )
    throw new Error('El análisis no corresponde a esta operación.');
  return run;
}

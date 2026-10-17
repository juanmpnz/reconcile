import {
  httpFetch,
  HttpError,
  parseHttpResponse,
  readHttpJson,
} from '../../lib/http';
import { z } from 'zod';
import {
  correctionInputSchema,
  documentDetailSchema,
  documentListSchema,
  documentListQuerySchema,
  documentMetadataInputSchema,
} from '@reconcile/contracts';
import type {
  CorrectionInput,
  DocumentKind,
  DocumentStatus,
} from '@reconcile/contracts';
import { organizationKey } from '../organizations/queries';
export function documentsKey(userId: string, organizationId: string) {
  return [...organizationKey(userId, organizationId), 'documents'];
}
export function documentsEndpoint(organizationId: string, documentId?: string) {
  return `/api/v1/organizations/${encodeURIComponent(organizationId)}/documents${documentId ? `/${encodeURIComponent(documentId)}` : ''}`;
}
export function documentPath(organizationId: string, documentId: string) {
  return `/organizations/${encodeURIComponent(organizationId)}/documents/${encodeURIComponent(documentId)}`;
}
export class DocumentConflictError extends HttpError {
  constructor(
    override readonly code: string,
    message: string,
  ) {
    super(409, message, code);
  }
}
function parseDocumentResponse<T>(schema: z.ZodType<T>, body: unknown): T {
  return parseHttpResponse(
    schema,
    body,
    'La respuesta de documentos no es válida. Recargá y volvé a intentar.',
  );
}
async function checked(response: Response) {
  if (response.status === 409) {
    const body: unknown = await response.json().catch(() => null);
    const code = z.object({ code: z.string().max(100) }).safeParse(body);
    throw new DocumentConflictError(
      code.success ? code.data.code : 'CONFLICT',
      'El documento cambió. Recargá los datos y revisá tu borrador antes de guardar.',
    );
  }
  if (!response.ok)
    throw new HttpError(
      response.status,
      response.status === 401
        ? 'Tu sesión expiró. Volvé a iniciar sesión.'
        : response.status === 403 || response.status === 404
          ? 'No tenés acceso a este documento o ya no está disponible.'
          : response.status === 413
            ? 'El archivo supera el máximo de 10 MiB.'
            : response.status === 415
              ? 'El archivo debe ser un PDF válido.'
              : response.status === 409
                ? 'El documento ya existe o cambió mientras lo editabas. Actualizá los datos antes de volver a intentar.'
                : response.status === 422 || response.status === 400
                  ? 'El servicio rechazó los datos. Revisá el archivo y los campos enviados.'
                  : 'No pudimos completar la solicitud. Volvé a intentar.',
    );
  return response;
}
export async function listDocuments(
  organizationId: string,
  page: number,
  signal: AbortSignal,
  options: Partial<DocumentListOptions> = {},
) {
  const { limit: requestedLimit, ...query } = options;
  const limit = z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .parse(requestedLimit);
  const filters = documentListQuerySchema.parse(query);
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(page * limit),
    ...filters,
  });
  const response = await checked(
    await httpFetch(`${documentsEndpoint(organizationId)}?${params}`, {
      signal,
      credentials: 'include',
    }),
  );
  const result = parseDocumentResponse(
    documentListSchema,
    await readHttpJson(
      response,
      'La respuesta de documentos no es válida. Recargá y volvé a intentar.',
    ),
  );
  if (result.items.some((item) => item.organizationId !== organizationId))
    throw new Error('La respuesta no corresponde a esta organización.');
  return result;
}
export async function getDocument(
  organizationId: string,
  documentId: string,
  signal: AbortSignal,
) {
  const response = await checked(
    await httpFetch(documentsEndpoint(organizationId, documentId), {
      signal,
      credentials: 'include',
    }),
  );
  const result = parseDocumentResponse(
    documentDetailSchema,
    await readHttpJson(
      response,
      'La respuesta de documentos no es válida. Recargá y volvé a intentar.',
    ),
  );
  if (result.id !== documentId || result.organizationId !== organizationId)
    throw new Error('La respuesta no corresponde al documento solicitado.');
  return result;
}
export async function uploadDocument(
  organizationId: string,
  file: File,
  kind: DocumentKind,
) {
  const response = await checked(
    await httpFetch(documentsEndpoint(organizationId), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/pdf',
        'x-document-filename': encodeURIComponent(file.name),
        'x-document-kind': kind,
      },
      body: file,
    }),
  );
  const result = parseDocumentResponse(
    documentDetailSchema,
    await readHttpJson(
      response,
      'La respuesta de documentos no es válida. Recargá y volvé a intentar.',
    ),
  );
  if (result.organizationId !== organizationId)
    throw new Error('La respuesta no corresponde a esta organización.');
  return result;
}
export async function retryDocument(
  organizationId: string,
  documentId: string,
) {
  await checked(
    await httpFetch(`${documentsEndpoint(organizationId, documentId)}/retry`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }),
  );
}
export async function correctDocument(
  organizationId: string,
  documentId: string,
  input: CorrectionInput,
) {
  await checked(
    await httpFetch(
      `${documentsEndpoint(organizationId, documentId)}/corrections`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(correctionInputSchema.parse(input)),
      },
    ),
  );
}
export async function downloadDocument(
  organizationId: string,
  documentId: string,
) {
  const response = await checked(
    await httpFetch(
      `${documentsEndpoint(organizationId, documentId)}/download`,
      {
        credentials: 'include',
      },
    ),
  );
  return response.blob();
}
export function saveOriginal(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const kindLabels: Record<DocumentKind, string> = {
  invoice: 'Factura',
  tariff: 'Tarifa',
  quotation: 'Cotización',
  operational: 'Registro operativo',
  other: 'Otro',
};
export const statusLabels: Record<DocumentStatus, string> = {
  queued: 'En espera',
  processing: 'Extrayendo texto',
  needs_review: 'Requiere revisión',
  ready: 'Extracción completada',
  failed: 'Error de extracción',
  blocked: 'Procesamiento bloqueado',
};
export function isProcessing(status: DocumentStatus) {
  return status === 'queued' || status === 'processing';
}
export function bytesLabel(size: number) {
  return size >= 1024 * 1024
    ? `${(size / (1024 * 1024)).toFixed(1)} MiB`
    : `${Math.max(1, Math.ceil(size / 1024))} KiB`;
}
export function timestampLabel(value: string) {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export async function updateDocumentMetadata(
  organizationId: string,
  documentId: string,
  input: z.infer<typeof documentMetadataInputSchema>,
) {
  const response = await checked(
    await httpFetch(documentsEndpoint(organizationId, documentId), {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(documentMetadataInputSchema.parse(input)),
    }),
  );
  const result = parseDocumentResponse(
    documentDetailSchema,
    await readHttpJson(
      response,
      'La respuesta de documentos no es válida. Recargá y volvé a intentar.',
    ),
  );
  if (result.organizationId !== organizationId || result.id !== documentId)
    throw new Error('La respuesta no corresponde al documento solicitado.');
  return result;
}
export type DocumentListOptions = z.infer<typeof documentListQuerySchema> & {
  limit?: number;
};

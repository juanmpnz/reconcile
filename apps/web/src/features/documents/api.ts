import {
  correctionInputSchema,
  documentDetailSchema,
  documentListSchema,
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
async function checked(response: Response) {
  if (!response.ok)
    throw new Error(
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
) {
  const response = await checked(
    await fetch(
      `${documentsEndpoint(organizationId)}?limit=25&offset=${page * 25}`,
      { signal, credentials: 'include' },
    ),
  );
  const result = documentListSchema.parse(await response.json());
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
    await fetch(documentsEndpoint(organizationId, documentId), {
      signal,
      credentials: 'include',
    }),
  );
  const result = documentDetailSchema.parse(await response.json());
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
    await fetch(documentsEndpoint(organizationId), {
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
  const result = documentDetailSchema.parse(await response.json());
  if (result.organizationId !== organizationId)
    throw new Error('La respuesta no corresponde a esta organización.');
  return result;
}
export async function retryDocument(
  organizationId: string,
  documentId: string,
) {
  await checked(
    await fetch(`${documentsEndpoint(organizationId, documentId)}/retry`, {
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
    await fetch(
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
    await fetch(`${documentsEndpoint(organizationId, documentId)}/download`, {
      credentials: 'include',
    }),
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

import { httpFetch, HttpError, readHttpJson } from '../../lib/http';
import { dashboardSchema } from '@reconcile/contracts';
export async function getDashboard(
  organizationId: string,
  signal: AbortSignal,
) {
  const response = await httpFetch(
    `/api/v1/organizations/${encodeURIComponent(organizationId)}/dashboard`,
    { credentials: 'include', signal },
  );
  if (!response.ok)
    throw new HttpError(
      response.status,
      response.status === 401
        ? 'Tu sesión expiró.'
        : response.status === 403 || response.status === 404
          ? 'No tenés acceso al resumen de esta organización.'
          : 'No pudimos cargar el resumen. Volvé a intentar.',
    );
  const body: unknown = await readHttpJson(
    response,
    'La respuesta del resumen no es válida. Volvé a intentar.',
  );
  const parsed = dashboardSchema.safeParse(body);
  if (!parsed.success)
    throw new Error('La respuesta del resumen no es válida. Volvé a intentar.');
  if (parsed.data.organizationId !== organizationId)
    throw new Error('El resumen no corresponde a esta organización.');
  return parsed.data;
}

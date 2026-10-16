import { dashboardSchema } from '@reconcile/contracts';
export async function getDashboard(
  organizationId: string,
  signal: AbortSignal,
) {
  const response = await fetch(
    `/api/v1/organizations/${encodeURIComponent(organizationId)}/dashboard`,
    { credentials: 'include', signal },
  );
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Tu sesión expiró.'
        : response.status === 403 || response.status === 404
          ? 'No tenés acceso al resumen de esta organización.'
          : 'No pudimos cargar el resumen. Volvé a intentar.',
    );
  const body: unknown = await response.json();
  const parsed = dashboardSchema.safeParse(body);
  if (!parsed.success)
    throw new Error('La respuesta del resumen no es válida. Volvé a intentar.');
  if (parsed.data.organizationId !== organizationId)
    throw new Error('El resumen no corresponde a esta organización.');
  return parsed.data;
}

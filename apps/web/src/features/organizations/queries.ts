import { z } from 'zod';
import { authClient } from '../../lib/auth';
export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
});
export type Organization = z.infer<typeof organizationSchema>;
export const contextSchema = z.object({
  organization: organizationSchema,
  membership: z.object({ role: z.string() }),
  capabilities: z.object({
    canInviteMembers: z.boolean(),
    canWriteDocuments: z.boolean(),
    canManageMembers: z.boolean(),
    canManageOrganization: z.boolean(),
  }),
});
export type OrganizationContext = z.infer<typeof contextSchema>;
const dateSchema = z
  .union([z.string(), z.date()])
  .transform((value) => new Date(value))
  .pipe(z.date());
export const membersSchema = z.object({
  members: z.array(
    z.object({
      id: z.string(),
      organizationId: z.string(),
      userId: z.string(),
      role: z.string(),
      user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
    }),
  ),
  total: z.number().int().nonnegative(),
});
export const invitationsSchema = z.array(
  z.object({
    id: z.string(),
    organizationId: z.string(),
    email: z.string(),
    role: z.string(),
    status: z.string(),
    expiresAt: dateSchema,
    createdAt: dateSchema,
  }),
);
export function identityKey(userId: string) {
  return ['identity', userId, 'organizations'];
}
export function organizationKey(userId: string, organizationId: string) {
  return ['identity', userId, 'organizations', organizationId];
}
export async function listOrganizations() {
  const result = await authClient.organization.list();
  if (result.error)
    throw new Error(
      result.error.message ?? 'No pudimos cargar las organizaciones.',
    );
  return z.array(organizationSchema).parse(result.data);
}
export async function getContext(id: string, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(
      `/api/v1/organizations/${encodeURIComponent(id)}/context`,
      { signal, credentials: 'include' },
    );
  } catch {
    throw new Error(
      'No pudimos conectar con el servicio. Comprobá tu conexión e intentá nuevamente.',
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? 'Tu sesión expiró. Volvé a iniciar sesión.'
        : response.status === 403 || response.status === 404
          ? 'Esta organización no está disponible para tu cuenta.'
          : 'El servicio no pudo comprobar el acceso. Volvé a intentar.',
    );
  const context = contextSchema.parse(await response.json());
  if (context.organization.id !== id)
    throw new Error(
      'La respuesta no corresponde a la organización seleccionada.',
    );
  return context;
}
export async function listMembers(
  organizationId: string,
  page: number,
  pageSize = 25,
) {
  const limit = z
    .union([z.literal(25), z.literal(50), z.literal(100)])
    .parse(pageSize);
  const result = await authClient.organization.listMembers({
    query: {
      organizationId,
      limit,
      offset: page * limit,
      sortBy: 'createdAt',
      sortDirection: 'asc',
    },
  });
  if (result.error)
    throw new Error(result.error.message ?? 'No pudimos cargar los miembros.');
  const parsed = membersSchema.parse(result.data);
  if (parsed.members.some((member) => member.organizationId !== organizationId))
    throw new Error(
      'La respuesta no corresponde a la organización seleccionada.',
    );
  return parsed;
}
export async function listInvitations(organizationId: string) {
  const result = await authClient.organization.listInvitations({
    query: { organizationId },
  });
  if (result.error)
    throw new Error(
      result.error.message ?? 'No pudimos cargar las invitaciones.',
    );
  const parsed = invitationsSchema.parse(result.data);
  if (parsed.some((invitation) => invitation.organizationId !== organizationId))
    throw new Error(
      'La respuesta no corresponde a la organización seleccionada.',
    );
  return parsed;
}
export function roleLabel(role: string) {
  const labels: Record<string, string> = {
    owner: 'Propietario',
    admin: 'Administrador',
    analyst: 'Analista',
    viewer: 'Lector',
  };
  return labels[role] ?? role;
}

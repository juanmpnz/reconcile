import type { z } from 'zod';
import {
  DataTable,
  renderDate,
  renderStatus,
} from '../../design-system/data-table';
import { Button } from '../../design-system/primitives';
import { roleLabel } from './queries';
import type { invitationsSchema } from './queries';
type Invitation = z.infer<typeof invitationsSchema>[number];
function statusLabel(item: Invitation) {
  if (item.status === 'pending' && item.expiresAt.valueOf() <= Date.now())
    return 'Vencida';
  return (
    {
      pending: 'Pendiente',
      accepted: 'Aceptada',
      canceled: 'Cancelada',
      cancelled: 'Cancelada',
      rejected: 'Rechazada',
    }[item.status] ?? item.status
  );
}
export function InvitationsTable({
  invitations,
  canInvite,
  cancelling,
  disabled,
  onCancel,
}: {
  invitations: Invitation[];
  canInvite: boolean;
  cancelling: string | null;
  disabled: boolean;
  onCancel: (id: string) => void;
}) {
  return (
    <DataTable
      label="Invitaciones de la organización"
      data={invitations}
      getRowId={(item) => item.id}
      searchLabel="Buscar invitaciones"
      columns={[
        {
          id: 'email',
          label: 'Correo electrónico',
          accessor: (item) => item.email,
        },
        {
          id: 'role',
          label: 'Rol',
          accessor: (item) => roleLabel(item.role),
          render: (item) => renderStatus(roleLabel(item.role)),
        },
        { id: 'status', label: 'Estado', accessor: statusLabel },
        {
          id: 'expires',
          label: 'Vencimiento',
          accessor: (item) => item.expiresAt.valueOf(),
          render: (item) => renderDate(item.expiresAt),
        },
        ...(canInvite
          ? [
              {
                id: 'actions',
                label: 'Acciones',
                sortable: false,
                render: (item: Invitation) =>
                  item.status === 'pending' &&
                  item.expiresAt.valueOf() > Date.now() ? (
                    <Button
                      pending={cancelling === item.id}
                      variant="outline"
                      disabled={disabled || Boolean(cancelling)}
                      onClick={() => onCancel(item.id)}
                      aria-label={`Cancelar invitación de ${item.email}`}
                    >
                      {cancelling === item.id ? 'Cancelando…' : 'Cancelar'}
                    </Button>
                  ) : (
                    '—'
                  ),
              },
            ]
          : []),
      ]}
    />
  );
}

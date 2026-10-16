import type { z } from 'zod';
import { DataTable, renderStatus } from '../../components/ui/data-table';
import { roleLabel } from './queries';
import type { membersSchema } from './queries';
type Member = z.infer<typeof membersSchema>['members'][number];
export function MembersTable({
  members,
  total,
  page,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  busy = false,
}: {
  members: Member[];
  total: number;
  page: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  busy?: boolean;
}) {
  return (
    <DataTable
      label="Miembros de la organización"
      mode="server"
      data={members}
      getRowId={(member) => member.id}
      columns={[
        {
          id: 'name',
          label: 'Nombre',
          render: (member) => member.user.name,
          sortable: false,
        },
        {
          id: 'email',
          label: 'Correo electrónico',
          render: (member) => member.user.email,
          sortable: false,
        },
        {
          id: 'role',
          label: 'Rol',
          render: (member) => renderStatus(roleLabel(member.role)),
          sortable: false,
        },
      ]}
      pagination={{ pageIndex: page, pageSize }}
      rowCount={total}
      pageSizes={onPageSizeChange ? [25, 50, 100] : [25]}
      onPaginationChange={(next) => {
        if (next.pageSize !== pageSize) onPageSizeChange?.(next.pageSize);
        else onPageChange(next.pageIndex);
      }}
      busy={busy}
    />
  );
}

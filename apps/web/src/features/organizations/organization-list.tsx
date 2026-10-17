import { organizationQueries } from './hooks';
import { PageHeader } from '../../design-system/layout';
import { DataTable, renderLink } from '../../design-system/data-table';
import { Loading } from '../../design-system/loading';
import { useQuery } from '@tanstack/react-query';
import { EmptyState, RequestError } from '../../design-system/primitives';
import { organizationPath, navigate } from '../../app/router';
import { CreateOrganizationDialog } from './create-dialog';

export function OrganizationList({ userId }: { userId: string }) {
  const organizations = useQuery({
    ...organizationQueries.list(userId),
  });
  return (
    <>
      <PageHeader className="page-header">
        <div>
          <h1>Organizaciones</h1>
          <p>Gestioná tus espacios y el acceso de tu equipo.</p>
        </div>
        <CreateOrganizationDialog userId={userId} />
      </PageHeader>
      {organizations.isPending ? (
        <Loading label="Cargando organizaciones…" rows={4} />
      ) : organizations.isError ? (
        <RequestError
          error={organizations.error}
          retry={() => {
            void organizations.refetch();
          }}
        />
      ) : organizations.data.length === 0 ? (
        <EmptyState title="No tenés organizaciones todavía">
          <p>Creá un espacio o aceptá la invitación enviada a tu correo.</p>
        </EmptyState>
      ) : (
        <DataTable
          label="Organizaciones"
          searchLabel="Buscar organizaciones"
          data={organizations.data}
          getRowId={(org) => org.id}
          columns={[
            {
              id: 'name',
              label: 'Nombre',
              accessor: (org) => org.name,
              render: (org) =>
                renderLink(org.name, organizationPath(org.id), navigate),
            },
            { id: 'slug', label: 'Identificador', accessor: (org) => org.slug },
          ]}
        />
      )}
      {organizations.isFetching && !organizations.isPending && (
        <Loading inline label="Actualizando organizaciones…" />
      )}
    </>
  );
}

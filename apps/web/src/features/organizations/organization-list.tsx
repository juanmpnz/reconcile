import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  EmptyState,
  RequestError,
  TableRegion,
} from '../../components/ui/primitives';
import { organizationPath, navigate } from '../../app/router';
import { CreateOrganizationDialog } from './create-dialog';
import { identityKey, listOrganizations } from './queries';
export function OrganizationList({ userId }: { userId: string }) {
  const [search, setSearch] = useState('');
  const organizations = useQuery({
    queryKey: identityKey(userId),
    queryFn: listOrganizations,
  });
  const filtered =
    organizations.data?.filter((org) =>
      `${org.name} ${org.slug}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    ) ?? [];
  return (
    <>
      <div className="page-header">
        <div>
          <h1>Organizaciones</h1>
          <p>Gestioná tus espacios y el acceso de tu equipo.</p>
        </div>
        <CreateOrganizationDialog userId={userId} />
      </div>
      <div className="toolbar">
        <div className="search">
          <label htmlFor="organization-search">Buscar organizaciones</label>
          <input
            id="organization-search"
            type="search"
            placeholder="Nombre o identificador"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <p className="metadata" role="status">
          {organizations.isSuccess
            ? `${filtered.length} ${filtered.length === 1 ? 'resultado' : 'resultados'}`
            : ''}
        </p>
      </div>
      {organizations.isPending ? (
        <p role="status">Cargando organizaciones…</p>
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
      ) : filtered.length === 0 ? (
        <EmptyState title="No hay coincidencias">
          <p>Probá otro nombre o identificador.</p>
          <Button variant="outline" onClick={() => setSearch('')}>
            Limpiar búsqueda
          </Button>
        </EmptyState>
      ) : (
        <TableRegion label="Organizaciones">
          <table>
            <caption className="sr-only">
              Organizaciones a las que pertenece tu cuenta
            </caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Identificador</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((org) => (
                <tr key={org.id}>
                  <td>
                    <a
                      href={organizationPath(org.id)}
                      onClick={(event) => {
                        if (!event.metaKey && !event.ctrlKey) {
                          event.preventDefault();
                          navigate(organizationPath(org.id));
                        }
                      }}
                    >
                      {org.name}
                    </a>
                  </td>
                  <td className="metadata">{org.slug}</td>
                  <td className="table-action">
                    <Button
                      variant="outline"
                      aria-label={`Abrir ${org.name}`}
                      onClick={() => navigate(organizationPath(org.id))}
                    >
                      Abrir
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
      {organizations.isFetching && !organizations.isPending && (
        <p role="status" className="metadata">
          Actualizando organizaciones…
        </p>
      )}
    </>
  );
}

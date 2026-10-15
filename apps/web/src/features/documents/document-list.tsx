import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  EmptyState,
  RequestError,
  TableRegion,
} from '../../components/ui/primitives';
import { Loading } from '../../components/ui/loading';
import { navigate, organizationPath } from '../../app/router';
import { UploadDialog } from './upload-dialog';
import {
  bytesLabel,
  documentPath,
  documentsKey,
  isProcessing,
  kindLabels,
  listDocuments,
  statusLabels,
  timestampLabel,
} from './api';
export function DocumentList({
  userId,
  organizationId,
  page,
  canWrite,
  disabled,
}: {
  userId: string;
  organizationId: string;
  page: number;
  canWrite: boolean;
  disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const documents = useQuery({
    queryKey: [...documentsKey(userId, organizationId), 'list', page],
    queryFn: ({ signal }) => listDocuments(organizationId, page, signal),
    enabled: !disabled,
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => isProcessing(item.status))
        ? 3000
        : false,
  });
  const filtered =
    documents.data?.items.filter((item) =>
      item.filename
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
    ) ?? [];
  return (
    <section>
      <div className="page-header">
        <div>
          <h2>Documentos</h2>
          <p>
            Originales privados y datos extraídos. La extracción no valida los
            importes facturados.
          </p>
        </div>
        {canWrite && (
          <UploadDialog
            userId={userId}
            organizationId={organizationId}
            disabled={disabled}
          />
        )}
      </div>
      {!canWrite && (
        <p className="permission-note">
          Tu rol permite consultar documentos. La carga y corrección están
          reservadas a propietarios, administradores y analistas.
        </p>
      )}
      <div className="toolbar">
        <div className="search">
          <label htmlFor="document-search">Buscar en esta página</label>
          <input
            id="document-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre del archivo"
          />
        </div>
        {documents.isSuccess && (
          <p className="metadata" role="status">
            {filtered.length} documentos en esta página
          </p>
        )}
      </div>
      {documents.isPending ? (
        <Loading label="Cargando documentos…" rows={4} />
      ) : documents.isError ? (
        <RequestError
          error={documents.error}
          retry={() => {
            void documents.refetch();
          }}
        />
      ) : documents.data.items.length === 0 ? (
        <EmptyState
          title={
            page > 0
              ? 'No hay documentos en esta página'
              : 'No hay documentos todavía'
          }
        >
          <p>
            {page > 0
              ? 'Volvé a la página anterior.'
              : canWrite
                ? 'Subí una factura, tarifa, cotización o registro operativo en PDF.'
                : 'Los documentos cargados por tu equipo aparecerán acá.'}
          </p>
          {page > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  organizationPath(organizationId, 'documents', page - 1),
                )
              }
            >
              Página anterior
            </Button>
          )}
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title="No hay coincidencias">
          <p>La búsqueda se aplica a los documentos de esta página.</p>
          <Button variant="outline" onClick={() => setSearch('')}>
            Limpiar búsqueda
          </Button>
        </EmptyState>
      ) : (
        <TableRegion label="Documentos de la organización">
          <table>
            <caption className="sr-only">
              Documentos cargados y estado de extracción
            </caption>
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col">Fecha de carga</th>
                <th scope="col">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((document) => (
                <tr key={document.id}>
                  <td>
                    <a
                      href={documentPath(organizationId, document.id)}
                      onClick={(event) => {
                        if (!event.metaKey && !event.ctrlKey) {
                          event.preventDefault();
                          navigate(documentPath(organizationId, document.id));
                        }
                      }}
                    >
                      {document.filename}
                    </a>
                    <small className="file-size">
                      {bytesLabel(document.sizeBytes)}
                    </small>
                  </td>
                  <td>{kindLabels[document.kind]}</td>
                  <td>
                    <Badge>{statusLabels[document.status]}</Badge>
                  </td>
                  <td className="metadata">
                    {timestampLabel(document.createdAt)}
                  </td>
                  <td className="table-action">
                    <Button
                      variant="outline"
                      aria-label={`Abrir ${document.filename}`}
                      onClick={() =>
                        navigate(documentPath(organizationId, document.id))
                      }
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
      {documents.data && documents.data.total > 0 && (
        <div className="pagination">
          <p className="metadata">
            {documents.data.items.length > 0
              ? `${documents.data.offset + 1}–${documents.data.offset + documents.data.items.length} de ${documents.data.total} documentos`
              : '0 documentos en esta página'}
          </p>
          <div>
            <Button
              variant="outline"
              disabled={page === 0 || documents.isFetching}
              onClick={() =>
                navigate(
                  organizationPath(organizationId, 'documents', page - 1),
                )
              }
            >
              Anterior
            </Button>
            <span className="metadata">Página {page + 1}</span>
            <Button
              variant="outline"
              disabled={
                documents.data.offset + documents.data.limit >=
                  documents.data.total || documents.isFetching
              }
              onClick={() =>
                navigate(
                  organizationPath(organizationId, 'documents', page + 1),
                )
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
      {documents.isFetching && !documents.isPending && (
        <Loading inline label="Actualizando documentos…" />
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  RequestError,
  TableRegion,
} from '../../components/ui/primitives';
import { Loading } from '../../components/ui/loading';
import { navigate, useRoute } from '../../app/router';
import { UploadDialog } from './upload-dialog';
import { MetadataDialog } from './metadata-dialog';
import { OperationLinks } from './operation-links';
import { documentListPath, documentListState } from './list-state';
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
import type { DocumentListOptions } from './api';
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
  const route = useRoute();
  const options = documentListState(route.searchParams);
  const [search, setSearch] = useState(options.q);
  const [message, setMessage] = useState('');
  useEffect(() => setSearch(options.q), [options.q]);
  const documents = useQuery({
    queryKey: [
      ...documentsKey(userId, organizationId),
      'list',
      options.q,
      options.sort,
      options.direction,
      page,
    ],
    queryFn: ({ signal }) =>
      listDocuments(organizationId, page, signal, options),
    enabled: !disabled,
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => isProcessing(item.status))
        ? 3000
        : false,
  });
  const headers: [DocumentListOptions['sort'], string][] = [
    ['filename', 'Nombre'],
    ['kind', 'Tipo'],
    ['status', 'Estado'],
    ['reference', 'Referencia extraída'],
    ['operation', 'Operaciones vinculadas'],
    ['createdAt', 'Fecha de carga'],
  ];
  function sort(field: DocumentListOptions['sort']) {
    navigate(
      documentListPath(organizationId, {
        ...options,
        sort: field,
        direction:
          options.sort === field && options.direction === 'asc'
            ? 'desc'
            : 'asc',
      }),
    );
  }
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
      <Feedback message={message} />
      {!canWrite && (
        <p className="permission-note">
          Tu rol permite consultar documentos. La carga y edición están
          reservadas a propietarios, administradores y analistas.
        </p>
      )}
      <div className="toolbar">
        <form
          className="document-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(
              documentListPath(organizationId, {
                ...options,
                q: search.trim(),
              }),
            );
          }}
        >
          <div className="search">
            <label htmlFor="document-search">
              Buscar en todos los documentos
            </label>
            <input
              id="document-search"
              type="search"
              maxLength={200}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, tipo, estado o referencia"
              aria-describedby="document-search-scope"
            />
            <small id="document-search-scope">
              Incluye la referencia extraída y los nombres o referencias de
              operaciones vinculadas.
            </small>
          </div>
          <Button variant="outline" disabled={disabled}>
            Buscar
          </Button>
          {options.q && (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                navigate(
                  documentListPath(organizationId, { ...options, q: '' }),
                )
              }
            >
              Limpiar búsqueda
            </Button>
          )}
        </form>
        {documents.isSuccess && (
          <p className="metadata" role="status">
            {documents.data.total} documentos{options.q ? ' encontrados' : ''} ·
            orden{' '}
            {headers
              .find(([field]) => field === options.sort)?.[1]
              .toLocaleLowerCase()}
            , {options.direction === 'asc' ? 'ascendente' : 'descendente'}
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
              : options.q
                ? 'Sin resultados para esta búsqueda'
                : 'No hay documentos todavía'
          }
        >
          <p>
            {page > 0
              ? 'Volvé a la página anterior.'
              : options.q
                ? 'La búsqueda se aplica a toda la organización, incluidos los vínculos reales con operaciones.'
                : canWrite
                  ? 'Subí una factura, tarifa, cotización o registro operativo en PDF.'
                  : 'Los documentos cargados por tu equipo aparecerán acá.'}
          </p>
          {page > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                navigate(documentListPath(organizationId, options, page - 1))
              }
            >
              Página anterior
            </Button>
          )}
          {options.q && (
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  documentListPath(organizationId, { ...options, q: '' }),
                )
              }
            >
              Limpiar búsqueda
            </Button>
          )}
        </EmptyState>
      ) : (
        <TableRegion label="Documentos de la organización">
          <table>
            <caption className="sr-only">
              Documentos, referencias extraídas y operaciones vinculadas;
              búsqueda y orden globales
            </caption>
            <thead>
              <tr>
                {headers.map(([field, label]) => (
                  <th
                    scope="col"
                    key={field}
                    aria-sort={
                      options.sort === field
                        ? options.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => sort(field)}
                      disabled={disabled}
                      aria-label={`Ordenar por ${label.toLocaleLowerCase()}, ${options.sort === field && options.direction === 'asc' ? 'descendente' : 'ascendente'}`}
                    >
                      {label}
                      {options.sort === field && (
                        <span aria-hidden="true">
                          {' '}
                          {options.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {documents.data.items.map((document) => (
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
                  <td>
                    {document.extractedReference ?? (
                      <span className="metadata">Sin referencia extraída</span>
                    )}
                  </td>
                  <td>
                    <OperationLinks
                      document={document}
                      organizationId={organizationId}
                    />
                  </td>
                  <td className="metadata">
                    {timestampLabel(document.createdAt)}
                  </td>
                  <td className="table-action">
                    <div className="document-row-actions">
                      {canWrite && (
                        <MetadataDialog
                          userId={userId}
                          organizationId={organizationId}
                          document={document}
                          disabled={disabled}
                          onSaved={() => {
                            setMessage(
                              'Datos actualizados. Revisá las operaciones y reanalizá si corresponde.',
                            );
                            window.document
                              .getElementById('document-search')
                              ?.focus();
                          }}
                        />
                      )}
                      <Button
                        variant="outline"
                        aria-label={`Abrir ${document.filename}`}
                        onClick={() =>
                          navigate(documentPath(organizationId, document.id))
                        }
                      >
                        Abrir
                      </Button>
                    </div>
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
            {documents.data.items.length
              ? `${documents.data.offset + 1}–${documents.data.offset + documents.data.items.length} de ${documents.data.total} documentos`
              : '0 documentos en esta página'}
          </p>
          <div>
            <Button
              variant="outline"
              disabled={page === 0 || documents.isFetching}
              onClick={() =>
                navigate(documentListPath(organizationId, options, page - 1))
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
                navigate(documentListPath(organizationId, options, page + 1))
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

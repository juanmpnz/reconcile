import { documentQueries } from './hooks';
import { PageHeader } from '../../design-system/layout';
import {
  DataTable,
  renderLink,
  renderStatus,
} from '../../design-system/data-table';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Feedback, RequestError } from '../../design-system/primitives';
import { Loading } from '../../design-system/loading';
import { navigate, useRoute } from '../../app/router';
import { UploadDialog } from './upload-dialog';
import { MetadataDialog } from './metadata-dialog';
import { OperationLinks } from './operation-links';
import { documentListPath, documentListState } from './list-state';
import {
  bytesLabel,
  documentPath,
  isProcessing,
  kindLabels,
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
  const route = useRoute();
  const options = documentListState(route.searchParams);
  const [message, setMessage] = useState('');
  const documents = useQuery({
    ...documentQueries.list(userId, organizationId, page, options),
    enabled: !disabled,
    refetchInterval: (query) =>
      query.state.data?.items.some((item) => isProcessing(item.status))
        ? 3000
        : false,
  });
  return (
    <section>
      <PageHeader className="page-header">
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
      </PageHeader>
      <Feedback message={message} />
      {!canWrite && (
        <p className="permission-note">
          Tu rol permite consultar documentos. La carga y edición están
          reservadas a propietarios, administradores y analistas.
        </p>
      )}
      {documents.isPending ? (
        <Loading label="Cargando documentos…" rows={4} />
      ) : documents.isError ? (
        <RequestError
          error={documents.error}
          retry={() => {
            void documents.refetch();
          }}
        />
      ) : (
        <DataTable
          label="Documentos de la organización"
          mode="server"
          data={documents.data.items}
          getRowId={(document) => document.id}
          search={options.q}
          onSearchChange={(q) =>
            navigate(documentListPath(organizationId, { ...options, q }))
          }
          searchLabel="Buscar en todos los documentos"
          searchHint="Nombre, tipo, estado, referencia extraída u operación vinculada."
          sorting={[{ id: options.sort, desc: options.direction === 'desc' }]}
          onSortingChange={(sorting) => {
            const first = sorting[0];
            const sort = first?.id;
            if (
              sort === 'filename' ||
              sort === 'kind' ||
              sort === 'status' ||
              sort === 'reference' ||
              sort === 'operation' ||
              sort === 'createdAt'
            )
              navigate(
                documentListPath(organizationId, {
                  ...options,
                  sort,
                  direction: first?.desc ? 'desc' : 'asc',
                }),
              );
          }}
          pagination={{ pageIndex: page, pageSize: options.limit ?? 25 }}
          rowCount={documents.data.total}
          onPaginationChange={(next) =>
            navigate(
              documentListPath(
                organizationId,
                { ...options, limit: next.pageSize },
                next.pageIndex,
              ),
            )
          }
          disabled={disabled}
          busy={documents.isFetching}
          emptyMessage="No hay documentos para esta búsqueda."
          columns={[
            {
              id: 'filename',
              label: 'Nombre',
              sortable: true,
              render: (document) => (
                <>
                  {renderLink(
                    document.filename,
                    documentPath(organizationId, document.id),
                    navigate,
                  )}
                  <small className="file-size">
                    {bytesLabel(document.sizeBytes)}
                  </small>
                </>
              ),
            },
            {
              id: 'kind',
              label: 'Tipo',
              sortable: true,
              render: (document) => kindLabels[document.kind],
            },
            {
              id: 'status',
              label: 'Estado',
              sortable: true,
              render: (document) => renderStatus(statusLabels[document.status]),
            },
            {
              id: 'reference',
              label: 'Referencia extraída',
              sortable: true,
              render: (document) =>
                document.extractedReference ?? 'Sin referencia extraída',
            },
            {
              id: 'operation',
              label: 'Operaciones vinculadas',
              sortable: true,
              render: (document) => (
                <OperationLinks
                  document={document}
                  organizationId={organizationId}
                />
              ),
            },
            {
              id: 'createdAt',
              label: 'Fecha de carga',
              sortable: true,
              render: (document) => timestampLabel(document.createdAt),
            },
            {
              id: 'actions',
              label: 'Acciones',
              sortable: false,
              render: (document) => (
                <div className="document-row-actions">
                  {canWrite && (
                    <MetadataDialog
                      userId={userId}
                      organizationId={organizationId}
                      document={document}
                      disabled={disabled}
                      onSaved={() =>
                        setMessage(
                          'Datos actualizados. Revisá las operaciones y reanalizá si corresponde.',
                        )
                      }
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
              ),
            },
          ]}
        />
      )}
    </section>
  );
}

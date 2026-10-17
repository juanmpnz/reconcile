import { operationQueries } from './hooks';
import { useCreateOperationMutation } from './hooks';
import { FormActions, PageHeader } from '../../design-system/layout';
import { DataTable, renderLink } from '../../design-system/data-table';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  Feedback,
  Field,
  RequestError,
} from '../../design-system/primitives';
import { Dialog } from '../../design-system/dialog';
import { Loading } from '../../design-system/loading';
import { navigate, useRoute } from '../../app/router';
import { useMounted } from '../../lib/use-mounted';
import { errorMessage } from '../../lib/forms';
import { timestampLabel } from '../documents/api';
import { operationPath } from './api';
export function OperationList({
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
  const createOperationMutation = useCreateOperationMutation(userId);

  const route = useRoute();
  const q = (route.searchParams.get('q') ?? '').slice(0, 200);
  const sortValue = route.searchParams.get('sort');
  const sort =
    sortValue === 'reference' || sortValue === 'name' ? sortValue : 'createdAt';
  const direction =
    route.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';
  const limitValue = Number(route.searchParams.get('limit'));
  const limit = limitValue === 50 || limitValue === 100 ? limitValue : 25;
  function change(values: {
    q?: string;
    sort?: string;
    direction?: string;
    limit?: number;
    page?: number;
  }) {
    const params = new URLSearchParams({
      tab: 'operations',
      q: values.q ?? q,
      sort: values.sort ?? sort,
      direction: values.direction ?? direction,
      limit: String(values.limit ?? limit),
      page: String(values.page ?? 0),
    });
    navigate(`/organizations/${encodeURIComponent(organizationId)}?${params}`);
  }
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useMounted();
  const query = useQuery({
    ...operationQueries.list(userId, organizationId, page, {
      q,
      sort,
      direction,
      limit,
    }),
    enabled: !disabled,
  });
  return (
    <section>
      <PageHeader className="page-header">
        <div>
          <h2>Operaciones</h2>
          <p>
            Agrupá documentos de un mismo servicio y compará sus partidas con
            evidencia.
          </p>
        </div>
        {canWrite && (
          <Dialog
            title="Crear operación"
            description="Usá la referencia que identifica la operación en sus documentos."
            open={open && !disabled}
            busy={busy}
            onOpenChange={(next) => {
              setOpen(next);
              setError('');
              if (next) {
                setReference('');
                setName('');
              }
            }}
            trigger={<Button disabled={disabled}>Crear operación</Button>}
          >
            <form
              aria-busy={busy}
              onSubmit={(event) => {
                event.preventDefault();
                if (busy || disabled) return;
                setBusy(true);
                setError('');
                void (async () => {
                  try {
                    const operation = await createOperationMutation.mutateAsync(
                      [
                        organizationId,
                        {
                          reference: reference.trim(),
                          name: name.trim(),
                        },
                      ],
                    );
                    if (!mounted.current) return;
                    if (mounted.current)
                      navigate(operationPath(organizationId, operation.id));
                  } catch (error) {
                    if (mounted.current) setError(errorMessage(error));
                  } finally {
                    if (mounted.current) setBusy(false);
                  }
                })();
              }}
            >
              <Feedback error message={error} />
              <Field
                name="reference"
                label="Referencia de operación"
                maxLength={100}
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                disabled={busy}
              />
              <Field
                name="name"
                label="Nombre"
                maxLength={200}
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
              />
              <FormActions className="dialog-actions">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  pending={busy}
                  disabled={!reference.trim() || !name.trim()}
                >
                  {busy ? 'Creando…' : 'Crear operación'}
                </Button>
              </FormActions>
            </form>
          </Dialog>
        )}
      </PageHeader>
      {!canWrite && (
        <p className="permission-note">
          Tu rol permite consultar operaciones y resultados. No permite
          modificarlos ni iniciar análisis.
        </p>
      )}
      {query.isPending ? (
        <Loading label="Cargando operaciones…" rows={4} />
      ) : query.isError ? (
        <RequestError
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <DataTable
          label="Operaciones de la organización"
          data={query.data.items}
          getRowId={(item) => item.id}
          mode="server"
          search={q}
          onSearchChange={(q) => change({ q })}
          searchLabel="Buscar operaciones"
          sorting={[{ id: sort, desc: direction === 'desc' }]}
          onSortingChange={(next) =>
            change({
              sort: next[0]?.id ?? 'createdAt',
              direction: next[0]?.desc ? 'desc' : 'asc',
            })
          }
          pagination={{ pageIndex: page, pageSize: limit }}
          rowCount={query.data.total}
          onPaginationChange={(next) =>
            change({ page: next.pageIndex, limit: next.pageSize })
          }
          disabled={disabled}
          busy={query.isFetching}
          emptyMessage="No hay operaciones para esta búsqueda."
          columns={[
            {
              id: 'reference',
              label: 'Referencia',
              sortable: true,
              render: (item) =>
                renderLink(
                  item.reference,
                  operationPath(organizationId, item.id),
                  navigate,
                ),
            },
            {
              id: 'name',
              label: 'Nombre',
              sortable: true,
              render: (item) => item.name,
            },
            {
              id: 'createdAt',
              label: 'Fecha de creación',
              sortable: true,
              render: (item) => timestampLabel(item.createdAt),
            },
            {
              id: 'updatedAt',
              label: 'Última actualización',
              sortable: false,
              render: (item) => timestampLabel(item.updatedAt),
            },
            {
              id: 'actions',
              label: 'Acciones',
              sortable: false,
              render: (item) => (
                <Button
                  variant="outline"
                  aria-label={`Abrir operación ${item.reference}`}
                  onClick={() =>
                    navigate(operationPath(organizationId, item.id))
                  }
                >
                  Abrir
                </Button>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}

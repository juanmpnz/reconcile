import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  EmptyState,
  Feedback,
  Field,
  RequestError,
  TableRegion,
} from '../../components/ui/primitives';
import { Dialog } from '../../components/ui/dialog';
import { Loading } from '../../components/ui/loading';
import { navigate, organizationPath } from '../../app/router';
import { useMounted } from '../../lib/use-mounted';
import { errorMessage } from '../../lib/forms';
import { timestampLabel } from '../documents/api';
import {
  createOperation,
  listOperations,
  operationPath,
  operationsKey,
} from './api';
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
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useMounted();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...operationsKey(userId, organizationId), 'list', page],
    queryFn: ({ signal }) => listOperations(organizationId, page, signal),
    enabled: !disabled,
  });
  return (
    <section>
      <div className="page-header">
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
                    const operation = await createOperation(organizationId, {
                      reference: reference.trim(),
                      name: name.trim(),
                    });
                    if (!mounted.current) return;
                    await client.invalidateQueries({
                      queryKey: operationsKey(userId, organizationId),
                    });
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
              <div className="dialog-actions">
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
              </div>
            </form>
          </Dialog>
        )}
      </div>
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
      ) : !query.data.items.length ? (
        <EmptyState
          title={
            page
              ? 'No hay operaciones en esta página'
              : 'No hay operaciones todavía'
          }
        >
          <p>
            Creá una operación y vinculá los documentos que querés comparar.
          </p>
          {page > 0 && (
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  organizationPath(organizationId, 'operations', page - 1),
                )
              }
            >
              Página anterior
            </Button>
          )}
        </EmptyState>
      ) : (
        <TableRegion label="Operaciones de la organización">
          <table>
            <caption className="sr-only">
              Operaciones y última actualización
            </caption>
            <thead>
              <tr>
                <th scope="col">Referencia</th>
                <th scope="col">Nombre</th>
                <th scope="col">Última actualización</th>
                <th scope="col">Acción</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a
                      href={operationPath(organizationId, item.id)}
                      onClick={(event) => {
                        if (!event.metaKey && !event.ctrlKey) {
                          event.preventDefault();
                          navigate(operationPath(organizationId, item.id));
                        }
                      }}
                    >
                      {item.reference}
                    </a>
                  </td>
                  <td>{item.name}</td>
                  <td>{timestampLabel(item.updatedAt)}</td>
                  <td className="table-action">
                    <Button
                      variant="outline"
                      aria-label={`Abrir operación ${item.reference}`}
                      onClick={() =>
                        navigate(operationPath(organizationId, item.id))
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
      {query.data && query.data.total > 0 && (
        <div className="pagination">
          <p className="metadata">
            {query.data.total} operaciones · Página {page + 1}
          </p>
          <div>
            <Button
              variant="outline"
              disabled={!page || query.isFetching}
              onClick={() =>
                navigate(
                  organizationPath(organizationId, 'operations', page - 1),
                )
              }
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={(page + 1) * 25 >= query.data.total || query.isFetching}
              onClick={() =>
                navigate(
                  organizationPath(organizationId, 'operations', page + 1),
                )
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
      {query.isFetching && !query.isPending && (
        <Loading inline label="Actualizando operaciones…" />
      )}
    </section>
  );
}

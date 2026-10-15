import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog } from '../../components/ui/dialog';
import { Button, Feedback, RequestError } from '../../components/ui/primitives';
import { Loading } from '../../components/ui/loading';
import {
  documentsKey,
  listDocuments,
  kindLabels,
  statusLabels,
} from '../documents/api';
import { useMounted } from '../../lib/use-mounted';
import { linkDocuments } from './api';
export function LinkDialog({
  userId,
  organizationId,
  operationId,
  documentIds,
  disabled,
  onSaved,
}: {
  userId: string;
  organizationId: string;
  operationId: string;
  documentIds: string[];
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(documentIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useMounted();
  const documents = useQuery({
    queryKey: [...documentsKey(userId, organizationId), 'list', page],
    queryFn: ({ signal }) => listDocuments(organizationId, page, signal),
    enabled: open && !disabled,
  });
  return (
    <Dialog
      title="Vincular documentos"
      description="Elegí hasta 20 documentos de esta organización. Se conservarán los originales."
      open={open && !disabled}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        setError('');
        if (next) {
          setSelected(documentIds);
          setPage(0);
        }
      }}
      trigger={
        <Button variant="outline" disabled={disabled}>
          Vincular documentos
        </Button>
      }
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
              await linkDocuments(organizationId, operationId, selected);
              if (!mounted.current) return;
              await onSaved();
              if (mounted.current) setOpen(false);
            } catch (error) {
              if (mounted.current)
                setError(
                  error instanceof Error
                    ? error.message
                    : 'No se pudieron vincular los documentos.',
                );
            } finally {
              if (mounted.current) setBusy(false);
            }
          })();
        }}
      >
        <Feedback error message={error} />
        <p className="metadata" role="status">
          {selected.length} documentos seleccionados en todas las páginas.
        </p>
        {documents.isPending ? (
          <Loading label="Cargando documentos disponibles…" />
        ) : documents.isError ? (
          <RequestError
            error={documents.error}
            retry={() => {
              void documents.refetch();
            }}
          />
        ) : documents.data.items.length === 0 ? (
          <p>
            No hay documentos en esta página. Cargalos primero en Documentos.
          </p>
        ) : (
          documents.data.items.map((item) => (
            <label className="document-choice" key={item.id}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={
                  busy || (!selected.includes(item.id) && selected.length >= 20)
                }
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, item.id]
                      : selected.filter((id) => id !== item.id),
                  )
                }
              />
              <span>
                {item.filename}
                <small>
                  {kindLabels[item.kind]} · {statusLabels[item.status]}
                </small>
              </span>
            </label>
          ))
        )}
        <div className="pagination">
          <Button
            type="button"
            variant="outline"
            disabled={busy || page === 0 || documents.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="metadata">Página {page + 1}</span>
          <Button
            type="button"
            variant="outline"
            disabled={
              busy ||
              !documents.data ||
              (page + 1) * 25 >= documents.data.total ||
              documents.isFetching
            }
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
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
            disabled={documents.isPending || documents.isError}
          >
            {busy ? 'Guardando…' : 'Guardar documentos'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

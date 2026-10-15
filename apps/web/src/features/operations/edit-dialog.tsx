import { useState } from 'react';
import { Dialog } from '../../components/ui/dialog';
import { Button, Feedback, Field } from '../../components/ui/primitives';
import { useMounted } from '../../lib/use-mounted';
import { OperationConflictError, updateOperation } from './api';
export function EditOperationDialog({
  organizationId,
  operationId,
  name,
  reference,
  fingerprint,
  disabled,
  activeRun,
  onSaved,
}: {
  organizationId: string;
  operationId: string;
  name: string;
  reference: string;
  fingerprint: string;
  disabled: boolean;
  activeRun: boolean;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draftName, setName] = useState(name);
  const [draftReference, setReference] = useState(reference);
  const [expectedFingerprint, setFingerprint] = useState(fingerprint);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const mounted = useMounted();
  return (
    <Dialog
      title="Editar operación"
      description="Cambiar la referencia no modifica los datos extraídos de los documentos. Será necesario revisar y reanalizar los datos."
      open={open && !disabled}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setName(name);
          setReference(reference);
          setFingerprint(fingerprint);
          setError('');
          setConflict(false);
        }
      }}
      trigger={
        <Button variant="outline" disabled={disabled || activeRun}>
          Editar operación
        </Button>
      }
    >
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || disabled || activeRun || conflict) return;
          setBusy(true);
          setError('');
          void (async () => {
            try {
              await updateOperation(organizationId, operationId, {
                name: draftName.trim(),
                reference: draftReference.trim(),
                expectedFingerprint,
              });
              if (!mounted.current) return;
              await onSaved();
              if (mounted.current) setOpen(false);
            } catch (error) {
              if (!mounted.current) return;
              setError(
                error instanceof Error
                  ? error.message
                  : 'No se pudo guardar la operación.',
              );
              if (error instanceof OperationConflictError) {
                setConflict(
                  error.code === 'STALE_OPERATION' ||
                    error.code === 'CONCURRENT_UPDATE',
                );
                await onSaved();
              }
            } finally {
              if (mounted.current) setBusy(false);
            }
          })();
        }}
      >
        <Feedback message={error} error />
        <Field
          name="operation-name"
          label="Nombre"
          value={draftName}
          maxLength={200}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          name="operation-reference"
          label="Referencia de operación"
          value={draftReference}
          maxLength={100}
          disabled={busy}
          onChange={(event) => setReference(event.target.value)}
        />
        {conflict && (
          <div className="document-warning">
            <strong>Datos actuales de la operación</strong>
            <p>Nombre: {name}</p>
            <p>Referencia: {reference}</p>
            <p>
              Tu borrador sigue en los campos de arriba. Comparalo antes de
              volver a guardar.
            </p>
          </div>
        )}
        {conflict && (
          <Button
            type="button"
            variant="outline"
            disabled={busy || activeRun}
            onClick={() => {
              setFingerprint(fingerprint);
              setConflict(false);
              setError('');
            }}
          >
            Revisé los datos actualizados; conservar mi borrador
          </Button>
        )}
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
            disabled={
              conflict ||
              activeRun ||
              !draftName.trim() ||
              !draftReference.trim()
            }
          >
            {busy ? 'Guardando…' : 'Guardar operación'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

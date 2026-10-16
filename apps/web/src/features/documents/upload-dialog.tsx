import { Select } from '../../components/ui/select';
import { useId, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DOCUMENT_MAX_BYTES, documentKindSchema } from '@reconcile/contracts';
import { Dialog } from '../../components/ui/dialog';
import { Button, Feedback } from '../../components/ui/primitives';
import { useMounted } from '../../lib/use-mounted';
import { errorMessage } from '../../lib/forms';
import { navigate } from '../../app/router';
import {
  bytesLabel,
  documentPath,
  documentsKey,
  kindLabels,
  uploadDocument,
} from './api';
export function UploadDialog({
  userId,
  organizationId,
  disabled,
  defaultKind = 'invoice',
  onUploaded,
}: {
  userId: string;
  organizationId: string;
  disabled: boolean;
  defaultKind?: string;
  onUploaded?: (documentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(defaultKind);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useMounted();
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const queryClient = useQueryClient();
  function reset() {
    setFile(null);
    setKind(defaultKind);
    setError('');
    if (input.current) input.current.value = '';
  }
  return (
    <Dialog
      title="Subir documento"
      description="PDF con texto seleccionable. Los PDF escaneados requieren OCR, todavía no disponible."
      trigger={<Button disabled={disabled}>Subir documento</Button>}
      open={open && !disabled}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || disabled) return;
          const kind = documentKindSchema.parse(
            new FormData(event.currentTarget).get('kind'),
          );
          if (!file) {
            setError('Seleccioná un archivo PDF.');
            return;
          }
          if (
            file.size > DOCUMENT_MAX_BYTES ||
            file.size === 0 ||
            !file.name.toLocaleLowerCase().endsWith('.pdf')
          ) {
            setError('Elegí un PDF no vacío de hasta 10 MiB.');
            return;
          }
          setBusy(true);
          setError('');
          void (async () => {
            try {
              const document = await uploadDocument(organizationId, file, kind);
              if (!mounted.current) return;
              if (document.organizationId !== organizationId)
                throw new Error(
                  'La respuesta no corresponde a esta organización.',
                );
              await queryClient.invalidateQueries({
                queryKey: documentsKey(userId, organizationId),
              });
              if (!mounted.current) return;
              setOpen(false);
              if (onUploaded) onUploaded(document.id);
              else navigate(documentPath(organizationId, document.id));
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <Feedback message={error} error />
        <div className="field">
          <label htmlFor={`${id}-file`}>Archivo PDF</label>
          <input
            ref={input}
            id={`${id}-file`}
            type="file"
            accept=".pdf,application/pdf"
            required={!file}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError('');
            }}
            aria-describedby={`${id}-hint`}
          />
          <small id={`${id}-hint`}>
            Solo PDF. Máximo {bytesLabel(DOCUMENT_MAX_BYTES)}. El servidor
            validará el contenido.
          </small>
        </div>
        {file && (
          <div className="selected-file">
            <span>
              {file.name}
              <small>{bytesLabel(file.size)}</small>
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                reset();
                input.current?.focus();
              }}
            >
              Quitar
            </Button>
          </div>
        )}
        <div className="field">
          <label htmlFor={`${id}-kind`}>Tipo de documento</label>
          <Select
            id={`${id}-kind`}
            name="kind"
            value={kind}
            onValueChange={(selectedValue) => setKind(selectedValue)}
          >
            {documentKindSchema.options.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabels[kind]}
              </option>
            ))}
          </Select>
        </div>
        <div className="dialog-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              reset();
            }}
          >
            Cancelar
          </Button>
          <Button pending={busy} disabled={disabled || !file}>
            {busy ? 'Subiendo…' : 'Subir documento'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

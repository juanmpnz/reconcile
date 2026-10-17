import { documentQueries } from './hooks';
import { Label } from '../../design-system/controls';
import { useUpdateDocumentMetadataMutation } from './hooks';
import { FormActions } from '../../design-system/layout';
import { FormField, Textarea } from '../../design-system/controls';

import { Select } from '../../design-system/select';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { DocumentKind, DocumentSummary } from '@reconcile/contracts';
import {
  documentKindSchema,
  documentMetadataInputSchema,
} from '@reconcile/contracts';
import { Dialog } from '../../design-system/dialog';
import { Button, Feedback, Field } from '../../design-system/primitives';
import { useMounted } from '../../lib/use-mounted';

import { DocumentConflictError, kindLabels } from './api';
export function MetadataDialog({
  userId,
  organizationId,
  document,
  disabled,
  onSaved,
}: {
  userId: string;
  organizationId: string;
  document: DocumentSummary;
  disabled: boolean;
  onSaved?: () => void;
}) {
  const updateDocumentMetadataMutation =
    useUpdateDocumentMetadataMutation(userId);

  const client = useQueryClient();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [filename, setFilename] = useState(document.filename);
  const [kind, setKind] = useState<DocumentKind>(document.kind);
  const [reason, setReason] = useState('');
  const [version, setVersion] = useState(document.metadataVersion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<DocumentSummary | null>(null);
  const [requiresReview, setRequiresReview] = useState(false);
  const [checking, setChecking] = useState(false);
  async function reload() {
    setChecking(true);
    try {
      const current = await client.fetchQuery({
        ...documentQueries.detail(userId, organizationId, document.id),
        staleTime: 0,
      });
      if (!mounted.current) return;
      setConflict(current);
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : 'No se pudo recargar el documento.',
        );
    } finally {
      if (mounted.current) setChecking(false);
    }
  }
  return (
    <Dialog
      title="Editar datos del documento"
      description="Cambiás el nombre visible y el tipo. El PDF original y el texto extraído no cambian. Cambiar el tipo requiere revisar los datos y reanalizar las operaciones."
      trigger={
        <Button
          variant="outline"
          disabled={disabled}
          aria-label={`Editar datos de ${document.filename}`}
        >
          Editar datos
        </Button>
      }
      open={open && !disabled}
      busy={busy || checking}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setFilename(document.filename);
          setKind(document.kind);
          setReason('');
          setVersion(document.metadataVersion);
          setError('');
          setConflict(null);
          setRequiresReview(false);
        }
      }}
    >
      <form
        aria-busy={busy || checking}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || checking || disabled || requiresReview || conflict)
            return;
          const parsed = documentMetadataInputSchema.safeParse({
            filename: filename.trim(),
            kind,
            expectedMetadataVersion: version,
            reason: reason.trim(),
          });
          if (!parsed.success) {
            setError(
              'Usá un nombre de hasta 200 caracteres terminado en .pdf, sin barras ni caracteres de control, y un motivo.',
            );
            return;
          }
          setBusy(true);
          setError('');
          void (async () => {
            try {
              await updateDocumentMetadataMutation.mutateAsync([
                organizationId,
                document.id,
                parsed.data,
              ]);
              if (!mounted.current) return;
              setOpen(false);
              onSaved?.();
            } catch (error) {
              if (!mounted.current) return;
              setError(
                error instanceof Error
                  ? error.message
                  : 'No se pudieron guardar los datos.',
              );
              if (error instanceof DocumentConflictError) {
                setRequiresReview(true);
                await reload();
              }
            } finally {
              if (mounted.current) setBusy(false);
            }
          })();
        }}
      >
        <Feedback message={error} error />
        <Field
          name="document-filename"
          label="Nombre visible del archivo"
          maxLength={200}
          value={filename}
          disabled={busy || checking}
          hint="Conservá la extensión .pdf."
          onChange={(event) => setFilename(event.target.value)}
        />
        <FormField className="field">
          <Label htmlFor={`metadata-kind-${document.id}`}>
            Tipo de documento
          </Label>
          <Select
            id={`metadata-kind-${document.id}`}
            value={kind}
            disabled={busy || checking}
            onValueChange={(selectedValue) => {
              const result = documentKindSchema.safeParse(selectedValue);
              if (result.success) setKind(result.data);
            }}
          >
            {documentKindSchema.options.map((value) => (
              <option value={value} key={value}>
                {kindLabels[value]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField className="field">
          <Label htmlFor={`metadata-reason-${document.id}`}>
            Motivo del cambio
          </Label>
          <Textarea
            id={`metadata-reason-${document.id}`}
            rows={3}
            required
            maxLength={500}
            value={reason}
            disabled={busy || checking}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
        {checking && <p role="status">Recargando los datos actuales…</p>}
        {conflict && (
          <div className="document-warning">
            <strong>Datos vigentes</strong>
            <p>
              {conflict.filename} · {kindLabels[conflict.kind]}
            </p>
            <p>
              Tu borrador se conservó. Compará los cambios antes de guardar.
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy || checking}
              onClick={() => {
                setVersion(conflict.metadataVersion);
                setConflict(null);
                setRequiresReview(false);
                setError('');
              }}
            >
              Revisé los datos actuales; conservar mi borrador
            </Button>
          </div>
        )}
        {error && !conflict && !checking && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void reload();
            }}
          >
            Recargar datos vigentes
          </Button>
        )}
        <FormActions className="dialog-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy || checking}
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button
            pending={busy}
            disabled={
              checking ||
              requiresReview ||
              Boolean(conflict) ||
              !filename.trim() ||
              !reason.trim()
            }
          >
            Guardar datos
          </Button>
        </FormActions>
      </form>
    </Dialog>
  );
}

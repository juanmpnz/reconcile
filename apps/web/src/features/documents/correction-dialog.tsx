import { Label } from '../../design-system/controls';
import { useCorrectDocumentMutation } from './hooks';
import { FormActions } from '../../design-system/layout';
import {
  Checkbox,
  FormField,
  Input,
  Textarea,
} from '../../design-system/controls';

import { useId, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ExtractionResult } from '@reconcile/contracts';
import { Dialog } from '../../design-system/dialog';
import { Button, Feedback } from '../../design-system/primitives';
import { errorMessage } from '../../lib/forms';
import { useMounted } from '../../lib/use-mounted';
import { documentsKey } from './api';
export function CorrectionDialog({
  userId,
  organizationId,
  documentId,
  runId,
  field,
  label,
  currentValue,
  disabled,
  onSaved,
}: {
  userId: string;
  organizationId: string;
  documentId: string;
  runId: string;
  field: ExtractionResult['fields'][number];
  label: string;
  currentValue: string | null;
  disabled: boolean;
  onSaved: () => void;
}) {
  const correctDocumentMutation = useCorrectDocumentMutation(userId);

  const [open, setOpen] = useState(false);
  const [edited, setEdited] = useState(currentValue ?? '');
  const [missing, setMissing] = useState(currentValue === null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const mounted = useMounted();
  const queryClient = useQueryClient();
  return (
    <Dialog
      title={`Corregir ${label.toLocaleLowerCase()}`}
      description="La corrección se guarda por separado con su motivo. El PDF y el valor extraído original se conservan."
      trigger={
        <Button
          variant="outline"
          disabled={disabled}
          aria-label={`Corregir ${label.toLocaleLowerCase()}`}
        >
          Corregir
        </Button>
      }
      open={open && !disabled}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        setError('');
        if (next) {
          setEdited(currentValue ?? '');
          setMissing(currentValue === null);
          setReason('');
        }
      }}
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
              await correctDocumentMutation.mutateAsync([
                organizationId,
                documentId,
                {
                  extractionRunId: runId,
                  field: field.name,
                  value: missing ? null : edited.trim(),
                  reason: reason.trim(),
                },
              ]);
              if (!mounted.current) return;
              setOpen(false);
              onSaved();
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <Feedback message={error} error />
        {error && (
          <p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                void queryClient.invalidateQueries({
                  queryKey: documentsKey(userId, organizationId),
                });
              }}
            >
              Actualizá el documento antes de reintentar
            </Button>
          </p>
        )}
        <p className="source-value">
          <strong>Valor extraído:</strong> {field.value ?? 'Sin dato'}
        </p>
        <FormField className="field">
          <Label htmlFor={`${id}-value`}>Valor corregido</Label>
          <Input
            id={`${id}-value`}
            value={edited}
            onChange={(event) => setEdited(event.target.value)}
            disabled={missing || busy}
            required={!missing}
            maxLength={500}
          />
        </FormField>
        <Label className="checkbox-label">
          <Checkbox
            checked={missing}
            onChange={(event) => setMissing(event.target.checked)}
            disabled={busy}
          />
          Marcar sin dato verificable
        </Label>
        <FormField className="field">
          <Label htmlFor={`${id}-reason`}>Motivo de la corrección</Label>
          <Textarea
            id={`${id}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            required
            maxLength={500}
            rows={3}
          />
        </FormField>
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
            disabled={
              disabled || !reason.trim() || (!missing && !edited.trim())
            }
          >
            {busy ? 'Guardando…' : 'Guardar corrección'}
          </Button>
        </FormActions>
      </form>
    </Dialog>
  );
}

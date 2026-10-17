import { Label } from '../../design-system/controls';
import { useRebaseClaimMutation } from './hooks';
import { FormActions } from '../../design-system/layout';
import { FormField, Textarea } from '../../design-system/controls';

import { useState } from 'react';
import type { AnalysisRun, OperationReview } from '@reconcile/contracts';
import { Dialog } from '../../design-system/dialog';
import { Button, Feedback } from '../../design-system/primitives';
import { useMounted } from '../../lib/use-mounted';
import { ClaimConflictError } from './api';
export function RebaseDialog({
  userId,
  claim,
  run,
  findingIndex,
  review,
  disabled,
  onSaved,
  onRefresh,
}: {
  userId: string;
  claim: OperationReview['claims'][number];
  run: AnalysisRun;
  findingIndex: number;
  review: OperationReview;
  disabled: boolean;
  onSaved: (id: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const rebaseClaimMutation = useRebaseClaimMutation(userId);

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [claimVersion, setClaimVersion] = useState(claim.version);
  const [reviewVersion, setReviewVersion] = useState(review.version);
  const [fingerprint, setFingerprint] = useState(review.fingerprint);
  const mounted = useMounted();
  const finding = run.result?.findings[findingIndex];
  return (
    <Dialog
      title="Actualizar respaldo del reclamo"
      description="Esta acción crea una nueva versión de las fuentes y del borrador. El texto y las fuentes anteriores se conservan. Revisá el nuevo borrador antes de exportarlo."
      open={open && !disabled}
      busy={busy}
      trigger={
        <Button variant="outline" disabled={disabled}>
          Actualizar respaldo
        </Button>
      }
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setReason('');
          setError('');
          setConflict(false);
          setClaimVersion(claim.version);
          setReviewVersion(review.version);
          setFingerprint(review.fingerprint);
        }
      }}
    >
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || disabled || conflict) return;
          setBusy(true);
          setError('');
          void (async () => {
            try {
              const result = await rebaseClaimMutation.mutateAsync([
                review.organizationId,
                review.operationId,
                claim.id,
                {
                  expectedVersion: claimVersion,
                  expectedReviewVersion: reviewVersion,
                  expectedFingerprint: fingerprint,
                  runId: run.id,
                  findingIndex,
                  reason: reason.trim(),
                },
              ]);
              if (!mounted.current) return;
              await onSaved(result.id);
              if (mounted.current) setOpen(false);
            } catch (error) {
              if (!mounted.current) return;
              setError(
                error instanceof Error
                  ? error.message
                  : 'No se pudo actualizar el respaldo.',
              );
              if (error instanceof ClaimConflictError) {
                setConflict(true);
                await onRefresh();
              }
            } finally {
              if (mounted.current) setBusy(false);
            }
          })();
        }}
      >
        <Feedback error message={error} />
        <p>
          <strong>Solicitud anterior:</strong> {claim.provider} ·{' '}
          {claim.kind === 'clarification'
            ? 'Aclaración sin importe'
            : `${claim.amount ?? 'Sin dato'} ${claim.currency ?? ''}`}
        </p>
        <p>
          <strong>Hallazgo de la ejecución seleccionada:</strong>{' '}
          {finding?.explanation}
        </p>
        <p>
          Se usará la confirmación humana vigente de este hallazgo. El servidor
          comprobará los importes y la identidad de la factura.
        </p>
        <FormField className="field">
          <Label htmlFor={`rebase-reason-${findingIndex}`}>
            Motivo de la actualización
          </Label>
          <Textarea
            id={`rebase-reason-${findingIndex}`}
            required
            rows={3}
            maxLength={1000}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
        {conflict && (
          <div className="document-warning">
            <p>
              La revisión o el reclamo cambiaron. La solicitud actual
              corresponde a {claim.provider}, {claim.amount ?? 'sin importe'}{' '}
              {claim.currency ?? ''}. Revisá la decisión y las fuentes antes de
              continuar.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setClaimVersion(claim.version);
                setReviewVersion(review.version);
                setFingerprint(review.fingerprint);
                setConflict(false);
                setError('');
              }}
            >
              Revisé los datos actuales; conservar el motivo
            </Button>
          </div>
        )}
        <FormActions className="dialog-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          <Button pending={busy} disabled={conflict || !reason.trim()}>
            Actualizar respaldo
          </Button>
        </FormActions>
      </form>
    </Dialog>
  );
}

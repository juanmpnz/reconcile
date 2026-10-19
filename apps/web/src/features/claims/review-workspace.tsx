import { Label } from '../../design-system/controls';
import { claimQueries } from './hooks';
import { useDecideFindingMutation, useCreateClaimMutation } from './hooks';
import {
  Accordion,
  AccordionTrigger,
  FormActions,
} from '../../design-system/layout';
import { FormField, Textarea } from '../../design-system/controls';

import { Select } from '../../design-system/select';
import { DataTable, renderStatus } from '../../design-system/data-table';
import { RebaseDialog } from './rebase-dialog';
import { claimEligibility, followUpSummary } from './presentation';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnalysisRun, OperationReview } from '@reconcile/contracts';
import { Dialog } from '../../design-system/dialog';
import {
  Badge,
  Button,
  Feedback,
  RequestError,
} from '../../design-system/primitives';
import { Loading } from '../../design-system/loading';
import { useMounted } from '../../lib/use-mounted';
import { timestampLabel, documentPath } from '../documents/api';
import { ClaimDetailView } from './claim-detail';
import { ClaimConflictError, reviewKey } from './api';
const decisionLabels = {
  confirm: 'Confirmado por operador',
  accept: 'Diferencia aceptada',
  dismiss: 'Desestimado',
};
const statusLabels = {
  draft: 'Borrador',
  exported: 'Exportado · no enviado',
  sent: 'Envío registrado',
  in_review: 'Respuesta registrada',
  follow_up: 'Seguimiento pendiente',
  resolved: 'Resuelto manualmente',
  rejected: 'Rechazado',
};
type ReviewContextValue = {
  userId: string;
  organizationId: string;
  operationId: string;
  run: AnalysisRun;
  disabled: boolean;
  data: OperationReview | undefined;
  refresh: () => Promise<void>;
  openClaim: (id: string) => void;
};
const ReviewContext = createContext<ReviewContextValue | null>(null);
function useReview() {
  const value = useContext(ReviewContext);
  if (!value) throw new Error('Review context unavailable');
  return value;
}
export function ReviewWorkspace({
  userId,
  organizationId,
  operationId,
  run,
  disabled,
  children,
}: {
  userId: string;
  organizationId: string;
  operationId: string;
  run: AnalysisRun;
  disabled: boolean;
  children: ReactNode;
}) {
  const client = useQueryClient();
  const [claimId, setClaimId] = useState('');
  const query = useQuery({
    ...claimQueries.review(userId, organizationId, operationId),
    enabled: !disabled,
  });
  async function refresh() {
    await client.invalidateQueries({
      queryKey: reviewKey(userId, organizationId, operationId),
    });
  }
  return (
    <ReviewContext.Provider
      value={{
        userId,
        organizationId,
        operationId,
        run,
        disabled,
        data: query.isError ? undefined : query.data,
        refresh,
        openClaim: setClaimId,
      }}
    >
      {children}
      <section className="claims-section" aria-labelledby="operation-claims">
        <h4 id="operation-claims" tabIndex={-1}>
          Reclamos y seguimiento
        </h4>
        <p className="permission-note">
          La revisión humana no cambia el resultado del motor ni aprueba pagos.
          En este MVP se conserva un reclamo por factura, basado en un hallazgo
          explícito, sin sumar controles; los siguientes reutilizan el
          existente.
        </p>
        {query.data && (
          <p className="followup-summary" role="status">
            {followUpSummary(query.data.claims).overdue} seguimientos vencidos ·
            Próxima fecha:{' '}
            {followUpSummary(query.data.claims).next ?? 'Sin fecha'} (según tu
            fecha local)
          </p>
        )}
        {query.isPending ? (
          <Loading label="Cargando revisiones y reclamos…" />
        ) : query.isError ? (
          <RequestError
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : claimId ? (
          <ClaimDetailView
            key={claimId}
            userId={userId}
            organizationId={organizationId}
            operationId={operationId}
            claimId={claimId}
            disabled={disabled}
            onBack={() => {
              setClaimId('');
              window.requestAnimationFrame(() =>
                document.getElementById('operation-claims')?.focus(),
              );
            }}
            onChanged={refresh}
          />
        ) : query.data.claims.length === 0 ? (
          <p className="metadata">
            Todavía no hay reclamos. Revisá un hallazgo y confirmalo con un
            motivo antes de preparar una solicitud.
          </p>
        ) : (
          <DataTable
            label="Reclamos de la operación"
            searchLabel="Buscar reclamos"
            data={query.data.claims}
            getRowId={(claim) => claim.id}
            columns={[
              {
                id: 'provider',
                label: 'Proveedor',
                accessor: (claim) => claim.provider,
              },
              {
                id: 'kind',
                label: 'Solicitud',
                accessor: (claim) =>
                  claim.kind === 'clarification'
                    ? 'Aclaración'
                    : claim.currency,
                render: (claim) => (
                  <>
                    {claim.kind === 'clarification'
                      ? 'Aclaración · sin importe solicitado'
                      : `${claim.amount ?? 'Sin importe'} ${claim.currency ?? ''}`}
                    {claim.stale && (
                      <small className="file-size">
                        Fuentes modificadas · histórico
                      </small>
                    )}
                  </>
                ),
              },
              {
                id: 'status',
                label: 'Estado',
                accessor: (claim) => statusLabels[claim.status],
                render: (claim) => renderStatus(statusLabels[claim.status]),
              },
              {
                id: 'dueDate',
                label: 'Próximo seguimiento',
                accessor: (claim) => claim.dueDate ?? '',
                render: (claim) => claim.dueDate ?? 'Sin fecha',
              },
              {
                id: 'actions',
                label: 'Acciones',
                sortable: false,
                render: (claim) => (
                  <Button
                    variant="outline"
                    onClick={() => setClaimId(claim.id)}
                  >
                    Abrir reclamo
                  </Button>
                ),
              },
            ]}
          />
        )}
      </section>
    </ReviewContext.Provider>
  );
}
export function FindingReviewCell({ findingIndex }: { findingIndex: number }) {
  const {
    userId,
    organizationId,
    operationId,
    run,
    disabled,
    data,
    refresh,
    openClaim,
  } = useReview();
  const decideFindingMutation = useDecideFindingMutation(userId);
  const createClaimMutation = useCreateClaimMutation(userId);

  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<'confirm' | 'accept' | 'dismiss'>(
    'confirm',
  );
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [expectedVersion, setVersion] = useState(0);
  const [expectedFingerprint, setFingerprint] = useState('');
  const [conflict, setConflict] = useState(false);
  const mounted = useMounted();
  const finding = run.result?.findings[findingIndex];
  if (!finding) return null;
  const invoice = run.snapshot.documents.find(
    (document) => document.documentId === finding.documentId,
  );
  if (invoice?.kind !== 'invoice') return null;
  const concept =
    invoice.lines.find((line) => line.id === finding.lineId)?.description ??
    'Control de la factura';
  const history = (
    data?.decisions.filter(
      (item) => item.runId === run.id && item.findingIndex === findingIndex,
    ) ?? []
  ).toSorted((a, b) => a.ordinal - b.ordinal);
  const latest = history.at(-1);
  const claim = data?.claims.find(
    (item) => item.documentId === finding.documentId,
  );
  const canWrite = Boolean(data?.capabilities.canWrite && !disabled);
  const eligibility = claimEligibility(finding, run);
  const canPrepare =
    canWrite && latest?.action === 'confirm' && eligibility.eligible;
  return (
    <div className="finding-review">
      <Badge>
        {!data
          ? 'Comprobando revisión…'
          : latest
            ? decisionLabels[latest.action]
            : 'Sin revisar'}
      </Badge>
      {history.length > 0 && (
        <Accordion>
          <AccordionTrigger>Historial ({history.length})</AccordionTrigger>
          {history.map((item) => (
            <div className="review-history-item" key={item.id}>
              <strong>{decisionLabels[item.action]}</strong>
              <p>{item.reason}</p>
              <small>
                {item.actorId === userId ? 'Vos' : 'Integrante del equipo'} ·{' '}
                {timestampLabel(item.createdAt)}
              </small>
            </div>
          ))}
        </Accordion>
      )}
      {canWrite && (
        <Dialog
          title="Revisar hallazgo"
          description="La decisión se guarda aparte del análisis. No aprueba la factura ni registra un pago."
          trigger={
            <Button
              variant="outline"
              aria-label={`Revisar hallazgo: ${concept}`}
              disabled={disabled || run.stale}
            >
              Revisar hallazgo
            </Button>
          }
          open={open && !disabled}
          busy={busy}
          onOpenChange={(next) => {
            setOpen(next);
            if (next) {
              setAction(latest?.action ?? 'confirm');
              setReason('');
              setError('');
              setConflict(false);
              setVersion(data?.version ?? 0);
              setFingerprint(data?.fingerprint ?? '');
            }
          }}
        >
          <form
            aria-busy={busy}
            onSubmit={(event) => {
              event.preventDefault();
              if (busy || disabled || conflict || !data) return;
              setBusy(true);
              setError('');
              void (async () => {
                try {
                  await decideFindingMutation.mutateAsync([
                    organizationId,
                    operationId,
                    run.id,
                    {
                      findingIndex,
                      action,
                      reason: reason.trim(),
                      expectedVersion,
                      expectedFingerprint,
                    },
                  ]);
                  if (!mounted.current) return;
                  await refresh();
                  if (mounted.current) setOpen(false);
                } catch (error) {
                  if (!mounted.current) return;
                  setError(
                    error instanceof Error
                      ? error.message
                      : 'No se pudo guardar la decisión.',
                  );
                  if (error instanceof ClaimConflictError) {
                    setConflict(true);
                    await refresh();
                  }
                } finally {
                  if (mounted.current) setBusy(false);
                }
              })();
            }}
          >
            <Feedback message={error} error />
            <p>
              <strong>{concept}</strong> ·{' '}
              {invoice?.provider ?? 'Proveedor sin dato'} ·{' '}
              {finding.invoiced ?? 'Sin importe'} {finding.currency ?? ''}
            </p>
            <p>{finding.explanation}</p>
            <Accordion>
              <AccordionTrigger>
                Consultar evidencia ({finding.evidence.length})
              </AccordionTrigger>
              {finding.evidence.map((item, index) => (
                <div className="source-evidence" key={index}>
                  <a
                    href={documentPath(organizationId, item.documentId)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir original en otra pestaña · página {item.page}
                  </a>
                  <blockquote>{item.snippet}</blockquote>
                </div>
              ))}
            </Accordion>
            <FormField className="field">
              <Label htmlFor={`decision-${findingIndex}`}>
                Decisión humana
              </Label>
              <Select
                id={`decision-${findingIndex}`}
                value={action}
                disabled={busy}
                onValueChange={(selectedValue) => {
                  const value = selectedValue;
                  if (
                    value === 'confirm' ||
                    value === 'accept' ||
                    value === 'dismiss'
                  )
                    setAction(value);
                }}
              >
                <option value="confirm">Confirmar hallazgo</option>
                <option value="dismiss">Desestimar hallazgo</option>
                <option value="accept">Aceptar diferencia</option>
              </Select>
            </FormField>
            <p className="permission-note">
              Confirmar permite preparar una solicitud cuando hay respaldo.
              Desestimar conserva el hallazgo. Aceptar registra tu decisión sin
              modificar el acuerdo.
            </p>
            <FormField className="field">
              <Label htmlFor={`decision-reason-${findingIndex}`}>
                Motivo de la decisión
              </Label>
              <Textarea
                id={`decision-reason-${findingIndex}`}
                rows={3}
                maxLength={1000}
                required
                disabled={busy}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </FormField>
            {conflict && (
              <div className="document-warning">
                <p>
                  Última decisión registrada:{' '}
                  {latest ? decisionLabels[latest.action] : 'Sin revisar'} ·{' '}
                  {latest?.reason ?? 'Sin motivo previo'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setVersion(data?.version ?? 0);
                    setFingerprint(data?.fingerprint ?? '');
                    setConflict(false);
                    setError('');
                  }}
                >
                  Revisé la decisión actual; conservar mi borrador
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
                {busy ? 'Guardando…' : 'Guardar decisión'}
              </Button>
            </FormActions>
          </form>
        </Dialog>
      )}
      {claim ? (
        <Button variant="outline" onClick={() => openClaim(claim.id)}>
          Abrir reclamo
        </Button>
      ) : canPrepare ? (
        <Button
          variant="outline"
          pending={creating}
          onClick={() => {
            if (creating || !data) return;
            setCreating(true);
            setError('');
            void (async () => {
              try {
                const claim = await createClaimMutation.mutateAsync([
                  organizationId,
                  operationId,
                  {
                    runId: run.id,
                    findingIndex,
                    expectedVersion: data.version,
                    expectedFingerprint: data.fingerprint,
                  },
                ]);
                if (!mounted.current) return;
                await refresh();
                if (mounted.current) openClaim(claim.id);
              } catch (error) {
                if (mounted.current)
                  setError(
                    error instanceof Error
                      ? error.message
                      : 'No se pudo preparar el reclamo.',
                  );
              } finally {
                if (mounted.current) setCreating(false);
              }
            })();
          }}
        >
          Preparar reclamo
        </Button>
      ) : (
        <small>
          {run.stale
            ? 'Análisis histórico: revisá los datos actuales.'
            : !latest
              ? 'Revisión pendiente.'
              : latest.action !== 'confirm'
                ? 'La última decisión no confirma un reclamo.'
                : eligibility.reason}
        </small>
      )}
      {claim &&
        claim.stale &&
        canPrepare &&
        ['draft', 'exported'].includes(claim.status) &&
        data && (
          <RebaseDialog
            userId={userId}
            claim={claim}
            run={run}
            findingIndex={findingIndex}
            review={data}
            disabled={disabled}
            onRefresh={refresh}
            onSaved={async (id) => {
              await refresh();
              if (mounted.current) openClaim(id);
            }}
          />
        )}
      {!open && <Feedback message={error} error />}
    </div>
  );
}

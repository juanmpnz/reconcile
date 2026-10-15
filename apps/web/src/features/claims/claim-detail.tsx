import { latestDraft } from './presentation';
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClaimDetail } from '@reconcile/contracts';
import { Dialog } from '../../components/ui/dialog';
import {
  Badge,
  Button,
  Feedback,
  RequestError,
} from '../../components/ui/primitives';
import { Loading } from '../../components/ui/loading';
import { useMounted } from '../../lib/use-mounted';
import { saveOriginal, timestampLabel, documentPath } from '../documents/api';
import {
  ClaimConflictError,
  exportClaim,
  downloadClaimExport,
  getClaim,
  recordEvent,
  reviewKey,
  saveClaim,
} from './api';
const statuses = {
  draft: 'Borrador',
  exported: 'Exportado · no enviado',
  sent: 'Envío registrado',
  in_review: 'Respuesta registrada',
  follow_up: 'Seguimiento pendiente',
  resolved: 'Resuelto manualmente',
  rejected: 'Rechazado',
};
function localNow(value = new Date()) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
}
export function ClaimDetailView({
  userId,
  organizationId,
  operationId,
  claimId,
  disabled,
  onBack,
  onChanged,
}: {
  userId: string;
  organizationId: string;
  operationId: string;
  claimId: string;
  disabled: boolean;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const client = useQueryClient();
  const mounted = useMounted();
  const key = [
    ...reviewKey(userId, organizationId, operationId),
    'claim',
    claimId,
  ];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      getClaim(organizationId, operationId, claimId, signal),
    enabled: !disabled,
  });
  const [exporting, setExporting] = useState<'text' | 'dossier' | null>(null);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const [fallback, setFallback] = useState('');
  const [retainedDownload, setRetainedDownload] = useState('');
  async function refresh() {
    await client.invalidateQueries({ queryKey: key });
    await onChanged();
  }
  useEffect(() => {
    if (query.isSuccess) {
      const frame = window.requestAnimationFrame(() =>
        document.getElementById('claim-detail-heading')?.focus(),
      );
      return () => window.cancelAnimationFrame(frame);
    }
  }, [claimId, query.isSuccess]);
  if (query.isPending) return <Loading label="Cargando reclamo…" />;
  if (query.isError)
    return (
      <RequestError
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const claim = query.data;
  const draft = latestDraft(claim);
  const canWrite = claim.capabilities.canWrite && !disabled;
  const emissionAllowed =
    canWrite && !claim.stale && ['draft', 'exported'].includes(claim.status);
  async function download(format: 'text' | 'dossier') {
    if (exporting || !emissionAllowed) return;
    setExporting(format);
    setMessage('');
    try {
      const blob = await exportClaim(
        organizationId,
        operationId,
        claimId,
        claim.version,
        format,
      );
      if (!mounted.current) return;
      saveOriginal(
        blob,
        format === 'text' ? 'reclamo.txt' : 'expediente-reclamo.json',
      );
      await refresh();
      if (mounted.current) {
        setFailed(false);
        setMessage('Exportación descargada. No se envió ningún correo.');
      }
    } catch (error) {
      if (mounted.current) {
        setFailed(true);
        setMessage(
          error instanceof Error
            ? error.message
            : 'No se pudo exportar el reclamo.',
        );
      }
    } finally {
      if (mounted.current) setExporting(null);
    }
  }
  return (
    <article className="claim-detail">
      <Button variant="ghost" onClick={onBack}>
        Volver a reclamos
      </Button>
      <div className="page-header">
        <div>
          <h4 id="claim-detail-heading" tabIndex={-1}>
            Reclamo a {claim.provider}
          </h4>
          <p>
            {claim.kind === 'clarification'
              ? 'Solicitud de aclaración · sin importe solicitado'
              : `Importe cuestionado: ${claim.amount ?? 'Sin importe'} ${claim.currency ?? ''}`}
          </p>
        </div>
        <Badge>{statuses[claim.status]}</Badge>
      </div>
      <Feedback message={message} error={failed} />
      {claim.stale && (
        <div className="document-warning">
          <strong>
            Reclamo histórico: las fuentes o la confirmación cambiaron
          </strong>
          <p>
            El borrador conserva su evidencia original. Revisá el análisis
            actual antes de emitir una nueva solicitud. La exportación está
            bloqueada.
          </p>
        </div>
      )}
      {draft ? (
        <>
          <div className="claim-text">
            <strong>{draft.subject}</strong>
            <p className="metadata">
              Destinatario:{' '}
              {draft.recipientEmail ?? 'Sin destinatario indicado'}
            </p>
            <pre>{draft.body}</pre>
          </div>
          {canWrite && ['draft', 'exported'].includes(claim.status) && (
            <DraftDialog
              claim={claim}
              disabled={disabled}
              organizationId={organizationId}
              operationId={operationId}
              onSaved={refresh}
            />
          )}
          {canWrite && (
            <div className="claim-actions">
              <Button
                variant="outline"
                pending={copying}
                disabled={!emissionAllowed || Boolean(exporting)}
                onClick={() => {
                  if (copying) return;
                  setCopying(true);
                  setMessage('');
                  const text = `Para: ${draft.recipientEmail ?? 'Pendiente'}\nAsunto: ${draft.subject}\n\n${draft.body}`;
                  void (async () => {
                    try {
                      if (!navigator.clipboard)
                        throw new Error('Clipboard unavailable');
                      await navigator.clipboard.writeText(text);
                      if (mounted.current) {
                        setFailed(false);
                        setMessage(
                          'Borrador guardado copiado. No se envió ningún correo.',
                        );
                        setFallback('');
                      }
                    } catch {
                      if (mounted.current) {
                        setFallback(text);
                        setFailed(true);
                        setMessage(
                          'No se pudo copiar. Seleccioná el texto de abajo y copialo manualmente.',
                        );
                      }
                    } finally {
                      if (mounted.current) setCopying(false);
                    }
                  })();
                }}
              >
                Copiar texto guardado
              </Button>
              <Button
                variant="outline"
                pending={exporting === 'text'}
                disabled={!emissionAllowed || Boolean(exporting) || copying}
                onClick={() => {
                  void download('text');
                }}
              >
                Descargar texto
              </Button>
              <Button
                variant="outline"
                pending={exporting === 'dossier'}
                disabled={!emissionAllowed || Boolean(exporting) || copying}
                onClick={() => {
                  void download('dossier');
                }}
              >
                Exportar respaldo JSON
              </Button>
            </div>
          )}
          {fallback && (
            <div className="field">
              <label htmlFor="manual-claim-copy">
                Texto para copiar manualmente
              </label>
              <textarea
                id="manual-claim-copy"
                value={fallback}
                readOnly
                rows={8}
                onFocus={(event) => event.target.select()}
              />
            </div>
          )}
        </>
      ) : (
        <p>No hay un borrador guardado disponible.</p>
      )}
      <p className="permission-note">
        El respaldo JSON contiene el texto guardado, el hallazgo, las revisiones
        y las referencias trazables; no incluye los archivos PDF. Los originales
        siguen privados. Descargar o copiar no registra un envío.
      </p>
      <details>
        <summary>Fuentes del reclamo</summary>
        <p>{claim.finding.explanation}</p>
        {claim.finding.evidence.map((item, index) => (
          <div className="source-evidence" key={index}>
            <a href={documentPath(organizationId, item.documentId)}>
              Abrir documento original · página {item.page}
            </a>
            <blockquote>{item.snippet}</blockquote>
          </div>
        ))}
      </details>
      <div className="claim-followup">
        <h4>Seguimiento manual</h4>
        <p className="metadata">
          Próxima acción: {claim.dueDate ?? 'Sin fecha registrada'}
        </p>
        {claim.stale && ['draft', 'exported'].includes(claim.status) && (
          <p className="document-warning">
            Para registrar un envío, primero revisá el hallazgo de la ejecución
            actual y usá Actualizar respaldo en la tabla de resultados. El
            borrador histórico se conserva.
          </p>
        )}
        {canWrite && !['resolved', 'rejected'].includes(claim.status) && (
          <EventDialog
            claim={claim}
            disabled={disabled}
            organizationId={organizationId}
            operationId={operationId}
            onSaved={refresh}
          />
        )}
        <details>
          <summary>Historial de seguimiento ({claim.events.length})</summary>
          {claim.events.map((event) => (
            <div className="review-history-item" key={event.id}>
              <strong>{statuses[event.status]}</strong>
              <p>{event.reason}</p>
              <small>
                {timestampLabel(event.occurredAt)}
                {event.dueDate
                  ? ` · Próximo seguimiento: ${event.dueDate}`
                  : ''}
                {event.outcome
                  ? ` · Resultado registrado: ${{ corrected: 'Corregido', accepted: 'Aceptado sin corrección', rejected: 'Rechazado', withdrawn: 'Retirado' }[event.outcome] ?? 'Otro'}`
                  : ''}
              </small>
            </div>
          ))}
        </details>
      </div>
      <details>
        <summary>Exportaciones guardadas ({claim.exports.length})</summary>
        {claim.exports.map((item) => (
          <div className="review-history-item" key={item.id}>
            <strong>
              Versión {item.version} ·{' '}
              {item.format === 'text' ? 'Texto' : 'Respaldo JSON'}
            </strong>
            <p>{timestampLabel(item.createdAt)}</p>
            <Button
              variant="outline"
              pending={retainedDownload === item.id}
              disabled={disabled || Boolean(retainedDownload)}
              onClick={() => {
                if (retainedDownload) return;
                setRetainedDownload(item.id);
                setMessage('');
                void (async () => {
                  try {
                    const blob = await downloadClaimExport(
                      organizationId,
                      operationId,
                      claimId,
                      item.id,
                    );
                    if (!mounted.current) return;
                    saveOriginal(
                      blob,
                      item.format === 'text'
                        ? 'reclamo-version-guardada.txt'
                        : 'respaldo-version-guardada.json',
                    );
                    setFailed(false);
                    setMessage(
                      'Versión guardada descargada. El estado del reclamo no cambió.',
                    );
                  } catch (error) {
                    if (mounted.current) {
                      setFailed(true);
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : 'No se pudo descargar la versión guardada.',
                      );
                    }
                  } finally {
                    if (mounted.current) setRetainedDownload('');
                  }
                })();
              }}
            >
              Descargar versión guardada
            </Button>
          </div>
        ))}
      </details>
      <details>
        <summary>Historial de fuentes ({claim.sources.length})</summary>
        {claim.sources.map((source) => (
          <div className="review-history-item" key={source.version}>
            <strong>Fuente versión {source.version}</strong>
            <p>
              {source.reason} · {timestampLabel(source.createdAt)}
            </p>
            <p>{source.data.finding.explanation}</p>
            {source.data.documents.map((document) => (
              <p key={document.id}>
                <a href={documentPath(organizationId, document.id)}>
                  {document.filename}
                </a>
              </p>
            ))}
          </div>
        ))}
      </details>
      <details>
        <summary>Versiones del borrador ({claim.drafts.length})</summary>
        {claim.drafts.map((item) => (
          <div className="review-history-item" key={item.id}>
            <strong>
              Versión {item.version} · Fuente {item.sourceVersion} ·{' '}
              {item.subject}
            </strong>
            <p>{item.reason}</p>
            <small>{timestampLabel(item.createdAt)}</small>
            <details>
              <summary>Ver texto de esta versión</summary>
              <p>Destinatario: {item.recipientEmail ?? 'Sin destinatario'}</p>
              <pre className="claim-version-text">{item.body}</pre>
            </details>
          </div>
        ))}
      </details>
    </article>
  );
}
function DraftDialog({
  claim,
  disabled,
  organizationId,
  operationId,
  onSaved,
}: {
  claim: ClaimDetail;
  disabled: boolean;
  organizationId: string;
  operationId: string;
  onSaved: () => Promise<void>;
}) {
  const current = latestDraft(claim);
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reason, setReason] = useState('');
  const [version, setVersion] = useState(claim.version);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mounted = useMounted();
  return (
    <Dialog
      title="Editar borrador"
      description="Guardar crea una versión y conserva el texto anterior y las fuentes del reclamo."
      open={open && !disabled}
      busy={busy}
      trigger={
        <Button variant="outline" disabled={disabled || claim.stale}>
          Editar borrador
        </Button>
      }
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setRecipient(current?.recipientEmail ?? '');
          setSubject(current?.subject ?? '');
          setBody(current?.body ?? '');
          setReason('');
          setVersion(claim.version);
          setConflict(false);
          setError('');
        }
      }}
    >
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || disabled || conflict || claim.stale) return;
          setBusy(true);
          setError('');
          void (async () => {
            try {
              await saveClaim(organizationId, operationId, claim.id, {
                expectedVersion: version,
                recipientEmail: recipient.trim() || null,
                subject: subject.trim(),
                body: body.trim(),
                reason: reason.trim(),
              });
              if (!mounted.current) return;
              await onSaved();
              if (mounted.current) setOpen(false);
            } catch (error) {
              if (!mounted.current) return;
              setError(
                error instanceof Error
                  ? error.message
                  : 'No se pudo guardar el borrador.',
              );
              if (error instanceof ClaimConflictError) {
                setConflict(true);
                await onSaved();
              }
            } finally {
              if (mounted.current) setBusy(false);
            }
          })();
        }}
      >
        <Feedback error message={error} />
        <div className="field">
          <label htmlFor="claim-recipient">
            Correo del destinatario (opcional)
          </label>
          <input
            id="claim-recipient"
            type="email"
            maxLength={254}
            value={recipient}
            disabled={busy}
            onChange={(event) => setRecipient(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="claim-subject">Asunto</label>
          <input
            id="claim-subject"
            required
            maxLength={200}
            value={subject}
            disabled={busy}
            onChange={(event) => setSubject(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="claim-body">Cuerpo del correo</label>
          <textarea
            id="claim-body"
            rows={10}
            required
            maxLength={10000}
            value={body}
            disabled={busy}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="claim-draft-reason">Motivo del cambio</label>
          <textarea
            id="claim-draft-reason"
            rows={2}
            required
            maxLength={1000}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        {conflict && (
          <div className="document-warning">
            <strong>Borrador guardado actualmente</strong>
            <p>{current?.subject}</p>
            <p>{current?.recipientEmail ?? 'Sin destinatario'}</p>
            <details>
              <summary>Comparar texto guardado</summary>
              <pre className="claim-version-text">{current?.body}</pre>
            </details>
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => {
                setVersion(claim.version);
                setConflict(false);
                setError('');
              }}
            >
              Revisé la versión actual; conservar mi borrador
            </Button>
          </div>
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
              conflict || !subject.trim() || !body.trim() || !reason.trim()
            }
          >
            Guardar borrador
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
function EventDialog({
  claim,
  disabled,
  organizationId,
  operationId,
  onSaved,
}: {
  claim: ClaimDetail;
  disabled: boolean;
  organizationId: string;
  operationId: string;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<
    'sent' | 'in_review' | 'follow_up' | 'resolved' | 'rejected'
  >('sent');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(localNow);
  const [initialLocal, setInitialLocal] = useState(localNow);
  const [initialIso, setInitialIso] = useState(() => new Date().toISOString());
  const [dueDate, setDueDate] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [outcome, setOutcome] = useState<
    '' | 'corrected' | 'accepted' | 'rejected' | 'withdrawn'
  >('');
  const [version, setVersion] = useState(claim.version);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const mounted = useMounted();
  return (
    <Dialog
      title="Registrar seguimiento"
      description="Registrá una acción realizada fuera de Reconcile. No se envía ningún correo ni se acredita un cobro."
      open={open && !disabled}
      busy={busy}
      trigger={
        <Button
          variant="outline"
          disabled={
            disabled ||
            (claim.stale && ['draft', 'exported'].includes(claim.status))
          }
        >
          Registrar seguimiento
        </Button>
      }
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setStatus(
            claim.status === 'draft' || claim.status === 'exported'
              ? 'sent'
              : 'in_review',
          );
          setOutcome('');
          setReason('');
          const now = new Date();
          const local = localNow(now);
          setDate(local);
          setInitialLocal(local);
          setInitialIso(now.toISOString());
          setDueDate(claim.dueDate ?? '');
          setConfirmed(false);
          setVersion(claim.version);
          setError('');
          setConflict(false);
        }
      }}
    >
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || disabled || conflict) return;
          if (status === 'resolved' && !outcome) {
            setError('Elegí el resultado de la resolución.');
            return;
          }
          const occurredAt = new Date(
            date === initialLocal ? initialIso : date,
          );
          if (!Number.isFinite(occurredAt.getTime())) {
            setError('Revisá la fecha del registro.');
            return;
          }
          setBusy(true);
          setError('');
          void (async () => {
            try {
              await recordEvent(organizationId, operationId, claim.id, {
                expectedVersion: version,
                status,
                reason: reason.trim(),
                occurredAt: occurredAt.toISOString(),
                dueDate: dueDate || null,
                ...(status === 'sent' ? { recipientConfirmed: confirmed } : {}),
                ...(status === 'resolved' || status === 'rejected'
                  ? {
                      outcome:
                        status === 'rejected'
                          ? 'rejected'
                          : outcome || undefined,
                    }
                  : {}),
              });
              if (!mounted.current) return;
              await onSaved();
              if (mounted.current) setOpen(false);
            } catch (error) {
              if (!mounted.current) return;
              setError(
                error instanceof Error
                  ? error.message
                  : 'No se pudo registrar el seguimiento.',
              );
              if (error instanceof ClaimConflictError) {
                setConflict(true);
                await onSaved();
              }
            } finally {
              if (mounted.current) setBusy(false);
            }
          })();
        }}
      >
        <Feedback error message={error} />
        <div className="field">
          <label htmlFor="claim-status">Acción realizada</label>
          <select
            id="claim-status"
            value={status}
            disabled={busy}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === 'sent' ||
                value === 'in_review' ||
                value === 'follow_up' ||
                value === 'resolved' ||
                value === 'rejected'
              )
                setStatus(value);
            }}
          >
            {['draft', 'exported'].includes(claim.status) ? (
              <option value="sent">Registrar envío realizado</option>
            ) : (
              <>
                <option value="in_review">Registrar respuesta recibida</option>
                <option value="follow_up">Programar seguimiento</option>
                <option value="resolved">Resolver reclamo</option>
                <option value="rejected">Registrar rechazo</option>
              </>
            )}
          </select>
        </div>
        <div className="field">
          <label htmlFor="claim-event-date">Fecha y hora de la acción</label>
          <input
            id="claim-event-date"
            type="datetime-local"
            step="1"
            value={date}
            max={localNow()}
            required
            disabled={busy}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="claim-event-note">Nota o motivo</label>
          <textarea
            id="claim-event-note"
            rows={3}
            required
            maxLength={1000}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="claim-due-date">
            Próximo seguimiento
            {status === 'follow_up' ? ' (obligatorio)' : ' (opcional)'}
          </label>
          <input
            id="claim-due-date"
            type="date"
            value={dueDate}
            required={status === 'follow_up'}
            disabled={busy}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>
        {status === 'sent' && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              required
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Confirmo que envié el correo fuera de Reconcile y revisé el
            destinatario{' '}
            {latestDraft(claim)?.recipientEmail ??
              '(falta guardar el destinatario en el borrador)'}
          </label>
        )}
        {status === 'rejected' && (
          <p className="permission-note">Resultado del registro: Rechazado.</p>
        )}
        {status === 'resolved' && (
          <div className="field">
            <label htmlFor="claim-outcome">Resultado registrado</label>
            <select
              id="claim-outcome"
              required
              value={outcome}
              disabled={busy}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === '' ||
                  value === 'corrected' ||
                  value === 'accepted' ||
                  value === 'rejected' ||
                  value === 'withdrawn'
                )
                  setOutcome(value);
              }}
            >
              <option value="">Elegí el resultado de la resolución</option>
              <option value="corrected">
                Corregido según la respuesta recibida
              </option>
              <option value="accepted">Aceptado sin corrección</option>
              <option value="rejected">Rechazado</option>
              <option value="withdrawn">
                Retirado según el motivo registrado
              </option>
            </select>
          </div>
        )}
        {conflict && (
          <div className="document-warning">
            <p>
              Estado actual: {statuses[claim.status]}. Revisá el historial antes
              de volver a registrar la acción.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setVersion(claim.version);
                setConflict(false);
                setError('');
              }}
            >
              Revisé el estado actual; conservar mi registro
            </Button>
          </div>
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
              (status === 'resolved' && !outcome) ||
              !reason.trim() ||
              (status === 'sent' &&
                (!confirmed ||
                  !latestDraft(claim)?.recipientEmail ||
                  claim.stale))
            }
          >
            Guardar seguimiento
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

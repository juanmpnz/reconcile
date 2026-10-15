import { useId, useState } from 'react';
import type { AnalysisDocumentInput } from '@reconcile/contracts';
import { analysisDocumentSchema } from '@reconcile/contracts';
import { Dialog } from '../../components/ui/dialog';
import { Button, Feedback } from '../../components/ui/primitives';
import { useMounted } from '../../lib/use-mounted';
import { saveFacts } from './api';
const textFields = [
  ['provider', 'Proveedor'],
  ['operationReference', 'Referencia de operación'],
  ['currency', 'Moneda (ISO, por ejemplo USD)'],
  ['total', 'Total'],
  ['taxAmount', 'Impuestos'],
  ['serviceDate', 'Fecha de servicio (AAAA-MM-DD)'],
  ['serviceReference', 'Referencia del servicio'],
  ['route', 'Ruta o tramo'],
  ['validFrom', 'Vigente desde (AAAA-MM-DD)'],
  ['validUntil', 'Vigente hasta (AAAA-MM-DD)'],
  ['assignedProvider', 'Proveedor asignado'],
  ['performedProvider', 'Proveedor que realizó el servicio'],
] as const;
const services = [
  ['unknown', 'Sin identificar'],
  ['ocean-handling', 'Servicio base marítimo'],
  ['pickup', 'Recogida'],
] as const;
export function FactsEditor({
  organizationId,
  operationId,
  document,
  filename,
  fingerprint,
  disabled,
  onSaved,
}: {
  organizationId: string;
  operationId: string;
  document: AnalysisDocumentInput;
  filename: string;
  fingerprint: string;
  disabled: boolean;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(document);
  const [reason, setReason] = useState('');
  const [editingFingerprint, setEditingFingerprint] = useState(fingerprint);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const id = useId();
  const mounted = useMounted();
  return (
    <Dialog
      title="Revisar datos para comparar"
      description={filename}
      open={open && !disabled}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        setError('');
        if (next) {
          setDraft(structuredClone(document));
          setReason('');
          setEditingFingerprint(fingerprint);
        }
      }}
      trigger={
        <Button variant="outline" disabled={disabled}>
          Revisar datos
        </Button>
      }
    >
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || disabled) return;
          const parsed = analysisDocumentSchema.safeParse(draft);
          if (!parsed.success) {
            setError(
              'Revisá los importes (punto decimal), la moneda de tres letras y los campos de las partidas.',
            );
            return;
          }
          setBusy(true);
          setError('');
          void (async () => {
            try {
              await saveFacts(
                organizationId,
                operationId,
                editingFingerprint,
                parsed.data,
                reason.trim(),
              );
              if (!mounted.current) return;
              await onSaved();
              if (mounted.current) setOpen(false);
            } catch (error) {
              if (mounted.current)
                setError(
                  error instanceof Error
                    ? error.message
                    : 'No se pudieron guardar los datos.',
                );
            } finally {
              if (mounted.current) setBusy(false);
            }
          })();
        }}
      >
        <Feedback error message={error} />
        <p className="permission-note">
          Los campos vacíos son datos ausentes, no cero. Usá punto decimal. Se
          conserva la extracción y la evidencia originales.
        </p>
        <p className="metadata">
          Tipo de origen:{' '}
          {draft.kind === 'invoice'
            ? 'Factura'
            : draft.kind === 'agreement'
              ? 'Acuerdo o tarifa'
              : 'Registro operativo'}
          . El tipo se conserva al revisar los datos.
        </p>
        {textFields
          .filter(
            ([key]) =>
              ((key !== 'validFrom' && key !== 'validUntil') ||
                draft.kind === 'agreement') &&
              ((key !== 'assignedProvider' && key !== 'performedProvider') ||
                draft.kind === 'operational-record') &&
              ((key !== 'total' && key !== 'taxAmount' && key !== 'currency') ||
                draft.kind !== 'operational-record'),
          )
          .map(([key, label]) => (
            <div className="field" key={key}>
              <label htmlFor={`${id}-${key}`}>{label}</label>
              <input
                id={`${id}-${key}`}
                value={draft[key] ?? ''}
                disabled={busy}
                maxLength={500}
                onChange={(event) =>
                  setDraft({ ...draft, [key]: event.target.value || null })
                }
              />
            </div>
          ))}
        {draft.kind === 'agreement' && (
          <div className="field">
            <label htmlFor={`${id}-basis`}>Base del acuerdo</label>
            <select
              id={`${id}-basis`}
              value={draft.agreementBasis}
              disabled={busy}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === 'accepted' ||
                  value === 'internal-estimate' ||
                  value === 'unknown'
                )
                  setDraft({ ...draft, agreementBasis: value });
              }}
            >
              <option value="unknown">Sin verificar</option>
              <option value="accepted">Acuerdo aceptado por las partes</option>
              <option value="internal-estimate">Estimación interna</option>
            </select>
          </div>
        )}
        {draft.kind === 'operational-record' && (
          <div className="field">
            <label htmlFor={`${id}-completed`}>Estado del servicio</label>
            <select
              id={`${id}-completed`}
              value={draft.serviceStatus}
              disabled={busy}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  serviceStatus:
                    event.target.value === 'completed'
                      ? 'completed'
                      : 'unknown',
                })
              }
            >
              <option value="unknown">Sin verificar</option>
              <option value="completed">Realizado según la evidencia</option>
            </select>
          </div>
        )}
        <h3>Partidas</h3>
        {draft.lines.length === 0 && (
          <p className="metadata">
            No se identificaron partidas con evidencia en este documento.
          </p>
        )}
        {draft.lines.map((line, index) => (
          <fieldset className="analysis-line-editor" key={line.id}>
            <legend>Partida {index + 1}</legend>
            {(
              [
                ['description', 'Concepto'],
                ['route', 'Ruta o tramo'],
                ['quantity', 'Cantidad'],
                ['unit', 'Unidad'],
                ['unitPrice', 'Precio unitario'],
                ['amount', 'Importe'],
              ] as const
            ).map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={`${id}-${index}-${key}`}>{label}</label>
                <input
                  id={`${id}-${index}-${key}`}
                  value={line[key] ?? ''}
                  disabled={busy}
                  maxLength={500}
                  required={key === 'description'}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      lines: draft.lines.map((item, position) =>
                        position === index
                          ? {
                              ...item,
                              [key]:
                                key === 'description'
                                  ? event.target.value
                                  : event.target.value || null,
                            }
                          : item,
                      ),
                    })
                  }
                />
              </div>
            ))}
            <div className="field">
              <label htmlFor={`${id}-${index}-service`}>Servicio</label>
              <select
                id={`${id}-${index}-service`}
                value={line.service}
                disabled={busy}
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    value === 'unknown' ||
                    value === 'pickup' ||
                    value === 'ocean-handling'
                  )
                    setDraft({
                      ...draft,
                      lines: draft.lines.map((item, position) =>
                        position === index ? { ...item, service: value } : item,
                      ),
                    });
                }}
              >
                {services.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {line.evidence.map((item, evidenceIndex) => (
              <blockquote className="source-evidence" key={evidenceIndex}>
                Página {item.page}: {item.snippet}
              </blockquote>
            ))}
          </fieldset>
        ))}
        {draft.kind === 'agreement' && (
          <>
            {' '}
            <h3>Servicios excluidos del acuerdo</h3>
            {draft.excludedServices.length === 0 ? (
              <p className="metadata">
                No hay exclusiones identificadas con evidencia.
              </p>
            ) : (
              draft.excludedServices.map((item, index) => (
                <fieldset className="analysis-line-editor" key={index}>
                  <legend>Exclusión {index + 1}</legend>
                  <div className="field">
                    <label htmlFor={`${id}-exclude-${index}`}>
                      Servicio excluido
                    </label>
                    <select
                      id={`${id}-exclude-${index}`}
                      value={item.service}
                      disabled={busy}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (
                          value === 'unknown' ||
                          value === 'pickup' ||
                          value === 'ocean-handling'
                        )
                          setDraft({
                            ...draft,
                            excludedServices: draft.excludedServices.map(
                              (row, position) =>
                                position === index
                                  ? { ...row, service: value }
                                  : row,
                            ),
                          });
                      }}
                    >
                      {services.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor={`${id}-exclude-route-${index}`}>
                      Ruta o tramo de la exclusión
                    </label>
                    <input
                      id={`${id}-exclude-route-${index}`}
                      value={item.route ?? ''}
                      disabled={busy}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          excludedServices: draft.excludedServices.map(
                            (row, position) =>
                              position === index
                                ? { ...row, route: event.target.value || null }
                                : row,
                          ),
                        })
                      }
                    />
                  </div>
                  {item.evidence.map((entry, position) => (
                    <blockquote key={position} className="source-evidence">
                      Página {entry.page}: {entry.snippet}
                    </blockquote>
                  ))}
                </fieldset>
              ))
            )}
          </>
        )}
        <div className="field">
          <label htmlFor={`${id}-reason`}>Motivo de la revisión</label>
          <textarea
            id={`${id}-reason`}
            required
            maxLength={500}
            rows={3}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
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
          <Button pending={busy} disabled={!reason.trim()}>
            {busy ? 'Guardando…' : 'Guardar revisión'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

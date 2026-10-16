import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { operationAgreementsSchema } from '@reconcile/contracts';
import type {
  AgreementBinding,
  AgreementVersion,
  AnalysisDocumentInput,
  OperationDetail,
} from '@reconcile/contracts';
import { Dialog } from '../../components/ui/dialog';
import {
  Button,
  Feedback,
  Field,
  RequestError,
} from '../../components/ui/primitives';
import { Loading } from '../../components/ui/loading';
import { useMounted } from '../../lib/use-mounted';
import { errorMessage } from '../../lib/forms';
import { documentPath } from '../documents/api';
import { operationsKey } from '../operations/api';
import {
  AgreementConflictError,
  agreementsKey,
  listAgreements,
  setOperationAgreements,
} from './api';
import { CreateAgreementDialog } from './create-dialog';
import { applicabilityNotes, pricingLabel } from './presentation';
export function OperationAgreements({
  userId,
  organizationId,
  operation,
  filenames,
  disabled,
}: {
  userId: string;
  organizationId: string;
  operation: OperationDetail;
  filenames: Map<string, string>;
  disabled: boolean;
}) {
  const invoices = operation.facts.filter((fact) => fact.kind === 'invoice');
  return (
    <section
      className="operation-section"
      aria-labelledby="operation-agreements"
    >
      <h3 id="operation-agreements">Acuerdos por factura</h3>
      <p className="metadata">
        Elegí explícitamente una tarifa guardada o spot para cada factura. Un
        mismo proveedor puede tener ambas. El PDF se reutiliza sin volver a
        subirlo.
      </p>
      {!invoices.length ? (
        <p>
          Vinculá una factura y esperá su extracción para seleccionar sus
          condiciones.
        </p>
      ) : (
        invoices.map((invoice) => (
          <InvoiceAgreement
            key={invoice.documentId}
            userId={userId}
            organizationId={organizationId}
            operation={operation}
            invoice={invoice}
            filename={filenames.get(invoice.documentId) ?? 'Factura vinculada'}
            disabled={disabled}
          />
        ))
      )}
    </section>
  );
}
function InvoiceAgreement({
  userId,
  organizationId,
  operation,
  invoice,
  filename,
  disabled,
}: {
  userId: string;
  organizationId: string;
  operation: OperationDetail;
  invoice: AnalysisDocumentInput;
  filename: string;
  disabled: boolean;
}) {
  const binding = operation.agreementBindings.find(
    (item) => item.invoiceDocumentId === invoice.documentId,
  );
  const [created, setCreated] = useState<AgreementVersion>();
  const notes = binding
    ? applicabilityNotes(
        binding.agreement,
        invoice.provider,
        invoice.currency,
        binding.serviceDate,
        binding.route,
        binding.distanceKm ?? '',
      )
    : [
        'Sin selección explícita. Si ya vinculaste una tarifa como documento, el análisis conserva ese respaldo. Sin condiciones aplicables, los controles quedan pendientes.',
      ];
  const mutationDisabled =
    disabled ||
    operation.analyses.some(
      (run) => run.status === 'queued' || run.status === 'processing',
    );
  return (
    <article className="comparison-fact">
      <h4>{filename}</h4>
      <p>
        {invoice.provider ?? 'Proveedor pendiente de revisión'} ·{' '}
        {invoice.currency ?? 'Moneda pendiente de revisión'}
      </p>
      {binding ? (
        <>
          <p>
            <strong>{binding.agreement.name}</strong> ·{' '}
            {binding.agreement.scope === 'spot'
              ? 'Spot de esta operación'
              : 'Tarifa reutilizable'}
          </p>
          <p className="metadata">
            Versión {binding.agreementVersionId} ·{' '}
            {binding.agreement.terms.validFrom} —{' '}
            {binding.agreement.terms.validUntil}
          </p>
          <p>
            {pricingLabel(binding.agreement.terms.pricing)}{' '}
            {binding.agreement.terms.currency}
          </p>
          <p>
            Fecha del servicio: {binding.serviceDate} · Ámbito: {binding.route}{' '}
            · Distancia: {binding.distanceKm ?? 'Sin dato'} km
          </p>
          <a
            href={documentPath(
              organizationId,
              binding.agreement.sourceDocumentId,
            )}
          >
            Ver PDF del acuerdo seleccionado
          </a>
        </>
      ) : (
        <p>
          <strong>Sin acuerdo seleccionado</strong>
        </p>
      )}
      {notes.length > 0 && (
        <div className="document-warning">
          <strong>
            {binding ? 'Pendiente de verificar' : 'Sin selección explícita'}
          </strong>
          <ul>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}
      {operation.capabilities.canWrite && (
        <div className="agreement-actions">
          <SelectAgreementDialog
            userId={userId}
            organizationId={organizationId}
            operation={operation}
            invoice={invoice}
            binding={binding}
            disabled={mutationDisabled}
            created={created}
          />
          <CreateAgreementDialog
            userId={userId}
            organizationId={organizationId}
            disabled={mutationDisabled}
            label="Cargar contrato nuevo"
            onCreated={setCreated}
          />
          <CreateAgreementDialog
            userId={userId}
            organizationId={organizationId}
            operationId={operation.id}
            disabled={mutationDisabled}
            label="Cargar tarifa spot"
            onCreated={setCreated}
          />
        </div>
      )}
      {created && (
        <p role="status">
          «{created.name}» fue publicado. Usá «Seleccionar tarifa» para
          confirmar su aplicación a esta factura.
        </p>
      )}
    </article>
  );
}
function SelectAgreementDialog({
  userId,
  organizationId,
  operation,
  invoice,
  binding,
  disabled,
  created,
}: {
  userId: string;
  organizationId: string;
  operation: OperationDetail;
  invoice: AnalysisDocumentInput;
  binding: AgreementBinding | undefined;
  disabled: boolean;
  created: AgreementVersion | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState(
    binding?.agreementVersionId ?? '',
  );
  const [selectedAgreement, setSelectedAgreement] = useState<
    AgreementVersion | undefined
  >(binding?.agreement);
  const [serviceDate, setDate] = useState(
    binding?.serviceDate ?? invoice.serviceDate ?? '',
  );
  const [route, setRoute] = useState(binding?.route ?? invoice.route ?? '');
  const [distance, setDistance] = useState(binding?.distanceKm ?? '');
  const [reason, setReason] = useState('');
  const [fingerprint, setFingerprint] = useState(operation.fingerprint);
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useMounted();
  const client = useQueryClient();
  const id = useId();
  const query = useQuery({
    queryKey: [...agreementsKey(userId, organizationId), 'list', page],
    queryFn: ({ signal }) => listAgreements(organizationId, page, signal),
    enabled: open && !disabled,
  });
  const items = new Map<string, AgreementVersion>();
  for (const item of query.data?.items ?? [])
    if (item.scope === 'reusable' || item.operationId === operation.id)
      items.set(item.id, item);
  if (binding) items.set(binding.agreement.id, binding.agreement);
  if (created) items.set(created.id, created);
  if (selectedAgreement) items.set(selectedAgreement.id, selectedAgreement);
  const selected = items.get(selectedId);
  const notes = selected
    ? applicabilityNotes(
        selected,
        invoice.provider,
        invoice.currency,
        serviceDate,
        route,
        distance,
      )
    : [];
  async function save(remove = false) {
    if (busy || disabled || conflict) return;
    const others = operation.agreementBindings
      .filter((item) => item.invoiceDocumentId !== invoice.documentId)
      .map(
        ({
          invoiceDocumentId,
          agreementVersionId,
          serviceDate,
          route,
          distanceKm,
        }) => ({
          invoiceDocumentId,
          agreementVersionId,
          serviceDate,
          route,
          distanceKm,
        }),
      );
    const parsed = operationAgreementsSchema.safeParse({
      expectedFingerprint: fingerprint,
      reason,
      bindings: remove
        ? others
        : [
            ...others,
            {
              invoiceDocumentId: invoice.documentId,
              agreementVersionId: selectedId,
              serviceDate,
              route,
              distanceKm: distance.trim() || null,
            },
          ],
    });
    if (!parsed.success) {
      setError(
        'Seleccioná una tarifa, fecha válida, ámbito y motivo. La distancia usa punto decimal.',
      );
      return;
    }
    setBusy(true);
    setError('');
    try {
      await setOperationAgreements(organizationId, operation.id, parsed.data);
      await client.invalidateQueries({
        queryKey: operationsKey(userId, organizationId),
      });
      if (mounted.current) setOpen(false);
    } catch (error) {
      if (mounted.current) {
        setError(errorMessage(error));
        if (error instanceof AgreementConflictError) {
          setConflict(true);
          await client.invalidateQueries({
            queryKey: operationsKey(userId, organizationId),
          });
        }
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <Dialog
      title="Seleccionar tarifa de la factura"
      description="Confirmá la versión exacta y los datos del servicio. Cambiar o quitar el acuerdo deja desactualizados los análisis anteriores, que se conservan."
      trigger={
        <Button variant="outline" disabled={disabled}>
          {binding ? 'Cambiar tarifa' : 'Seleccionar tarifa'}
        </Button>
      }
      open={open && !disabled}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setSelectedId(created?.id ?? binding?.agreementVersionId ?? '');
          setSelectedAgreement(created ?? binding?.agreement);
          setDate(binding?.serviceDate ?? invoice.serviceDate ?? '');
          setRoute(binding?.route ?? invoice.route ?? '');
          setDistance(binding?.distanceKm ?? '');
          setReason('');
          setFingerprint(operation.fingerprint);
          setConflict(false);
          setError('');
        }
      }}
    >
      <Feedback error message={error} />
      <form
        className="agreement-form"
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {conflict && (
          <div className="document-warning">
            <p>
              Tu borrador se conservó. La selección vigente ahora es:{' '}
              {operation.agreementBindings.find(
                (item) => item.invoiceDocumentId === invoice.documentId,
              )?.agreement.name ?? 'Sin acuerdo'}
              .
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy || disabled}
              onClick={() => {
                setFingerprint(operation.fingerprint);
                setConflict(false);
                setError('');
              }}
            >
              Revisé los datos actuales; conservar mi borrador
            </Button>
          </div>
        )}
        <fieldset disabled={busy || disabled}>
          <legend>Acuerdo y contexto de aplicación</legend>
          {query.isPending ? (
            <Loading label="Cargando tarifas guardadas…" />
          ) : query.isError ? (
            <RequestError
              error={query.error}
              retry={() => {
                void query.refetch();
              }}
            />
          ) : (
            <>
              <div className="field">
                <label htmlFor={`${id}-agreement`}>
                  Tarifa guardada o spot de esta operación
                </label>
                <select
                  id={`${id}-agreement`}
                  required
                  value={selectedId}
                  onChange={(event) => {
                    setSelectedId(event.target.value);
                    setSelectedAgreement(items.get(event.target.value));
                  }}
                >
                  <option value="">Elegí explícitamente un acuerdo</option>
                  {[...items.values()].map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.terms.provider} ·{' '}
                      {item.scope === 'spot' ? 'Spot' : 'Reutilizable'} ·{' '}
                      {item.terms.route} · {item.terms.validFrom} —{' '}
                      {item.terms.validUntil} · versión {item.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pagination">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!page || query.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Anterior
                </Button>
                <span>Página {page + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={
                    (page + 1) * 25 >= query.data.total || query.isFetching
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </>
          )}
          {selected && (
            <div className="document-warning">
              <p>
                {selected.terms.provider} · {selected.terms.route} ·{' '}
                {selected.terms.validFrom} — {selected.terms.validUntil}
              </p>
              <p>
                {pricingLabel(selected.terms.pricing)} {selected.terms.currency}
              </p>
              <a
                href={documentPath(organizationId, selected.sourceDocumentId)}
                target="_blank"
                rel="noreferrer"
              >
                Revisar PDF original (otra pestaña)
              </a>
            </div>
          )}
          <div className="field">
            <label htmlFor={`${id}-date`}>Fecha del servicio</label>
            <input
              id={`${id}-date`}
              type="date"
              required
              value={serviceDate}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-route`}>Ruta o ámbito revisado</label>
            <input
              id={`${id}-route`}
              required
              maxLength={500}
              value={route}
              onChange={(event) => setRoute(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={`${id}-distance`}>Distancia revisada (km)</label>
            <input
              id={`${id}-distance`}
              inputMode="decimal"
              value={distance}
              onChange={(event) => setDistance(event.target.value)}
              aria-describedby={`${id}-distance-hint`}
            />
            <small id={`${id}-distance-hint`}>
              Obligatoria para precio por km o tramos. No se estima
              automáticamente.
            </small>
          </div>
          <Field
            name="reason"
            label="Motivo de selección, cambio o retirada"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {notes.length > 0 && (
            <div className="document-warning">
              <strong>Aplicación pendiente: no se dará por verificada</strong>
              <ul>
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </fieldset>
        <div className="dialog-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Cancelar
          </Button>
          {binding && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || disabled || conflict || !reason.trim()}
              onClick={() => {
                void save(true);
              }}
            >
              Quitar selección
            </Button>
          )}
          <Button
            pending={busy}
            disabled={disabled || conflict || !selected || !reason.trim()}
          >
            Confirmar versión y contexto
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

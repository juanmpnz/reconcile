import { ReviewWorkspace, FindingReviewCell } from '../claims/review-workspace';
import { EditOperationDialog } from './edit-dialog';
import { EvidenceList } from './evidence';
import {
  findingCounts,
  findingGroup,
  outcomeLabels,
  outcomeIcons,
  observedMissingFacts,
} from './presentation';
import { WarningsList } from './warnings';
import { useState } from 'react';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnalysisRun, OperationDetail } from '@reconcile/contracts';
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  RequestError,
  TableRegion,
} from '../../components/ui/primitives';
import { Loading } from '../../components/ui/loading';
import { navigate, organizationPath } from '../../app/router';
import { useMounted } from '../../lib/use-mounted';
import {
  documentPath,
  documentsKey,
  getDocument,
  kindLabels,
  statusLabels,
  timestampLabel,
} from '../documents/api';
import {
  getOperation,
  getAnalysis,
  listAnalysisHistory,
  operationsKey,
  requestAnalysis,
} from './api';
import { LinkDialog } from './link-dialog';
import { FactsEditor } from './facts-editor';
const runLabels: Record<AnalysisRun['status'], string> = {
  queued: 'En espera',
  processing: 'Analizando',
  completed: 'Completado · requiere revisión',
  failed: 'Error de análisis',
  blocked: 'Análisis bloqueado',
};
const serviceLabels: Record<string, string> = {
  'ocean-handling': 'Servicio base marítimo',
  pickup: 'Recogida',
  unknown: 'Servicio sin identificar',
};
const active = (run: AnalysisRun) =>
  run.status === 'queued' || run.status === 'processing';
export function OperationDetailView({
  userId,
  organizationId,
  operationId,
  authorizationPending,
}: {
  userId: string;
  organizationId: string;
  operationId: string;
  authorizationPending: boolean;
}) {
  const client = useQueryClient();
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedRun, setSelectedRun] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const query = useQuery({
    queryKey: [...operationsKey(userId, organizationId), 'detail', operationId],
    queryFn: ({ signal }) => getOperation(organizationId, operationId, signal),
    enabled: !authorizationPending,
    refetchInterval: (state) =>
      state.state.data?.analyses.some(active) ? 2000 : false,
  });
  const history = useQuery({
    queryKey: [
      ...operationsKey(userId, organizationId),
      'history',
      operationId,
      historyPage,
    ],
    queryFn: ({ signal }) =>
      listAnalysisHistory(organizationId, operationId, historyPage, signal),
    enabled: !authorizationPending && showHistory,
  });
  const historicalRun = useQuery({
    queryKey: [
      ...operationsKey(userId, organizationId),
      'run',
      operationId,
      selectedRun,
      query.data?.fingerprint ?? '',
    ],
    queryFn: ({ signal }) =>
      getAnalysis(organizationId, operationId, selectedRun, signal),
    enabled:
      !authorizationPending &&
      Boolean(selectedRun) &&
      !query.data?.analyses.some((run) => run.id === selectedRun),
  });
  const documentQueries = useQueries({
    queries: (query.data?.documentIds ?? []).map((documentId) => ({
      queryKey: [...documentsKey(userId, organizationId), 'detail', documentId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getDocument(organizationId, documentId, signal),
      enabled: !authorizationPending && query.isSuccess && !query.isError,
    })),
  });
  async function refresh() {
    await client.invalidateQueries({
      queryKey: operationsKey(userId, organizationId),
    });
  }
  async function analyze() {
    if (
      busy ||
      authorizationPending ||
      !query.data?.capabilities.canWrite ||
      query.data.analyses.some(active)
    )
      return;
    setBusy(true);
    setError('');
    try {
      const run = await requestAnalysis(
        organizationId,
        operationId,
        attemptKey,
      );
      if (!mounted.current) return;
      setAttemptKey(crypto.randomUUID());
      setSelectedRun(run.id);
      await refresh();
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar el análisis.',
        );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  if (query.isPending) return <Loading label="Cargando operación…" rows={4} />;
  if (query.isError)
    return (
      <RequestError
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const data = query.data;
  const disabled = authorizationPending;
  const canWrite = data.capabilities.canWrite && !disabled;
  const selected = selectedRun
    ? (data.analyses.find((run) => run.id === selectedRun) ??
      historicalRun.data)
    : data.analyses[0];
  const filenames = new Map(
    documentQueries.flatMap((item) =>
      item.data ? [[item.data.id, item.data.filename] as const] : [],
    ),
  );
  return (
    <section className="operation-detail">
      <p className="back-link">
        <a
          href={organizationPath(organizationId, 'operations')}
          onClick={(event) => {
            event.preventDefault();
            navigate(organizationPath(organizationId, 'operations'));
          }}
        >
          Volver a operaciones
        </a>
      </p>
      <div className="page-header">
        <div>
          <h2>{data.reference}</h2>
          <p>{data.name}</p>
        </div>
        {data.capabilities.canWrite && (
          <EditOperationDialog
            organizationId={organizationId}
            operationId={operationId}
            name={data.name}
            reference={data.reference}
            fingerprint={data.fingerprint}
            disabled={disabled}
            activeRun={data.analyses.some(active)}
            onSaved={refresh}
          />
        )}
        {data.capabilities.canWrite && (
          <Button
            pending={busy}
            disabled={
              !canWrite ||
              data.analyses.some(active) ||
              data.documentIds.length === 0
            }
            onClick={() => {
              void analyze();
            }}
          >
            {busy
              ? 'Solicitando análisis…'
              : data.analyses.length > 0
                ? 'Volver a analizar'
                : 'Analizar operación'}
          </Button>
        )}
      </div>
      {!data.capabilities.canWrite && (
        <p className="permission-note">
          Tu rol permite consultar los datos y resultados. No permite
          modificarlos ni iniciar análisis.
        </p>
      )}
      <Feedback error message={error} />
      {data.analyses.some(active) && (
        <p className="permission-note">
          Hay un análisis en curso. Podrás editar la operación y sus documentos
          cuando termine.
        </p>
      )}
      <WarningsList warnings={data.warnings} filenames={filenames} />
      {data.facts.some(
        (fact) => fact.operationReference !== data.reference,
      ) && (
        <section
          className="reference-preflight"
          aria-label="Referencias de los documentos"
        >
          <strong>Revisá las referencias antes de analizar</strong>
          <p>
            Referencia esperada de la operación: {data.reference}. Las
            referencias diferentes se analizarán como no verificables; no se
            corrigen automáticamente.
          </p>
          <TableRegion label="Referencias encontradas en los documentos">
            <table>
              <thead>
                <tr>
                  <th scope="col">Documento</th>
                  <th scope="col">Referencia encontrada</th>
                </tr>
              </thead>
              <tbody>
                {data.facts
                  .filter((fact) => fact.operationReference !== data.reference)
                  .map((fact) => (
                    <tr key={fact.documentId}>
                      <td>
                        {filenames.get(fact.documentId) ??
                          'Documento vinculado'}
                      </td>
                      <td>
                        {fact.operationReference ??
                          'Sin referencia identificada'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </TableRegion>
          <a
            href="#comparison-facts"
            onClick={() => {
              const heading = document.getElementById('comparison-facts');
              const panel = heading?.closest('details');
              if (panel) panel.open = true;
              heading?.focus();
            }}
          >
            {data.capabilities.canWrite ? 'Revisar datos' : 'Ver datos'}
          </a>
        </section>
      )}

      <Button
        variant="outline"
        pending={query.isFetching}
        disabled={authorizationPending}
        onClick={() => {
          void query.refetch();
          void Promise.all(
            documentQueries.map((document) => document.refetch()),
          );
        }}
      >
        Recargar datos
      </Button>
      <p className="permission-note">
        La comparación identifica diferencias y evidencia disponible. No aprueba
        facturas, pagos ni reclamos.
      </p>
      {query.isFetching && !data.analyses.some(active) && (
        <Loading inline label="Actualizando operación…" />
      )}
      <section
        className="operation-section"
        aria-labelledby="operation-analysis"
      >
        <h3 id="operation-analysis">Análisis</h3>
        {selectedRun &&
          historicalRun.isFetching &&
          !data.analyses.some((run) => run.id === selectedRun) && (
            <Loading label="Cargando análisis histórico…" />
          )}
        {selectedRun &&
          historicalRun.isError &&
          !data.analyses.some((run) => run.id === selectedRun) && (
            <RequestError
              error={historicalRun.error}
              retry={() => {
                void historicalRun.refetch();
              }}
            />
          )}
        {!selected && selectedRun ? null : !selected ? (
          <EmptyState
            title={
              selectedRun
                ? 'El análisis seleccionado no está disponible'
                : 'Todavía no hay análisis'
            }
          >
            <p>Vinculá documentos, revisá sus datos e iniciá la comparación.</p>
          </EmptyState>
        ) : (
          <>
            <div className="field analysis-run-select">
              <label htmlFor="analysis-run">
                Análisis recientes (últimos 5)
              </label>
              <select
                id="analysis-run"
                value={selected.id}
                onChange={(event) => setSelectedRun(event.target.value)}
              >
                {!data.analyses.some((run) => run.id === selected.id) && (
                  <option value={selected.id}>
                    {timestampLabel(selected.createdAt)} · Histórico
                  </option>
                )}
                {data.analyses.map((run) => (
                  <option value={run.id} key={run.id}>
                    {timestampLabel(run.createdAt)} · {runLabels[run.status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="document-status">
              <Badge>{runLabels[selected.status]}</Badge>
              <span className="metadata">
                Iniciado {timestampLabel(selected.createdAt)}
              </span>
            </div>
            <WarningsList
              warnings={selected.inputWarnings}
              filenames={filenames}
              historical
            />
            {selected.stale && (
              <div className="document-warning">
                <strong>Datos modificados desde este análisis</strong>
                <p>
                  Este resultado conserva los datos de su ejecución. Reanalizá
                  para comparar los datos actuales.
                </p>
              </div>
            )}
            {active(selected) && (
              <Loading
                inline
                label={
                  selected.status === 'queued'
                    ? 'Análisis en cola. Podés salir y volver más tarde.'
                    : 'Comparando partidas y evidencia…'
                }
              />
            )}
            {(selected.status === 'failed' ||
              selected.status === 'blocked') && (
              <div className="document-warning">
                <p>
                  No se pudo completar el análisis. Revisá el acceso y los
                  documentos antes de iniciar uno nuevo. Los resultados
                  anteriores siguen en el historial.
                </p>
              </div>
            )}
            {selected.result && <ResultSummary run={selected} />}
            {selected.result && (
              <ReviewWorkspace
                key={selected.id}
                userId={userId}
                organizationId={organizationId}
                operationId={operationId}
                run={selected}
                disabled={disabled}
              >
                <ResultTable
                  run={selected}
                  operation={data}
                  filenames={filenames}
                  organizationId={organizationId}
                />
              </ReviewWorkspace>
            )}
          </>
        )}
      </section>
      <details className="operation-panel">
        <summary>Documentos ({data.documentIds.length} vinculados)</summary>{' '}
        <section
          className="operation-section"
          aria-labelledby="operation-documents"
        >
          <div className="page-header">
            <h3 id="operation-documents">Documentos</h3>
            {data.capabilities.canWrite && (
              <LinkDialog
                userId={userId}
                organizationId={organizationId}
                operationId={operationId}
                documentIds={data.documentIds}
                fingerprint={data.fingerprint}
                activeRun={data.analyses.some(active)}
                disabled={disabled}
                onSaved={refresh}
              />
            )}
          </div>
          {!data.documentIds.length ? (
            <EmptyState title="No hay documentos vinculados">
              <p>
                Vinculá las facturas, el acuerdo aplicable y el registro
                operativo de esta misma operación.
              </p>
            </EmptyState>
          ) : (
            <TableRegion label="Documentos vinculados a la operación">
              <table>
                <caption className="sr-only">
                  Originales y estado de extracción
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Documento</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Extracción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.documentIds.map((id, index) => {
                    const document = documentQueries[index];
                    return (
                      <tr key={id}>
                        <td>
                          <a
                            href={documentPath(organizationId, id)}
                            onClick={(event) => {
                              if (!event.metaKey && !event.ctrlKey) {
                                event.preventDefault();
                                navigate(documentPath(organizationId, id));
                              }
                            }}
                          >
                            {document?.data?.filename ?? 'Documento vinculado'}
                          </a>
                          {document?.isError && (
                            <p className="metadata">
                              No se pudo cargar el nombre. Abrí el documento
                              para reintentar.
                            </p>
                          )}
                        </td>
                        <td>
                          {document?.data
                            ? kindLabels[document.data.kind]
                            : 'Consultando…'}
                        </td>
                        <td>
                          {document?.data
                            ? statusLabels[document.data.status]
                            : 'Consultando…'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableRegion>
          )}
        </section>
      </details>
      <details className="operation-panel">
        <summary>
          Datos para comparar ({data.facts.length} documentos ·{' '}
          {data.factRevisions.length} revisiones)
        </summary>{' '}
        <section
          className="operation-section"
          aria-labelledby="comparison-facts"
        >
          <h3 id="comparison-facts" tabIndex={-1}>
            Datos para comparar
          </h3>
          <p className="metadata">
            Revisá los candidatos extraídos antes de analizar. Los formatos no
            reconocidos y los campos ausentes no se completan con suposiciones.
          </p>

          {!data.facts.length ? (
            <p>
              No hay datos de comparación disponibles. Esperá a que finalice la
              extracción y actualizá la operación.
            </p>
          ) : (
            data.facts.map((fact) => (
              <article key={fact.documentId} className="comparison-fact">
                <div className="page-header">
                  <div>
                    <h4>
                      {filenames.get(fact.documentId) ?? 'Documento vinculado'}
                    </h4>
                    <p>
                      {fact.provider ?? 'Proveedor sin dato'} ·{' '}
                      {fact.operationReference ?? 'Referencia sin dato'} ·{' '}
                      {fact.total ?? 'Total sin dato'} {fact.currency ?? ''}
                    </p>
                  </div>
                  {data.capabilities.canWrite && (
                    <FactsEditor
                      key={fact.documentId}
                      organizationId={organizationId}
                      operationId={operationId}
                      document={fact}
                      filename={
                        filenames.get(fact.documentId) ?? 'Documento vinculado'
                      }
                      fingerprint={data.fingerprint}
                      disabled={disabled}
                      onSaved={refresh}
                    />
                  )}
                </div>
                <p className="back-link">
                  <a href={documentPath(organizationId, fact.documentId)}>
                    Ver extracción original
                  </a>
                </p>
                <p className="metadata">
                  {fact.revisionId
                    ? 'Revisión humana registrada · original conservado'
                    : 'Candidato extraído · pendiente de revisión'}{' '}
                  · {fact.lines.length} partidas ·{' '}
                  {fact.excludedServices.length} exclusiones
                </p>
                <details>
                  <summary>Ver datos y evidencia</summary>
                  <FactSummary fact={fact} />
                </details>
              </article>
            ))
          )}
        </section>
      </details>
      <details className="operation-panel">
        <summary>Historial de análisis y correcciones</summary>{' '}
        <Button
          variant="outline"
          aria-expanded={showHistory}
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory
            ? 'Ocultar historial completo'
            : 'Ver historial completo'}
        </Button>
        {showHistory && (
          <div className="analysis-history">
            {history.isPending ? (
              <Loading label="Cargando historial…" />
            ) : history.isError ? (
              <RequestError
                error={history.error}
                retry={() => {
                  void history.refetch();
                }}
              />
            ) : (
              <>
                <TableRegion label="Historial completo de análisis">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Fecha</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.data.items.map((run) => (
                        <tr key={run.id}>
                          <td>{timestampLabel(run.createdAt)}</td>
                          <td>{runLabels[run.status]}</td>
                          <td>
                            <Button
                              variant="outline"
                              onClick={() => setSelectedRun(run.id)}
                            >
                              Ver análisis
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableRegion>
                <div className="pagination">
                  <Button
                    variant="outline"
                    disabled={!historyPage || history.isFetching}
                    onClick={() => setHistoryPage(historyPage - 1)}
                  >
                    Anterior
                  </Button>
                  <span className="metadata">
                    Página {historyPage + 1} · {history.data.total} análisis
                  </span>
                  <Button
                    variant="outline"
                    disabled={
                      (historyPage + 1) * 25 >= history.data.total ||
                      history.isFetching
                    }
                    onClick={() => setHistoryPage(historyPage + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        {data.factRevisions.length > 0 && (
          <section
            className="operation-section"
            aria-labelledby="fact-revisions"
          >
            <h3 id="fact-revisions">Historial de revisión de datos</h3>
            <p className="metadata">
              Se muestran las últimas 100 revisiones. Los documentos originales
              se conservan.
            </p>
            <TableRegion label="Revisiones humanas de datos">
              <table>
                <caption className="sr-only">
                  Documento, motivo y fecha de cada revisión de datos
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Documento</th>
                    <th scope="col">Revisión</th>
                    <th scope="col">Motivo</th>
                    <th scope="col">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {data.factRevisions.map((revision) => (
                    <tr key={revision.id}>
                      <td>
                        {filenames.get(revision.documentId) ??
                          'Documento vinculado'}
                      </td>
                      <td>{revision.ordinal}</td>
                      <td>{revision.reason}</td>
                      <td>{timestampLabel(revision.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
          </section>
        )}
      </details>
    </section>
  );
}
function FactSummary({ fact }: { fact: OperationDetail['facts'][number] }) {
  return (
    <div className="fact-summary">
      <dl>
        <dt>Servicio / referencia</dt>
        <dd>{fact.serviceReference ?? 'Sin dato'}</dd>
        <dt>Fecha de servicio</dt>
        <dd>{fact.serviceDate ?? 'Sin dato'}</dd>
        <dt>Ruta o tramo</dt>
        <dd>{fact.route ?? 'Sin dato'}</dd>
        <dt>Vigencia del acuerdo</dt>
        <dd>
          {fact.validFrom ?? 'Sin dato'} — {fact.validUntil ?? 'Sin dato'}
        </dd>
        <dt>Base del acuerdo</dt>
        <dd>
          {fact.agreementBasis === 'accepted'
            ? 'Aceptado por las partes'
            : fact.agreementBasis === 'internal-estimate'
              ? 'Estimación interna'
              : 'Sin verificar'}
        </dd>
        <dt>Asignado / realizado por</dt>
        <dd>
          {fact.assignedProvider ?? 'Sin dato'} /{' '}
          {fact.performedProvider ?? 'Sin dato'}
        </dd>
        <dt>Impuestos</dt>
        <dd>{fact.taxAmount ?? 'Sin dato'}</dd>
      </dl>
      {fact.lines.map((line) => (
        <div key={line.id}>
          <strong>{line.description}</strong>
          <p>
            {line.quantity ?? 'Cantidad sin dato'}{' '}
            {line.unit ?? 'unidad sin dato'} ×{' '}
            {line.unitPrice ?? 'precio sin dato'} ={' '}
            {line.amount ?? 'importe sin dato'} {fact.currency ?? ''} ·{' '}
            {line.route ?? 'Tramo sin dato'}
          </p>
        </div>
      ))}
      {fact.excludedServices.length > 0 && (
        <section>
          <h4>Servicios excluidos del acuerdo</h4>
          {fact.excludedServices.map((excluded, index) => (
            <div key={index}>
              <strong>
                {serviceLabels[excluded.service] ?? excluded.service}
              </strong>
              <p>Ruta o tramo: {excluded.route ?? 'Sin dato'}</p>
              {excluded.evidence.map((item, position) => (
                <blockquote key={position} className="source-evidence">
                  Página {item.page}: {item.snippet}
                </blockquote>
              ))}
            </div>
          ))}
        </section>
      )}
      {fact.evidence.map((item, index) => (
        <blockquote key={index} className="source-evidence">
          Página {item.page}: {item.snippet}
        </blockquote>
      ))}
    </div>
  );
}
function ResultSummary({ run }: { run: AnalysisRun }) {
  if (!run.result) return null;
  const counts = findingCounts(run.result.findings);
  return (
    <div
      className="result-counts"
      aria-label="Resumen de controles del análisis seleccionado"
    >
      <span className="metadata">Controles del análisis:</span>
      {(Object.keys(counts) as (keyof typeof counts)[]).map((status) => (
        <span className={`result-status result-${status}`} key={status}>
          <span aria-hidden="true">{outcomeIcons[status]}</span>
          <strong>{counts[status]}</strong> {outcomeLabels[status]}
        </span>
      ))}
    </div>
  );
}
function ResultTable({
  run,
  operation,
  filenames,
  organizationId,
}: {
  run: AnalysisRun;
  operation: OperationDetail;
  filenames: Map<string, string>;
  organizationId: string;
}) {
  if (!run.result) return null;
  if (!run.result.findings.length)
    return (
      <p>
        No se encontraron partidas analizables. Revisá los datos y la evidencia
        disponible.
      </p>
    );
  return (
    <>
      {(['arithmetic', 'service'] as const).map((group) => {
        const findings =
          run.result?.findings.filter(
            (finding) => findingGroup(finding.code) === group,
          ) ?? [];
        if (!findings.length) return null;
        return (
          <section className="result-group" key={group}>
            <h4>
              {group === 'arithmetic'
                ? 'Control aritmético de partidas'
                : 'Comparación de servicios y acuerdos'}
            </h4>
            <TableRegion
              label={
                group === 'arithmetic'
                  ? 'Control aritmético de partidas'
                  : 'Comparación de partidas'
              }
            >
              <table>
                <caption className="sr-only">
                  Importes esperados, facturados y diferencias con sus motivos ·{' '}
                  {operation.reference}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Proveedor / servicio</th>
                    <th scope="col">Esperado</th>
                    <th scope="col">Facturado</th>
                    <th scope="col">Diferencia</th>
                    <th scope="col">Moneda</th>
                    <th scope="col">Resultado y motivo</th>
                    <th scope="col">Evidencia</th>
                    <th scope="col">Revisión humana</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((finding, index) => (
                    <tr key={index}>
                      <td>
                        {run.snapshot.documents.find(
                          (document) =>
                            document.documentId === finding.documentId,
                        )?.provider ?? 'Proveedor sin dato'}
                        <small className="file-size">
                          {serviceLabels[finding.service] ?? finding.service}
                        </small>
                      </td>
                      <td>{finding.expected ?? 'Sin dato'}</td>
                      <td>{finding.invoiced ?? 'Sin dato'}</td>
                      <td>{finding.difference ?? 'Sin dato'}</td>
                      <td>{finding.currency ?? 'Sin dato'}</td>
                      <td>
                        <span
                          className={`result-status result-${finding.status}`}
                        >
                          <span aria-hidden="true">
                            {outcomeIcons[finding.status]}
                          </span>
                          {outcomeLabels[finding.status]}
                        </span>
                        <p className="finding-reason">{finding.explanation}</p>
                        {observedMissingFacts(finding, run).map((note) => (
                          <p className="finding-reason" key={note}>
                            <strong>Dato ausente:</strong> {note}
                          </p>
                        ))}
                      </td>
                      <td>
                        <EvidenceList
                          evidence={finding.evidence}
                          filenames={filenames}
                          organizationId={organizationId}
                        />
                      </td>
                      <td>
                        <FindingReviewCell
                          findingIndex={
                            run.result?.findings.indexOf(finding) ?? -1
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
          </section>
        );
      })}
    </>
  );
}

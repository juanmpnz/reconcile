import { Label } from '../../design-system/controls';
import { documentQueries } from '../documents/hooks';
import { operationQueries } from './hooks';
import { useRequestAnalysisMutation, useAttachDocumentMutation } from './hooks';
import { UploadDialog } from '../documents/upload-dialog';
import {
  Accordion,
  AccordionTrigger,
  PageHeader,
} from '../../design-system/layout';
import {
  Table,
  TableCaption,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '../../design-system/table';
import { Select } from '../../design-system/select';
import {
  DataTable,
  renderLink,
  renderStatus,
} from '../../design-system/data-table';
import { OperationAgreements } from '../agreements/operation-agreements';
import { ReviewWorkspace, FindingReviewCell } from '../claims/review-workspace';
import { EditOperationDialog } from './edit-dialog';
import { EvidenceList } from './evidence';
import {
  findingCounts,
  findingGroup,
  outcomeLabels,
  outcomeIcons,
  observedMissingFacts,
  invoiceFindings,
  applicabilityEmptyMessage,
} from './presentation';
import { WarningsList } from './warnings';
import { useEffect, useState } from 'react';
import {
  queryOptions,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { AnalysisRun, OperationDetail } from '@reconcile/contracts';
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  RequestError,
  TableRegion,
} from '../../design-system/primitives';
import { Loading } from '../../design-system/loading';
import { navigate, organizationPath } from '../../app/router';
import { useMounted } from '../../lib/use-mounted';
import {
  documentPath,
  kindLabels,
  statusLabels,
  timestampLabel,
} from '../documents/api';
import { operationsKey } from './api';
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
  const attachDocumentMutation = useAttachDocumentMutation(userId);
  const requestAnalysisMutation = useRequestAnalysisMutation(userId);

  const client = useQueryClient();
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedRun, setSelectedRun] = useState('');
  const [historyPage, setHistoryPage] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID());
  const query = useQuery({
    ...operationQueries.detail(userId, organizationId, operationId),
    enabled: !authorizationPending,
    refetchInterval: (state) =>
      state.state.data?.analyses.some(active) ? 2000 : false,
  });
  const history = useQuery({
    ...operationQueries.history(
      userId,
      organizationId,
      operationId,
      historyPage,
    ),
    enabled: !authorizationPending && showHistory,
  });
  const historicalRun = useQuery({
    ...operationQueries.analysis(
      userId,
      organizationId,
      operationId,
      selectedRun,
      query.data?.fingerprint ?? '',
    ),
    enabled:
      !authorizationPending &&
      Boolean(selectedRun) &&
      !query.data?.analyses.some((run) => run.id === selectedRun),
  });
  const documentResults = useQueries({
    queries: (query.data?.documentIds ?? []).map((documentId) =>
      queryOptions({
        ...documentQueries.detail(userId, organizationId, documentId),
        enabled: !authorizationPending && query.isSuccess && !query.isError,
        refetchInterval: (state) =>
          state.state.data?.status === 'queued' ||
          state.state.data?.status === 'processing'
            ? 2000
            : false,
      }),
    ),
  });
  const extractionStates = documentResults
    .map((item) => `${item.data?.id}:${item.data?.status}`)
    .join('|');
  useEffect(() => {
    if (extractionStates)
      void client.invalidateQueries({
        queryKey: operationsKey(userId, organizationId),
      });
  }, [extractionStates, client, userId, organizationId]);
  async function attach(documentId: string) {
    const current = await client.fetchQuery(
      operationQueries.detail(userId, organizationId, operationId),
    );
    if (!current.documentIds.includes(documentId)) {
      await attachDocumentMutation.mutateAsync([
        organizationId,
        operationId,
        documentId,
        current.fingerprint,
      ]);
    }
    await refresh();
  }
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
      const run = await requestAnalysisMutation.mutateAsync([
        organizationId,
        operationId,
        attemptKey,
      ]);
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
  const analyzeDisabledReason = authorizationPending
    ? 'Comprobando permisos de acceso.'
    : busy
      ? 'Se está solicitando el análisis.'
      : data.analyses.some(active)
        ? 'Hay un análisis en curso. Esperá a que termine.'
        : data.documentIds.length === 0
          ? 'Subí o asigná una factura y su documento de referencia.'
          : documentResults.some(
                (item) =>
                  item.isPending ||
                  item.data?.status === 'queued' ||
                  item.data?.status === 'processing',
              )
            ? 'Esperá a que termine la extracción de los documentos vinculados.'
            : !documentResults.some((item) => item.data?.kind === 'invoice')
              ? 'Subí o asigná al menos una factura para comparar.'
              : undefined;
  const filenames = new Map(
    documentResults.flatMap((item) =>
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
      <PageHeader className="page-header">
        <div>
          <h2>{data.reference}</h2>
          <p>{data.name}</p>
        </div>
        <div className="operation-actions-group">
          <div className="operation-actions">
            {data.capabilities.canWrite && (
              <EditOperationDialog
                userId={userId}
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
            <Button
              variant="ghost"
              pending={query.isFetching}
              disabled={authorizationPending}
              onClick={() => {
                void query.refetch();
                void Promise.all(
                  documentResults.map((document) => document.refetch()),
                );
              }}
            >
              Recargar datos
            </Button>
            {data.capabilities.canWrite && (
              <span
                className="analysis-action"
                tabIndex={analyzeDisabledReason ? 0 : undefined}
                aria-label={
                  analyzeDisabledReason ? 'Análisis no disponible' : undefined
                }
                aria-describedby={
                  analyzeDisabledReason ? 'analysis-disabled-reason' : undefined
                }
                title={analyzeDisabledReason}
              >
                <Button
                  pending={busy}
                  disabled={!canWrite || Boolean(analyzeDisabledReason)}
                  onClick={() => {
                    void analyze();
                  }}
                >
                  {busy
                    ? 'Solicitando análisis…'
                    : data.analyses.length > 0
                      ? 'Volver a analizar'
                      : 'Comparar factura'}
                </Button>
              </span>
            )}
          </div>
          {data.capabilities.canWrite && analyzeDisabledReason && (
            <p className="permission-note" id="analysis-disabled-reason">
              {analyzeDisabledReason}
            </p>
          )}
        </div>
      </PageHeader>
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
      <p className="permission-note">
        Referencia interna del expediente: {data.reference}. No necesita
        aparecer en la factura ni en el contrato. Las referencias externas se
        revisan por su tipo y evidencia.
      </p>

      <p className="permission-note">
        La comparación identifica diferencias y evidencia disponible. No aprueba
        facturas, pagos ni reclamos.
      </p>
      {query.isFetching && !data.analyses.some(active) && (
        <Loading inline label="Actualizando operación…" />
      )}
      <section className="operation-panel">
        <section
          className="operation-section"
          aria-labelledby="operation-documents"
        >
          <PageHeader className="page-header">
            <h3 id="operation-documents">1. Preparar documentos</h3>
          </PageHeader>
          <>
            <p className="metadata">
              Los contratos, cotizaciones y tarifas aportan condiciones. Solo
              las facturas se verifican económicamente.
            </p>
            {(['reference', 'invoice', 'support'] as const)
              .filter(
                (role) =>
                  role !== 'support' ||
                  documentResults.some(
                    (item) =>
                      item.data &&
                      item.data.kind !== 'invoice' &&
                      item.data.kind !== 'tariff' &&
                      item.data.kind !== 'quotation',
                  ),
              )
              .map((role) => (
                <section
                  key={role}
                  aria-label={
                    role === 'reference'
                      ? 'Documentos de referencia'
                      : role === 'invoice'
                        ? 'Facturas a verificar'
                        : 'Documentos de apoyo'
                  }
                >
                  <h4>
                    {role === 'reference'
                      ? 'Documentos de referencia'
                      : role === 'invoice'
                        ? 'Facturas a verificar'
                        : 'Documentos de apoyo'}
                  </h4>
                  {role !== 'support' && (
                    <>
                      <p className="metadata">
                        {role === 'reference'
                          ? 'Proponé el contrato, cotización o tarifa que contiene los precios. Vincularlo no confirma que sus condiciones apliquen.'
                          : 'Subí la factura cuyos cargos querés comprobar contra la fuente de referencia.'}
                      </p>
                      {data.capabilities.canWrite && (
                        <div className="operation-actions">
                          <UploadDialog
                            userId={userId}
                            organizationId={organizationId}
                            disabled={
                              !canWrite ||
                              busy ||
                              data.analyses.some(active) ||
                              data.documentIds.length >= 20
                            }
                            defaultKind={
                              role === 'reference' ? 'tariff' : 'invoice'
                            }
                            allowedKinds={
                              role === 'reference'
                                ? ['tariff', 'quotation']
                                : ['invoice']
                            }
                            label={
                              role === 'reference'
                                ? 'Subir contrato o tarifa'
                                : 'Subir factura'
                            }
                            onUploaded={attach}
                          />
                          <LinkDialog
                            userId={userId}
                            organizationId={organizationId}
                            operationId={operationId}
                            documentIds={data.documentIds}
                            fingerprint={data.fingerprint}
                            activeRun={data.analyses.some(active)}
                            disabled={!canWrite || busy}
                            onSaved={refresh}
                            allowedKinds={
                              role === 'reference'
                                ? ['tariff', 'quotation']
                                : ['invoice']
                            }
                            label={
                              role === 'reference'
                                ? 'Asignar referencia existente'
                                : 'Asignar factura existente'
                            }
                          />
                        </div>
                      )}
                    </>
                  )}
                  <DataTable
                    label={
                      role === 'reference'
                        ? 'Documentos de referencia'
                        : role === 'invoice'
                          ? 'Facturas a verificar'
                          : 'Documentos de apoyo'
                    }
                    searchLabel="Buscar documentos vinculados"
                    emptyMessage={
                      role === 'reference'
                        ? 'Todavía no hay una fuente de referencia vinculada. Subí o asigná un contrato, cotización o tarifa.'
                        : role === 'invoice'
                          ? 'Todavía no hay una factura vinculada. Subí o asigná la factura que querés comprobar.'
                          : 'No hay documentos de apoyo vinculados.'
                    }
                    data={data.documentIds
                      .map((id, index) => ({
                        id,
                        query: documentResults[index],
                      }))
                      .filter((item) => {
                        const kind = item.query?.data?.kind;
                        return role === 'reference'
                          ? kind === 'quotation' || kind === 'tariff'
                          : role === 'invoice'
                            ? kind === 'invoice'
                            : kind !== 'quotation' &&
                              kind !== 'tariff' &&
                              kind !== 'invoice';
                      })}
                    getRowId={(item) => item.id}
                    columns={[
                      {
                        id: 'document',
                        label: 'Documento',
                        accessor: (item) =>
                          item.query?.data?.filename ?? 'Documento vinculado',
                        render: (item) => (
                          <>
                            {renderLink(
                              item.query?.data?.filename ??
                                'Documento vinculado',
                              documentPath(organizationId, item.id),
                              navigate,
                            )}
                            {item.query?.isError && (
                              <p className="metadata">
                                No se pudo cargar el nombre. Abrí el documento
                                para reintentar.
                              </p>
                            )}
                          </>
                        ),
                      },
                      {
                        id: 'kind',
                        label: 'Tipo',
                        accessor: (item) =>
                          item.query?.data
                            ? kindLabels[item.query.data.kind]
                            : 'Consultando…',
                      },
                      {
                        id: 'status',
                        label: 'Extracción',
                        accessor: (item) =>
                          item.query?.data
                            ? statusLabels[item.query.data.status]
                            : 'Consultando…',
                      },
                    ]}
                  />
                </section>
              ))}
          </>
        </section>
      </section>
      <Accordion className="operation-panel" open>
        <AccordionTrigger>
          2. Revisar datos para comparar ({data.facts.length} documentos ·{' '}
          {data.factRevisions.length} revisiones)
        </AccordionTrigger>{' '}
        <section
          className="operation-section"
          aria-labelledby="comparison-facts"
        >
          <h3 id="comparison-facts" tabIndex={-1}>
            Revisar datos para comparar
          </h3>
          <p className="metadata">
            Revisá los candidatos extraídos antes de analizar. Corregir una
            lectura conserva el original y no modifica el contrato. Los formatos
            no reconocidos y los campos ausentes no se completan con
            suposiciones.
          </p>

          {!data.facts.length ? (
            <p>
              No hay datos de comparación disponibles. Esperá a que finalice la
              extracción y actualizá la operación.
            </p>
          ) : (
            data.facts.map((fact) => (
              <article key={fact.documentId} className="comparison-fact">
                <PageHeader className="page-header">
                  <div>
                    <h4>
                      {filenames.get(fact.documentId) ?? 'Documento vinculado'}
                    </h4>
                    <p>
                      {fact.provider ?? 'Proveedor sin dato'} ·{' '}
                      {fact.operationReference ?? 'Referencia sin dato'} ·{' '}
                      {fact.kind === 'invoice'
                        ? `${fact.total ?? 'Total sin dato'} ${fact.currency ?? ''}`
                        : fact.kind === 'agreement'
                          ? 'Fuente de precios y condiciones'
                          : 'Evidencia operativa'}
                    </p>
                  </div>
                  {data.capabilities.canWrite && (
                    <FactsEditor
                      userId={userId}
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
                </PageHeader>
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
                <Accordion>
                  <AccordionTrigger>Ver datos y evidencia</AccordionTrigger>
                  <FactSummary fact={fact} />
                </Accordion>
              </article>
            ))
          )}
        </section>
      </Accordion>
      <section
        className="operation-section"
        aria-labelledby="operation-analysis"
      >
        <h3 id="operation-analysis">
          3. Comparar factura y revisar resultados
        </h3>
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
              <Label htmlFor="analysis-run">
                Análisis recientes (últimos 5)
              </Label>
              <Select
                id="analysis-run"
                value={selected.id}
                onValueChange={(selectedValue) => setSelectedRun(selectedValue)}
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
              </Select>
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
                <p>
                  Motivo registrado:{' '}
                  {selected.errorCode ?? 'Sin detalle disponible'}.
                </p>
                <a href="#operation-documents">
                  Revisar documentos y estados de extracción
                </a>
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
      <OperationAgreements
        userId={userId}
        organizationId={organizationId}
        operation={data}
        filenames={filenames}
        disabled={disabled || busy || query.isFetching}
      />
      <Accordion className="operation-panel">
        <AccordionTrigger>
          Historial de análisis y correcciones
        </AccordionTrigger>{' '}
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
                <DataTable
                  label="Historial completo de análisis"
                  mode="server"
                  data={history.data.items}
                  getRowId={(run) => run.id}
                  pagination={{ pageIndex: historyPage, pageSize: 25 }}
                  rowCount={history.data.total}
                  pageSizes={[25]}
                  onPaginationChange={(next) => setHistoryPage(next.pageIndex)}
                  busy={history.isFetching}
                  columns={[
                    {
                      id: 'date',
                      label: 'Fecha',
                      render: (run) => timestampLabel(run.createdAt),
                    },
                    {
                      id: 'status',
                      label: 'Estado',
                      render: (run) => renderStatus(runLabels[run.status]),
                    },
                    {
                      id: 'actions',
                      label: 'Acciones',
                      render: (run) => (
                        <Button
                          variant="outline"
                          onClick={() => setSelectedRun(run.id)}
                        >
                          Ver análisis
                        </Button>
                      ),
                    },
                  ]}
                />
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
            <DataTable
              label="Revisiones humanas de datos (últimas 100)"
              searchLabel="Buscar en las últimas 100 revisiones"
              data={data.factRevisions}
              getRowId={(revision) => revision.id}
              columns={[
                {
                  id: 'document',
                  label: 'Documento',
                  accessor: (revision) =>
                    filenames.get(revision.documentId) ?? 'Documento vinculado',
                },
                {
                  id: 'ordinal',
                  label: 'Revisión',
                  accessor: (revision) => revision.ordinal,
                },
                {
                  id: 'reason',
                  label: 'Motivo',
                  accessor: (revision) => revision.reason,
                },
                {
                  id: 'date',
                  label: 'Fecha',
                  accessor: (revision) => revision.createdAt,
                  render: (revision) => timestampLabel(revision.createdAt),
                },
              ]}
            />
          </section>
        )}
      </Accordion>
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
          <dl>
            <dt>Cantidad / unidad</dt>
            <dd>
              {line.quantity ?? 'Sin dato'} / {line.unit ?? 'Sin dato'}
            </dd>
            <dt>Importe de la partida</dt>
            <dd>
              {line.amount ?? 'Sin dato'}{' '}
              {line.currency ?? fact.currency ?? 'Moneda sin dato'}
            </dd>
            <dt>Precio unitario en moneda del importe</dt>
            <dd>
              {line.unitPrice ?? 'Sin dato'}{' '}
              {line.currency ?? fact.currency ?? 'Moneda sin dato'}
            </dd>
            {(line.tariffUnitPrice != null || line.tariffCurrency != null) && (
              <>
                <dt>Precio unitario original del documento</dt>
                <dd>
                  {line.tariffUnitPrice ?? 'Sin dato'}{' '}
                  {line.tariffCurrency ?? 'Moneda sin dato'}
                </dd>
              </>
            )}
            <dt>Ruta o tramo</dt>
            <dd>{line.route ?? 'Sin dato'}</dd>
            {line.pricingTerms && (
              <>
                <dt>Condiciones de precio documentadas</dt>
                <dd>
                  {line.pricingTerms.behavior === 'fixed'
                    ? 'Precio fijo'
                    : line.pricingTerms.behavior === 'variable'
                      ? 'Precio variable'
                      : 'Variación sin determinar'}{' '}
                  ·{' '}
                  {line.pricingTerms.cadence === 'monthly'
                    ? 'Mensual'
                    : line.pricingTerms.cadence === 'annual'
                      ? 'Anual'
                      : line.pricingTerms.cadence === 'per-unit'
                        ? 'Por unidad'
                        : 'Periodicidad sin determinar'}
                  {' · '}
                  {line.pricingTerms.validFrom ?? 'Inicio sin dato'} —{' '}
                  {line.pricingTerms.validUntil ?? 'Fin sin dato'}
                </dd>
              </>
            )}
          </dl>
        </div>
      ))}
      {(fact.exchangeRates?.length ?? 0) > 0 && (
        <section>
          <h4>Tipos de cambio registrados en el documento</h4>
          <p>
            Son datos extraídos de la fuente; no implican una conversión
            aplicada ni validada por el análisis.
          </p>
          {fact.exchangeRates?.map((exchangeRate, index) => (
            <div key={index}>
              <p>
                1 {exchangeRate.from} = {exchangeRate.rate} {exchangeRate.to}
              </p>
              {exchangeRate.evidence.map((item, position) => (
                <blockquote key={position} className="source-evidence">
                  Página {item.page}: {item.snippet}
                </blockquote>
              ))}
            </div>
          ))}
        </section>
      )}
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
  const counts = findingCounts(invoiceFindings(run));
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
function CandidateComparison({
  run,
  filenames,
  organizationId,
}: {
  run: AnalysisRun;
  filenames: Map<string, string>;
  organizationId: string;
}) {
  const candidates = run.result?.comparisonCandidates;
  if (!candidates?.length) return null;
  return (
    <section
      className="result-group"
      aria-label="Comparación de factura contra referencia"
    >
      <h4>Comparación de factura contra referencia</h4>
      <p className="metadata">
        La coincidencia de precio se muestra por separado de las condiciones
        pendientes. Estos resultados proponen una comparación; no confirman un
        reclamo ni un ahorro.
      </p>
      <DataTable
        label="Partidas de factura y referencia propuesta"
        searchLabel="Buscar concepto de factura o referencia"
        data={candidates}
        getRowId={(item) =>
          `${item.invoiceDocumentId}:${item.lineId}:${item.referenceDocumentId ?? 'none'}:${item.referenceLineId ?? 'none'}`
        }
        columns={[
          {
            id: 'invoice',
            label: 'Factura / concepto',
            accessor: (item) =>
              `${filenames.get(item.invoiceDocumentId) ?? 'Factura'} ${item.invoiceConcept}`,
            render: (item) => (
              <>
                <strong>{item.invoiceConcept}</strong>
                <p>
                  {filenames.get(item.invoiceDocumentId) ?? 'Factura vinculada'}
                </p>
              </>
            ),
          },
          {
            id: 'reference',
            label: 'Referencia propuesta',
            accessor: (item) => item.referenceConcept,
            render: (item) => (
              <>
                {item.referenceConcept ?? 'Sin concepto compatible'}
                <p>
                  {item.referenceDocumentId
                    ? (filenames.get(item.referenceDocumentId) ??
                      'Documento de referencia')
                    : 'Sin fuente identificada'}
                </p>
              </>
            ),
          },
          {
            id: 'prices',
            label: 'Precios unitarios comparados',
            render: (item) => (
              <>
                <p>
                  Referencia: {item.expectedUnitPrice ?? 'Sin dato'}{' '}
                  {item.expectedCurrency ?? 'Moneda sin dato'}
                </p>
                <p>
                  Factura: {item.actualUnitPrice ?? 'Sin dato'}{' '}
                  {item.actualCurrency ?? 'Moneda sin dato'}
                </p>
                <p>
                  {item.priceStatus === 'equal'
                    ? 'Precio coincidente'
                    : item.priceStatus === 'different'
                      ? 'Precio diferente'
                      : 'Precio no verificable'}
                </p>
              </>
            ),
          },
          {
            id: 'amounts',
            label: 'Importes comparables',
            render: (item) => (
              <>
                <p>
                  Esperado: {item.expectedAmount ?? 'Sin dato'}{' '}
                  {item.currency ?? ''}
                </p>
                <p>
                  Factura: {item.actualAmount ?? 'Sin dato'}{' '}
                  {item.currency ?? ''}
                </p>
                <p>
                  Diferencia: {item.difference ?? 'Sin dato'}{' '}
                  {item.currency ?? ''}
                </p>
              </>
            ),
          },
          {
            id: 'status',
            label: 'Resultado y pendientes',
            accessor: (item) => item.status,
            render: (item) => (
              <>
                <Badge>
                  {item.status === 'correct'
                    ? 'Correcto según condiciones verificadas'
                    : item.status === 'difference'
                      ? 'Diferencia detectada'
                      : 'Pendiente de verificar'}
                </Badge>
                <ul>
                  {item.reasons.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
                <a href="#comparison-facts">
                  Revisar datos y condiciones extraídas
                </a>
              </>
            ),
          },
        ]}
        expandedContent={(item) => {
          const invoiceLine = run.snapshot.documents
            .find((doc) => doc.documentId === item.invoiceDocumentId)
            ?.lines.find((line) => line.id === item.lineId);
          return (
            <>
              <h5>Cálculo y evidencia de {item.invoiceConcept}</h5>
              <p>
                {item.calculation ??
                  'No hay un cálculo verificable con los datos disponibles.'}
              </p>
              <p>
                Cantidad registrada en la factura: {item.quantity ?? 'Sin dato'}
                . No acredita por sí sola el servicio realizado.
              </p>
              {invoiceLine && (
                <p>
                  Importe registrado en la factura:{' '}
                  {invoiceLine.amount ?? 'Sin dato'}{' '}
                  {invoiceLine.currency ??
                    run.snapshot.documents.find(
                      (doc) => doc.documentId === item.invoiceDocumentId,
                    )?.currency ??
                    'Moneda sin dato'}
                  .
                </p>
              )}
              {invoiceLine?.tariffUnitPrice != null && (
                <p>
                  Precio unitario original de la factura:{' '}
                  {invoiceLine.tariffUnitPrice}{' '}
                  {invoiceLine.tariffCurrency ?? 'Moneda sin dato'}.
                </p>
              )}
              <ul>
                {item.conditions.map((condition, index) => (
                  <li key={index}>
                    <strong>{conditionLabel(condition.name)}</strong>:{' '}
                    {condition.state === 'verified'
                      ? 'Verificada'
                      : condition.state === 'contradictory'
                        ? 'Contradicción'
                        : condition.state === 'unrestricted'
                          ? 'Sin restricción'
                          : 'Pendiente'}{' '}
                    · {condition.reason}
                  </li>
                ))}
              </ul>
              <EvidenceList
                evidence={item.evidence}
                filenames={filenames}
                organizationId={organizationId}
              />
              <p className="permission-note">
                Esta propuesta no habilita acciones de reclamo.
              </p>
            </>
          );
        }}
      />
    </section>
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
  return (
    <>
      <CandidateComparison
        run={run}
        filenames={filenames}
        organizationId={organizationId}
      />
      <Accordion open={!run.result.comparisonCandidates?.length}>
        <AccordionTrigger>
          Controles detallados y aplicabilidad del análisis
        </AccordionTrigger>

        <section
          className="operation-section"
          aria-label="Aplicabilidad de acuerdos"
        >
          <h4>Aplicabilidad de acuerdos</h4>
          <p>
            La vinculación documental identifica el origen. La selección humana
            no elimina condiciones pendientes o contradictorias.
          </p>
          {(run.result.agreementDecisions ?? []).map((decision, index) => (
            <article className="comparison-fact" key={index}>
              <h5>
                {filenames.get(decision.agreementDocumentId) ??
                  'Acuerdo candidato'}{' '}
                ·{' '}
                {decision.state === 'applicable'
                  ? 'Aplicable'
                  : decision.state === 'pending'
                    ? 'Pendiente de confirmar'
                    : 'No aplicable'}
              </h5>
              <p>
                Versión:{' '}
                {decision.agreementVersionId ??
                  'Datos documentales del análisis'}{' '}
                · Partida: {decision.lineId}
              </p>
              <p>{decision.reason}</p>
              <ul>
                {decision.conditions.map((condition, position) => (
                  <li key={position}>
                    <strong>{conditionLabel(condition.name)}</strong>:{' '}
                    {condition.state === 'verified'
                      ? 'Verificada'
                      : condition.state === 'unknown'
                        ? 'Dato pendiente'
                        : condition.state === 'contradictory'
                          ? 'Contradicción'
                          : 'Sin restricción'}{' '}
                    · {condition.reason}
                  </li>
                ))}
              </ul>
              <EvidenceList
                evidence={decision.evidence}
                filenames={filenames}
                organizationId={organizationId}
              />
            </article>
          ))}
          {!run.result.agreementDecisions?.length && (
            <p>{applicabilityEmptyMessage(run.result.agreementDecisions)}</p>
          )}
        </section>
        <h4>Resultados económicos de facturas</h4>
        {invoiceFindings(run).length !== run.result.findings.length && (
          <Accordion>
            <AccordionTrigger>
              Controles de documentos de referencia y apoyo del resultado
              original
            </AccordionTrigger>
            <p className="permission-note">
              Se conserva la evidencia original, sin presentarla como cargos
              facturados ni habilitar reclamos sobre estos documentos.
            </p>
            {run.result.findings
              .filter((finding) => !invoiceFindings(run).includes(finding))
              .map((finding, index) => (
                <article key={index}>
                  <h5>
                    {finding.documentId
                      ? (filenames.get(finding.documentId) ??
                        'Documento de referencia o apoyo')
                      : 'Control general'}
                  </h5>
                  <p>{finding.explanation}</p>
                  <EvidenceList
                    evidence={finding.evidence}
                    filenames={filenames}
                    organizationId={organizationId}
                  />
                </article>
              ))}
          </Accordion>
        )}
        {!invoiceFindings(run).length && (
          <p>
            No hay partidas analizables. Revisá los datos y la evidencia
            disponible.
          </p>
        )}
        {(['arithmetic', 'service'] as const).map((group) => {
          const findings = invoiceFindings(run).filter(
            (finding) => findingGroup(finding.code) === group,
          );
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
                <Table>
                  <TableCaption className="sr-only">
                    Importes esperados, facturados y diferencias con sus motivos
                    · {operation.reference}
                  </TableCaption>
                  <TableHead>
                    <TableRow>
                      <TableHeader scope="col">
                        Proveedor / servicio
                      </TableHeader>
                      <TableHeader scope="col">Esperado</TableHeader>
                      <TableHeader scope="col">Facturado</TableHeader>
                      <TableHeader scope="col">Diferencia</TableHeader>
                      <TableHeader scope="col">Moneda</TableHeader>
                      <TableHeader scope="col">Resultado y motivo</TableHeader>
                      <TableHeader scope="col">Evidencia</TableHeader>
                      <TableHeader scope="col">Revisión humana</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {findings.map((finding, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <strong>
                            {(finding.documentId &&
                              filenames.get(finding.documentId)) ||
                              'Factura'}
                          </strong>
                          {run.snapshot.documents.find(
                            (document) =>
                              document.documentId === finding.documentId,
                          )?.provider ?? 'Proveedor sin dato'}
                          <small className="file-size">
                            {serviceLabels[finding.service] ?? finding.service}
                          </small>
                        </TableCell>
                        <TableCell>{finding.expected ?? 'Sin dato'}</TableCell>
                        <TableCell>{finding.invoiced ?? 'Sin dato'}</TableCell>
                        <TableCell>
                          {finding.difference ?? 'Sin dato'}
                        </TableCell>
                        <TableCell>{finding.currency ?? 'Sin dato'}</TableCell>
                        <TableCell>
                          <span
                            className={`result-status result-${finding.status}`}
                          >
                            <span aria-hidden="true">
                              {outcomeIcons[finding.status]}
                            </span>
                            {outcomeLabels[finding.status]}
                          </span>
                          <p className="finding-reason">
                            {finding.explanation}
                          </p>
                          {observedMissingFacts(finding, run).map((note) => (
                            <p className="finding-reason" key={note}>
                              <strong>Dato ausente:</strong> {note}
                            </p>
                          ))}
                        </TableCell>
                        <TableCell>
                          <EvidenceList
                            evidence={finding.evidence}
                            filenames={filenames}
                            organizationId={organizationId}
                          />
                        </TableCell>
                        <TableCell>
                          <FindingReviewCell
                            findingIndex={
                              run.result?.findings.indexOf(finding) ?? -1
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableRegion>
            </section>
          );
        })}
      </Accordion>
    </>
  );
}

function conditionLabel(name: string): string {
  const labels: Record<string, string> = {
    provider: 'Proveedor',
    contractingParty: 'Parte contratante',
    origin: 'Origen',
    destination: 'Destino',
    service: 'Servicio',
    transportMode: 'Modalidad de transporte',
    equipmentType: 'Tipo de equipo',
    validity: 'Vigencia',
    operationReference: 'Referencia operativa',
    dateBasis: 'Fecha relevante',
  };
  return labels[name] ?? name;
}

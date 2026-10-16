import { DataTable } from '../../components/ui/data-table';
import { MetadataDialog } from './metadata-dialog';
import { OperationLinks } from './operation-links';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExtractionFieldName } from '@reconcile/contracts';
import {
  Badge,
  Button,
  Feedback,
  RequestError,
} from '../../components/ui/primitives';
import { Loading } from '../../components/ui/loading';
import { navigate, organizationPath } from '../../app/router';
import { errorMessage } from '../../lib/forms';
import { useMounted } from '../../lib/use-mounted';
import {
  bytesLabel,
  documentsKey,
  downloadDocument,
  saveOriginal,
  getDocument,
  isProcessing,
  kindLabels,
  retryDocument,
  statusLabels,
  timestampLabel,
} from './api';
import { CorrectionDialog } from './correction-dialog';
const fieldLabels: Record<ExtractionFieldName, string> = {
  provider: 'Proveedor',
  documentNumber: 'Número de documento',
  operationReference: 'Referencia de operación',
  date: 'Fecha',
  currency: 'Moneda',
  total: 'Total',
};
const fieldStatusLabels = {
  extracted: 'Extraído',
  missing: 'Sin dato',
  ambiguous: 'Ambiguo',
};
const warningLabels: Record<string, string> = {
  HUMAN_REVIEW_REQUIRED: 'Los datos requieren revisión humana.',
  LABEL_BASED_EXTRACTION:
    'La extracción básica reconoce etiquetas y puede omitir formatos no reconocidos.',
  OCR_UNSUPPORTED:
    'El OCR para documentos escaneados todavía no está disponible.',
};
const errorLabels: Record<string, string> = {
  PDF_ENCRYPTED:
    'El PDF está protegido con contraseña. Subí una copia sin protección. ',
  PDF_PAGE_LIMIT: 'El PDF supera el límite de 50 páginas. ',
  PDF_TEXT_LIMIT:
    'El documento supera el límite de texto que podemos procesar. ',
  PDF_TIMEOUT:
    'El procesamiento tardó demasiado. Probá con un PDF más pequeño. ',
  PDF_RESOURCE_LIMIT: 'El documento requiere más recursos de los disponibles. ',
  PDF_INVALID:
    'No pudimos leer este PDF. Revisá que el archivo se abra correctamente. ',
  ORIGINAL_INTEGRITY_ERROR:
    'El original no superó la comprobación de integridad. Consultá con un administrador. ',
  ACCESS_REVOKED:
    'El procesamiento se detuvo porque cambió el acceso de quien lo solicitó. ',
  PROCESSING_RETRIES_EXHAUSTED:
    'El servicio agotó los reintentos. Podés volver a intentar más tarde. ',
  STORAGE_UNAVAILABLE: 'El archivo no está disponible temporalmente. ',
  OCR_UNSUPPORTED:
    'Este documento escaneado requiere OCR, todavía no disponible. ',
};
export function DocumentDetailView({
  userId,
  organizationId,
  documentId,
  authorizationPending,
}: {
  userId: string;
  organizationId: string;
  documentId: string;
  authorizationPending: boolean;
}) {
  const queryClient = useQueryClient();
  const mounted = useMounted();
  const [downloading, setDownloading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const document = useQuery({
    queryKey: [...documentsKey(userId, organizationId), 'detail', documentId],
    queryFn: ({ signal }) => getDocument(organizationId, documentId, signal),
    enabled: !authorizationPending,
    refetchInterval: (query) =>
      query.state.data && isProcessing(query.state.data.status) ? 2000 : false,
  });
  async function retry() {
    if (
      retrying ||
      authorizationPending ||
      !document.data?.capabilities.canWrite
    )
      return;
    setRetrying(true);
    setMessage('');
    try {
      await retryDocument(organizationId, documentId);
      if (!mounted.current) return;
      await queryClient.invalidateQueries({
        queryKey: documentsKey(userId, organizationId),
      });
      setFailed(false);
      setMessage(
        'La extracción volvió a la cola. Podés salir de esta pantalla mientras se procesa.',
      );
    } catch (error) {
      setFailed(true);
      setMessage(errorMessage(error));
    } finally {
      setRetrying(false);
    }
  }
  async function download() {
    if (!document.data || downloading || authorizationPending) return;
    setDownloading(true);
    setMessage('');
    try {
      const original = await downloadDocument(organizationId, documentId);
      if (!mounted.current) return;
      saveOriginal(original, document.data.filename);
    } catch (error) {
      setFailed(true);
      setMessage(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  }
  if (document.isPending)
    return <Loading label="Cargando documento…" rows={3} />;
  if (document.isError)
    return (
      <RequestError
        error={document.error}
        retry={() => {
          void document.refetch();
        }}
      />
    );
  const data = document.data;
  const run = data.latestRun;
  const extraction = run?.result;
  const canCorrect =
    data.capabilities.canWrite &&
    !authorizationPending &&
    !document.isFetching &&
    !isProcessing(data.status);
  return (
    <section className="document-detail">
      <p className="back-link">
        <a
          href={organizationPath(organizationId, 'documents')}
          onClick={(event) => {
            event.preventDefault();
            navigate(organizationPath(organizationId, 'documents'));
          }}
        >
          Volver a documentos
        </a>
      </p>
      <div className="page-header">
        <div>
          <h2>{data.filename}</h2>
          <p>
            {kindLabels[data.kind]} · {bytesLabel(data.sizeBytes)} · Cargado{' '}
            {timestampLabel(data.createdAt)}
          </p>
        </div>
        {data.capabilities.canWrite && (
          <MetadataDialog
            userId={userId}
            organizationId={organizationId}
            document={data}
            disabled={authorizationPending}
            onSaved={() => {
              setFailed(false);
              setMessage(
                'Datos del documento actualizados. Revisá y reanalizá las operaciones si corresponde.',
              );
            }}
          />
        )}
        <Button
          variant="outline"
          pending={downloading}
          disabled={authorizationPending}
          onClick={() => {
            void download();
          }}
        >
          {downloading ? 'Descargando…' : 'Descargar original'}
        </Button>
      </div>
      <Feedback message={message} error={failed} />
      <div className="document-status">
        <Badge>{statusLabels[data.status]}</Badge>
        <span className="metadata">
          Última actualización: {timestampLabel(data.updatedAt)}
        </span>
      </div>
      <section
        className="document-linked-operations"
        aria-label="Asociaciones del documento"
      >
        <p>
          <strong>Referencia extraída:</strong>{' '}
          {data.extractedReference ?? 'Sin referencia extraída'}
        </p>
        <strong>Operaciones vinculadas</strong>
        <OperationLinks document={data} organizationId={organizationId} />
      </section>
      {isProcessing(data.status) && (
        <Loading
          inline
          label={
            data.status === 'queued'
              ? 'Documento en cola de extracción…'
              : 'Extrayendo texto del PDF…'
          }
        />
      )}
      <p className="permission-note">
        La extracción organiza información del PDF. No confirma la validez de la
        factura ni aprueba pagos.
      </p>
      {(data.status === 'failed' || data.status === 'blocked') && (
        <div className="document-warning">
          <h3>No se pudo completar la extracción</h3>
          <p>
            {data.errorCode
              ? (errorLabels[data.errorCode] ??
                'No pudimos procesar este documento. ')
              : ''}
            Revisá el PDF original. Solo se admiten documentos con texto
            seleccionable.
          </p>
          {data.capabilities.canWrite && (
            <Button
              variant="outline"
              pending={retrying}
              disabled={authorizationPending || document.isFetching}
              onClick={() => {
                void retry();
              }}
            >
              {retrying ? 'Reintentando…' : 'Reintentar extracción'}
            </Button>
          )}
        </div>
      )}
      {document.isFetching &&
        !document.isPending &&
        !isProcessing(data.status) && (
          <Loading inline label="Actualizando documento…" />
        )}
      {extraction ? (
        <div className="document-review-grid">
          <section
            className="extraction-fields"
            aria-labelledby="extracted-heading"
          >
            <h3 id="extracted-heading">Datos y evidencia</h3>
            <p className="metadata">Versión de extracción {run.version}</p>
            {extraction.warnings.length > 0 && (
              <div className="document-warning">
                <strong>Revisión necesaria</strong>
                <ul>
                  {extraction.warnings.map((warning, index) => (
                    <li key={index}>
                      {warningLabels[warning] ??
                        'La extracción requiere una revisión adicional.'}
                    </li>
                  ))}
                </ul>
                {extraction.pages.every((page) => !page.text.trim()) && (
                  <p>
                    Este PDF no tiene texto utilizable. El OCR para documentos
                    escaneados todavía no está disponible.
                  </p>
                )}
              </div>
            )}
            {extraction.fields.map((field) => {
              const correction = data.corrections
                .filter(
                  (correction) =>
                    correction.extractionRunId === run.id &&
                    correction.field === field.name,
                )
                .at(-1);
              return (
                <article className="extracted-field" key={field.name}>
                  <div className="field-heading">
                    <h4>{fieldLabels[field.name]}</h4>
                    <Badge>{fieldStatusLabels[field.status]}</Badge>
                  </div>
                  <p className="extracted-value">
                    {field.value ?? 'No encontrado en el documento'}
                  </p>
                  {field.evidence ? (
                    <div className="source-evidence">
                      <strong>Página {field.evidence.page}</strong>
                      <blockquote>{field.evidence.snippet}</blockquote>
                    </div>
                  ) : (
                    <p className="metadata">
                      Sin evidencia de página disponible.
                    </p>
                  )}
                  {correction && (
                    <div className="field-correction">
                      <strong>Corrección registrada:</strong>{' '}
                      {correction.value ?? 'Sin dato verificable'}
                      <p className="metadata">
                        {correction.reason} ·{' '}
                        {timestampLabel(correction.createdAt)}
                      </p>
                    </div>
                  )}
                  {data.capabilities.canWrite && (
                    <CorrectionDialog
                      key={`${run.id}:${field.name}`}
                      userId={userId}
                      organizationId={organizationId}
                      documentId={documentId}
                      runId={run.id}
                      field={field}
                      label={fieldLabels[field.name]}
                      currentValue={correction ? correction.value : field.value}
                      disabled={!canCorrect}
                      onSaved={() => {
                        setFailed(false);
                        setMessage(
                          'Corrección guardada. Se conservaron el dato y el documento originales.',
                        );
                      }}
                    />
                  )}
                </article>
              );
            })}
          </section>
          <section className="source-pages" aria-labelledby="source-heading">
            <h3 id="source-heading">Texto del documento original</h3>
            <p className="metadata">
              Texto extraído, conservado por página. Para revisar el formato
              visual descargá el PDF original.
            </p>
            {extraction.pages.length === 0 ? (
              <p>No hay texto disponible. Revisá el PDF original.</p>
            ) : (
              extraction.pages.map((page) => (
                <details key={page.page} open={extraction.pages.length === 1}>
                  <summary>Página {page.page}</summary>
                  <pre className="page-text">
                    {page.text || 'Esta página no contiene texto extraíble.'}
                  </pre>
                </details>
              ))
            )}
          </section>
        </div>
      ) : (
        !isProcessing(data.status) && (
          <p>
            No hay datos extraídos disponibles. Consultá el original y el estado
            del procesamiento.
          </p>
        )
      )}
      {data.metadataHistory.length > 0 && (
        <details className="metadata-history">
          <summary>Historial de nombre y tipo (últimos 50 cambios)</summary>
          <DataTable
            label="Historial de metadatos del documento (últimos 50 cambios)"
            searchLabel="Buscar en los últimos 50 cambios"
            data={data.metadataHistory}
            getRowId={(item) => item.id}
            columns={[
              {
                id: 'before',
                label: 'Antes',
                accessor: (item) => item.before.filename,
                render: (item) => (
                  <>
                    {item.before.filename}
                    <small className="file-size">
                      {kindLabels[item.before.kind]}
                    </small>
                  </>
                ),
              },
              {
                id: 'after',
                label: 'Después',
                accessor: (item) => item.after.filename,
                render: (item) => (
                  <>
                    {item.after.filename}
                    <small className="file-size">
                      {kindLabels[item.after.kind]}
                    </small>
                  </>
                ),
              },
              {
                id: 'reason',
                label: 'Motivo',
                accessor: (item) => item.reason,
              },
              {
                id: 'date',
                label: 'Fecha',
                accessor: (item) => item.createdAt,
                render: (item) => (
                  <>
                    {timestampLabel(item.createdAt)}
                    <small className="file-size">
                      {item.actorId === userId
                        ? 'Vos'
                        : 'Integrante del equipo'}
                    </small>
                  </>
                ),
              },
            ]}
          />
        </details>
      )}
      {data.corrections.length > 0 && (
        <section className="correction-history">
          <h3>Historial de correcciones</h3>
          <DataTable
            label="Correcciones registradas"
            searchLabel="Buscar correcciones de este documento"
            data={data.corrections}
            getRowId={(item) => item.id}
            columns={[
              {
                id: 'field',
                label: 'Campo',
                accessor: (item) => fieldLabels[item.field],
              },
              {
                id: 'value',
                label: 'Valor corregido',
                accessor: (item) => item.value ?? 'Sin dato verificable',
              },
              {
                id: 'reason',
                label: 'Motivo',
                accessor: (item) => item.reason,
              },
              {
                id: 'date',
                label: 'Fecha',
                accessor: (item) => item.createdAt,
                render: (item) => timestampLabel(item.createdAt),
              },
            ]}
          />
        </section>
      )}
    </section>
  );
}

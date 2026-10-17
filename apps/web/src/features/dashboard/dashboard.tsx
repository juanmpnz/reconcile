import { dashboardQueries } from './hooks';
import { Accordion, AccordionTrigger } from '../../design-system/layout';
import { useQuery } from '@tanstack/react-query';
import { Loading } from '../../design-system/loading';
import { Button, RequestError } from '../../design-system/primitives';
import { navigate, organizationPath } from '../../app/router';

import { documentPath, statusLabels, timestampLabel } from '../documents/api';
import { operationPath } from '../operations/api';

export function DashboardView({
  userId,
  organizationId,
  disabled,
}: {
  userId: string;
  organizationId: string;
  disabled: boolean;
}) {
  const query = useQuery({
    ...dashboardQueries.detail(userId, organizationId),
    enabled: !disabled,
  });
  if (query.isPending)
    return <Loading label="Cargando resumen de la organización…" rows={3} />;
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
  const distribution = Object.entries(data.documents.byStatus);
  const maximum = Math.max(1, ...distribution.map(([, count]) => count));
  return (
    <div className="dashboard">
      <div className="dashboard-meta">
        <p>Una vista general de tu organización.</p>
        <Button
          variant="ghost"
          pending={query.isFetching}
          disabled={disabled}
          onClick={() => {
            void query.refetch();
          }}
        >
          Actualizar resumen
        </Button>
      </div>
      <div className="dashboard-kpis">
        {[
          {
            label: 'Operaciones',
            value: data.operations.total,
            detail: `${data.operations.withoutCompletedAnalysis} sin análisis completado`,
            tab: 'operations',
          },
          {
            label: 'Documentos',
            value: data.documents.total,
            detail: `${data.documents.byStatus.needs_review} requieren revisión · ${data.documents.byStatus.failed + data.documents.byStatus.blocked} con incidencias`,
            tab: 'documents',
          },
          {
            label: 'Diferencias detectadas',
            value: data.findings.confirmed + data.findings.probable,
            detail: `${data.findings.humanConfirmations} confirmaciones humanas registradas`,
            tab: 'operations',
          },
          {
            label: 'Reclamos abiertos',
            value: data.claims.open,
            detail: `${data.claims.total} reclamos en total`,
            tab: 'operations',
          },
        ].map((card) => (
          <a
            key={card.label}
            className="kpi-card"
            href={organizationPath(organizationId, card.tab)}
            onClick={(event) => {
              if (!event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                navigate(organizationPath(organizationId, card.tab));
              }
            }}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </a>
        ))}
      </div>
      <p className="permission-note">
        Resultados del último análisis completado por operación. Revisá su
        vigencia al abrir. Las diferencias son controles del motor, pueden
        solaparse y no representan importes recuperados.
      </p>
      <div className="dashboard-grid">
        <section className="workspace-card">
          <div className="section-heading">
            <h2>Estado de los documentos</h2>
            <span className="metadata">Distribución actual · documentos</span>
          </div>
          {data.documents.total === 0 ? (
            <p className="dashboard-empty">
              Todavía no hay documentos. Cargá el primer PDF desde Operativa.
            </p>
          ) : (
            <>
              <div
                className="dashboard-chart"
                role="img"
                aria-label={`Distribución actual de ${data.documents.total} documentos por estado; cifras completas debajo.`}
              >
                {distribution.map(([status, count]) => (
                  <div key={status} className="chart-row">
                    <span>
                      {statusLabels[status as keyof typeof statusLabels]}
                    </span>
                    <div>
                      <span style={{ width: `${(count / maximum) * 100}%` }} />
                    </div>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
              <Accordion>
                <AccordionTrigger>
                  Consultar cifras del gráfico
                </AccordionTrigger>
                <dl className="chart-values">
                  {distribution.map(([status, count]) => (
                    <div key={status}>
                      <dt>
                        {statusLabels[status as keyof typeof statusLabels]}
                      </dt>
                      <dd>{count}</dd>
                    </div>
                  ))}
                </dl>
              </Accordion>
            </>
          )}
        </section>
        <section className="workspace-card">
          <h2>Documentos para revisar</h2>
          <p className="metadata">
            Hasta 5 documentos pendientes de revisión o con error.
          </p>
          {data.pending.documents.length === 0 ? (
            <p className="dashboard-empty">
              No hay documentos pendientes en esta consulta.
            </p>
          ) : (
            <ul className="dashboard-pending">
              {data.pending.documents.map((document) => (
                <li key={document.id}>
                  <a href={documentPath(organizationId, document.id)}>
                    {document.filename}
                  </a>
                  <span>{statusLabels[document.status]}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="workspace-card">
          <h2>Último análisis pendiente</h2>
          <p className="metadata">
            Hasta 5 operaciones cuyo último análisis no está completado.
          </p>
          {!data.pending.operations.length ? (
            <p className="dashboard-empty">
              No hay operaciones pendientes en esta consulta.
            </p>
          ) : (
            <ul className="dashboard-pending">
              {data.pending.operations.map((operation) => (
                <li key={operation.id}>
                  <a href={operationPath(organizationId, operation.id)}>
                    {operation.reference}
                  </a>
                  <span>
                    {
                      {
                        not_analyzed: 'Sin análisis',
                        queued: 'En espera',
                        processing: 'Analizando',
                        failed: 'Error',
                        blocked: 'Bloqueado',
                      }[operation.status]
                    }
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="workspace-card">
          <h2>Seguimiento de reclamos</h2>
          <p className="metadata">
            Hasta 5 reclamos abiertos. Accedé a su operación para revisar el
            seguimiento.
          </p>
          {!data.pending.claims.length ? (
            <p className="dashboard-empty">
              No hay reclamos abiertos en esta consulta.
            </p>
          ) : (
            <ul className="dashboard-pending">
              {data.pending.claims.map((claim) => (
                <li key={claim.id}>
                  <a
                    href={`${operationPath(organizationId, claim.operationId)}#operation-claims`}
                  >
                    {claim.provider}
                  </a>
                  <span>
                    {claim.dueDate
                      ? `Seguimiento: ${claim.dueDate}`
                      : 'Sin próxima fecha'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="metadata">
        Datos globales de la organización · Actualizado{' '}
        {timestampLabel(data.generatedAt)} (hora local)
      </p>
    </div>
  );
}

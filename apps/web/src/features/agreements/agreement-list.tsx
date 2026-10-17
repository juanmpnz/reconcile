import { agreementQueries } from './hooks';
import {
  Accordion,
  AccordionTrigger,
  PageHeader,
} from '../../design-system/layout';
import { DataTable } from '../../design-system/data-table';
import { navigate, useRoute } from '../../app/router';
import { useQuery } from '@tanstack/react-query';
import { RequestError } from '../../design-system/primitives';
import { Loading } from '../../design-system/loading';
import { documentPath } from '../documents/api';

import { CreateAgreementDialog } from './create-dialog';
import { pricingLabel } from './presentation';
export function AgreementList({
  userId,
  organizationId,
  canWrite,
  disabled,
}: {
  userId: string;
  organizationId: string;
  canWrite: boolean;
  disabled: boolean;
}) {
  const route = useRoute();
  const page = Math.max(0, Number(route.searchParams.get('page')) || 0);
  const q = (route.searchParams.get('q') ?? '').slice(0, 200);
  const requestedSort = route.searchParams.get('sort');
  const sort =
    requestedSort === 'provider' ||
    requestedSort === 'title' ||
    requestedSort === 'service' ||
    requestedSort === 'validFrom' ||
    requestedSort === 'validUntil'
      ? requestedSort
      : 'createdAt';
  const direction =
    route.searchParams.get('direction') === 'asc' ? 'asc' : 'desc';
  const requestedLimit = Number(route.searchParams.get('limit'));
  const limit =
    requestedLimit === 50 || requestedLimit === 100 ? requestedLimit : 25;
  function change(values: {
    q?: string;
    sort?: string;
    direction?: string;
    limit?: number;
    page?: number;
  }) {
    const params = new URLSearchParams({
      tab: 'agreements',
      q: values.q ?? q,
      sort: values.sort ?? sort,
      direction: values.direction ?? direction,
      limit: String(values.limit ?? limit),
      page: String(values.page ?? 0),
    });
    navigate(`/organizations/${encodeURIComponent(organizationId)}?${params}`);
  }

  const query = useQuery({
    ...agreementQueries.list(userId, organizationId, page, {
      q,
      sort,
      direction,
      limit,
    }),
    enabled: !disabled,
  });
  return (
    <section aria-labelledby="agreements-title">
      <PageHeader className="page-header">
        <div>
          <h2 id="agreements-title">Tarifas y acuerdos</h2>
          <p>
            Cargá una vez el contrato y elegí su versión en cada factura. Las
            tarifas spot pertenecen a su operación.
          </p>
        </div>
        {canWrite && (
          <CreateAgreementDialog
            userId={userId}
            organizationId={organizationId}
            disabled={disabled}
          />
        )}
      </PageHeader>
      {!canWrite && (
        <p className="permission-note">
          Tu rol permite consultar acuerdos y originales; no permite publicar
          condiciones.
        </p>
      )}
      {query.isPending ? (
        <Loading label="Cargando acuerdos…" />
      ) : query.isError ? (
        <RequestError
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      ) : (
        <DataTable
          label="Tarifas y acuerdos revisados"
          data={query.data.items}
          getRowId={(item) => item.id}
          mode="server"
          search={q}
          onSearchChange={(q) => change({ q })}
          searchLabel="Buscar tarifas y acuerdos"
          sorting={[{ id: sort, desc: direction === 'desc' }]}
          onSortingChange={(next) =>
            change({
              sort: next[0]?.id ?? 'createdAt',
              direction: next[0]?.desc ? 'desc' : 'asc',
            })
          }
          pagination={{ pageIndex: page, pageSize: limit }}
          rowCount={query.data.total}
          onPaginationChange={(next) =>
            change({ page: next.pageIndex, limit: next.pageSize })
          }
          disabled={disabled}
          busy={query.isFetching}
          emptyMessage="No hay acuerdos para esta búsqueda."
          columns={[
            {
              id: 'title',
              label: 'Acuerdo y versión',
              sortable: true,
              render: (item) => (
                <>
                  {item.name}
                  {item.terms.agreementBasis !== 'accepted' && (
                    <p className="document-warning">
                      Condiciones sin aceptación confirmada
                    </p>
                  )}
                  <small className="file-size">Versión {item.id}</small>
                </>
              ),
            },
            {
              id: 'provider',
              label: 'Proveedor / ámbito',
              sortable: true,
              render: (item) => (
                <>
                  {item.terms.provider}
                  <small className="file-size">
                    {item.terms.route} ·{' '}
                    {item.terms.service === 'pickup'
                      ? 'Recogida / transporte terrestre'
                      : 'Servicio base marítimo'}
                  </small>
                </>
              ),
            },
            {
              id: 'validFrom',
              label: 'Uso / vigencia',
              sortable: true,
              render: (item) => (
                <>
                  {item.scope === 'reusable'
                    ? 'Reutilizable'
                    : 'Spot de una operación'}
                  <small className="file-size">
                    {item.terms.validFrom} — {item.terms.validUntil}
                  </small>
                </>
              ),
            },
            {
              id: 'price',
              label: 'Precio revisado',
              sortable: false,
              render: (item) =>
                `${pricingLabel(item.terms.pricing)} ${item.terms.currency}`,
            },
            {
              id: 'evidence',
              label: 'Evidencia',
              sortable: false,
              render: (item) => (
                <>
                  <a href={documentPath(organizationId, item.sourceDocumentId)}>
                    Ver PDF original
                  </a>
                  <Accordion>
                    <AccordionTrigger>Condiciones revisadas</AccordionTrigger>
                    {item.terms.evidence.map((evidence, index) => (
                      <blockquote key={index}>
                        Página {evidence.page}: {evidence.snippet}
                      </blockquote>
                    ))}
                    <p>Revisión manual: {item.reason}</p>
                  </Accordion>
                </>
              ),
            },
          ]}
        />
      )}
    </section>
  );
}

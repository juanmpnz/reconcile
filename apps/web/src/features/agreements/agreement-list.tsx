import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Button,
  EmptyState,
  RequestError,
  TableRegion,
} from '../../components/ui/primitives';
import { Loading } from '../../components/ui/loading';
import { documentPath } from '../documents/api';
import { agreementsKey, listAgreements } from './api';
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
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: [...agreementsKey(userId, organizationId), 'list', page],
    queryFn: ({ signal }) => listAgreements(organizationId, page, signal),
    enabled: !disabled,
  });
  return (
    <section aria-labelledby="agreements-title">
      <div className="page-header">
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
      </div>
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
      ) : query.data.items.length === 0 ? (
        <EmptyState title="No hay acuerdos en esta página">
          <p>
            Publicá una tarifa revisada para reutilizar el mismo PDF en varias
            operaciones.
          </p>
        </EmptyState>
      ) : (
        <TableRegion label="Tarifas y acuerdos revisados">
          <table>
            <caption className="sr-only">
              Versiones inmutables, vigencias y condiciones
            </caption>
            <thead>
              <tr>
                <th scope="col">Acuerdo y versión</th>
                <th scope="col">Proveedor / ámbito</th>
                <th scope="col">Uso / vigencia</th>
                <th scope="col">Precio revisado</th>
                <th scope="col">Evidencia</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.name}
                    {item.terms.agreementBasis !== 'accepted' && (
                      <p className="document-warning">
                        Condiciones sin aceptación confirmada
                      </p>
                    )}
                    <small className="file-size">Versión {item.id}</small>
                  </td>
                  <td>
                    {item.terms.provider}
                    <small className="file-size">
                      {item.terms.route} ·{' '}
                      {item.terms.service === 'pickup'
                        ? 'Recogida / transporte terrestre'
                        : 'Servicio base marítimo'}
                    </small>
                  </td>
                  <td>
                    {item.scope === 'reusable'
                      ? 'Reutilizable'
                      : 'Spot de una operación'}
                    <small className="file-size">
                      {item.terms.validFrom} — {item.terms.validUntil}
                    </small>
                  </td>
                  <td>
                    {pricingLabel(item.terms.pricing)} {item.terms.currency}
                  </td>
                  <td>
                    <a
                      href={documentPath(organizationId, item.sourceDocumentId)}
                    >
                      Ver PDF original
                    </a>
                    <details>
                      <summary>Condiciones revisadas</summary>
                      {item.terms.evidence.map((evidence, index) => (
                        <blockquote key={index}>
                          Página {evidence.page}: {evidence.snippet}
                        </blockquote>
                      ))}
                      <p>Revisión manual: {item.reason}</p>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableRegion>
      )}
      <div className="pagination">
        <Button
          variant="outline"
          disabled={!page || query.isFetching}
          onClick={() => setPage(page - 1)}
        >
          Anterior
        </Button>
        <span className="metadata">
          Página {page + 1} · {query.data?.total ?? 0} versiones
        </span>
        <Button
          variant="outline"
          disabled={
            !query.data ||
            (page + 1) * 25 >= query.data.total ||
            query.isFetching
          }
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </section>
  );
}

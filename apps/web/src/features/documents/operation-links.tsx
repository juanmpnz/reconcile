import type { DocumentSummary } from '@reconcile/contracts';
import { navigate } from '../../app/router';
import { operationPath } from '../operations/api';
export function OperationLinks({
  document,
  organizationId,
}: {
  document: DocumentSummary;
  organizationId: string;
}) {
  return document.operationCount === 0 ? (
    <span className="metadata">Sin operación vinculada</span>
  ) : (
    <div className="document-operation-links">
      {document.operations.map((operation) => (
        <a
          key={operation.id}
          href={operationPath(organizationId, operation.id)}
          title={operation.name}
          onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              navigate(operationPath(organizationId, operation.id));
            }
          }}
        >
          {operation.reference}
        </a>
      ))}
      {document.operationCount > document.operations.length && (
        <small>
          Mostrando {document.operations.length} de {document.operationCount}{' '}
          vínculos.
        </small>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getContext, organizationKey } from '../features/organizations/queries';
import { Button } from './ui/primitives';
import { navigate, organizationPath } from '../app/router';
import { documentsKey, getDocument } from '../features/documents/api';
export function AppShell({
  children,
  name,
  email,
  onLogout,
  busy,
  organizationId,
  userId,
  documentsActive = false,
  documentId,
}: {
  children: ReactNode;
  name: string;
  email: string;
  onLogout: () => void;
  busy: boolean;
  organizationId?: string | undefined;
  userId: string;
  documentsActive?: boolean;
  documentId?: string | undefined;
}) {
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="/organizations"
          onClick={(event) => {
            event.preventDefault();
            navigate('/organizations');
          }}
        >
          Reconcile
        </a>
        <nav aria-label="Principal">
          <a
            className="sidebar-link"
            href="/organizations"
            aria-current="page"
            onClick={(event) => {
              event.preventDefault();
              navigate('/organizations');
            }}
          >
            <span aria-hidden="true" className="nav-icon">
              ▦
            </span>
            Organizaciones
          </a>
        </nav>
        <div className="identity">
          <span className="identity-name">{name}</span>
          <span className="metadata">{email}</span>
          <Button
            variant="outline"
            pending={busy}
            disabled={busy}
            onClick={onLogout}
          >
            {busy ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </Button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <nav aria-label="Ubicación">
            <a
              href="/organizations"
              onClick={(event) => {
                event.preventDefault();
                navigate('/organizations');
              }}
            >
              Organizaciones
            </a>
            {organizationId && (
              <OrganizationBreadcrumb
                userId={userId}
                organizationId={organizationId}
                documentsActive={documentsActive}
                documentId={documentId}
              />
            )}
          </nav>
        </header>
        <main tabIndex={-1} id="main" className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function OrganizationBreadcrumb({
  userId,
  organizationId,
  documentsActive,
  documentId,
}: {
  userId: string;
  organizationId: string;
  documentsActive: boolean;
  documentId: string | undefined;
}) {
  const context = useQuery({
    queryKey: [...organizationKey(userId, organizationId), 'context'],
    queryFn: ({ signal }) => getContext(organizationId, signal),
    enabled: false,
  });
  const document = useQuery({
    queryKey: [
      ...documentsKey(userId, organizationId),
      'detail',
      documentId ?? '',
    ],
    queryFn: ({ signal }) =>
      getDocument(organizationId, documentId ?? '', signal),
    enabled: false,
  });
  return (
    <>
      <span aria-hidden="true">/</span>
      <span>
        {context.isSuccess ? context.data.organization.name : 'Organización'}
      </span>
      {documentsActive && (
        <>
          <span aria-hidden="true">/</span>
          <a
            href={organizationPath(organizationId, 'documents')}
            onClick={(event) => {
              event.preventDefault();
              navigate(organizationPath(organizationId, 'documents'));
            }}
          >
            Documentos
          </a>
        </>
      )}
      {documentId &&
        context.isSuccess &&
        !context.isFetching &&
        document.isSuccess && (
          <>
            <span aria-hidden="true">/</span>
            <span className="breadcrumb-document">
              {document.data.filename}
            </span>
          </>
        )}
    </>
  );
}

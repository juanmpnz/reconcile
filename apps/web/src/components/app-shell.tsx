import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getContext, organizationKey } from '../features/organizations/queries';
import { Button } from './ui/primitives';
import { navigate } from '../app/router';
export function AppShell({
  children,
  name,
  email,
  onLogout,
  busy,
  organizationId,
  userId,
}: {
  children: ReactNode;
  name: string;
  email: string;
  onLogout: () => void;
  busy: boolean;
  organizationId?: string | undefined;
  userId: string;
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
          <Button variant="outline" disabled={busy} onClick={onLogout}>
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
}: {
  userId: string;
  organizationId: string;
}) {
  const context = useQuery({
    queryKey: [...organizationKey(userId, organizationId), 'context'],
    queryFn: ({ signal }) => getContext(organizationId, signal),
    enabled: false,
  });
  return (
    <>
      <span aria-hidden="true">/</span>
      <span>
        {context.isSuccess ? context.data.organization.name : 'Organización'}
      </span>
    </>
  );
}

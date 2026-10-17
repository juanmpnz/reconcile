import { Label } from '../design-system/controls';
import { Select } from '../design-system/select';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { organizationQueries } from '../features/organizations/hooks';
import { navigate, organizationPath } from '../app/router';
import { Button } from '../design-system/primitives';
export function AppShell({
  children,
  name,
  email,
  onLogout,
  busy,
  organizationId,
  userId,
  activeTab = 'overview',
  verified = true,
}: {
  children: ReactNode;
  name: string;
  email: string;
  onLogout: () => void;
  busy: boolean;
  organizationId?: string | undefined;
  userId: string;
  activeTab?: string;
  verified?: boolean;
  documentsActive?: boolean;
  documentId?: string | undefined;
  operationsActive?: boolean;
  operationId?: string | undefined;
}) {
  const [mobile, setMobile] = useState(false);
  const organizations = useQuery({
    ...organizationQueries.list(userId),
    enabled: verified,
  });
  const context = useQuery({
    ...organizationQueries.context(userId, organizationId ?? ''),
    enabled: false,
  });
  const current =
    context.isSuccess && !context.isFetching
      ? context.data.organization.name
      : 'Espacio de trabajo';
  const section = ['members', 'invitations'].includes(activeTab)
    ? 'team'
    : ['operations', 'documents', 'agreements'].includes(activeTab)
      ? 'operations'
      : 'overview';
  const links = [
    { id: 'overview', label: 'Resumen', tab: 'overview', icon: '◫' },
    { id: 'operations', label: 'Operativa', tab: 'operations', icon: '▤' },
    { id: 'team', label: 'Equipo', tab: 'members', icon: '♧' },
  ];
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <aside className={`sidebar ${mobile ? 'sidebar-open' : ''}`}>
        <a
          className="brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            navigate('/');
          }}
        >
          reconcile<span aria-hidden="true">.</span>
        </a>
        <Button
          className="mobile-menu-toggle"
          variant="ghost"
          aria-expanded={mobile}
          aria-controls="workspace-navigation"
          onClick={() => setMobile(!mobile)}
        >
          {mobile ? 'Cerrar menú' : 'Menú'}
        </Button>
        <div className="workspace-selector">
          <Label htmlFor="workspace-organization">Organización</Label>
          <Select
            id="workspace-organization"
            value={
              organizations.data?.some((org) => org.id === organizationId)
                ? (organizationId ?? '')
                : ''
            }
            disabled={!verified || organizations.isPending}
            onValueChange={(selectedValue) => {
              if (selectedValue) {
                setMobile(false);
                navigate(organizationPath(selectedValue, 'overview'));
              }
            }}
          >
            <option value="">Seleccioná una organización</option>
            {organizations.data?.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </Select>
          {organizations.isError && (
            <p className="metadata">
              No se pudo cargar el selector.{' '}
              <Button
                variant="unstyled"
                className="text-button"
                onClick={() => {
                  void organizations.refetch();
                }}
              >
                Reintentar
              </Button>
            </p>
          )}
        </div>
        <nav id="workspace-navigation" aria-label="Espacio de trabajo">
          {organizationId &&
            links.map((link) => (
              <a
                key={link.id}
                className="sidebar-link"
                aria-current={section === link.id ? 'page' : undefined}
                href={organizationPath(organizationId, link.tab)}
                onClick={(event) => {
                  if (!event.ctrlKey && !event.metaKey) {
                    event.preventDefault();
                    setMobile(false);
                    navigate(organizationPath(organizationId, link.tab));
                  }
                }}
              >
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
              </a>
            ))}
          <a
            className="workspace-manage"
            href="/organizations?manage=1"
            onClick={(event) => {
              event.preventDefault();
              setMobile(false);
              navigate('/organizations?manage=1');
            }}
          >
            Gestionar organizaciones
          </a>
        </nav>
        <div className="identity">
          <span className="identity-name">{name}</span>
          <span className="metadata">{email}</span>
          <Button
            variant="ghost"
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
          <span>{organizationId ? current : 'Organizaciones'}</span>
          <span className="topbar-section">
            {organizationId
              ? section === 'overview'
                ? 'Resumen'
                : section === 'operations'
                  ? 'Operativa'
                  : 'Equipo'
              : ''}
          </span>
        </header>
        <main tabIndex={-1} id="main" className="app-content">
          {children}
        </main>
      </div>
    </div>
  );
}

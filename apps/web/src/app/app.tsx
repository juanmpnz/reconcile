import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '../lib/auth';
import { navigate, useRoute } from './router';
import { Account } from '../features/auth/account';
import { Invitation } from '../features/auth/invitation';
import { OrganizationList } from '../features/organizations/organization-list';
import { OrganizationDetail } from '../features/organizations/organization-detail';
import { AppShell } from '../components/app-shell';
import { Loading } from '../components/ui/loading';
import { Button, Feedback } from '../components/ui/primitives';
const publicPaths = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
];
export function App() {
  const route = useRoute();
  const previousPath = useRef(route.pathname);
  useEffect(() => {
    if (previousPath.current === route.pathname) return;
    previousPath.current = route.pathname;
    const frame = window.requestAnimationFrame(() =>
      document.getElementById('main')?.focus(),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [route.pathname]);
  const session = authClient.useSession();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const invitationId =
    route.searchParams.get('invitationId') ?? route.searchParams.get('id');
  const orgMatch =
    /^\/organizations\/([^/]+)(?:\/(documents|operations)\/([^/]+))?$/.exec(
      route.pathname,
    );
  let organizationId = '';
  let documentId = '';
  let operationId = '';
  try {
    organizationId = orgMatch?.[1] ? decodeURIComponent(orgMatch[1]) : '';
    documentId =
      orgMatch?.[2] === 'documents' && orgMatch[3]
        ? decodeURIComponent(orgMatch[3])
        : '';
    operationId =
      orgMatch?.[2] === 'operations' && orgMatch[3]
        ? decodeURIComponent(orgMatch[3])
        : '';
  } catch {
    /* Invalid paths render not-found below. */
  }
  const pageValue = Number(route.searchParams.get('page') ?? 0);
  const page =
    Number.isSafeInteger(pageValue) && pageValue >= 0 && pageValue < 100000
      ? pageValue
      : 0;
  const tab =
    operationId || route.searchParams.get('tab') === 'operations'
      ? 'operations'
      : documentId || route.searchParams.get('tab') === 'documents'
        ? 'documents'
        : route.searchParams.get('tab') === 'agreements'
          ? 'agreements'
          : route.searchParams.get('tab') === 'invitations'
            ? 'invitations'
            : 'members';
  async function logout() {
    if (busy) return;
    setBusy(true);
    setLogoutError('');
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error('Sign out failed');
      client.clear();
      navigate('/login');
    } catch {
      setLogoutError('No se pudo cerrar la sesión. Volvé a intentar.');
    } finally {
      setBusy(false);
    }
  }
  if (publicPaths.includes(route.pathname))
    return <Account key={route.pathname + route.search} />;
  if (session.isPending)
    return (
      <main tabIndex={-1} id="main" className="session-state">
        <Loading label="Cargando tu sesión…" />
      </main>
    );
  if (session.error)
    return (
      <main tabIndex={-1} id="main" className="session-state">
        <h1>No pudimos comprobar tu sesión</h1>
        <Button
          variant="outline"
          onClick={() => {
            void session.refetch();
          }}
        >
          Reintentar
        </Button>
      </main>
    );
  if (!session.data) return <Account key={route.pathname + route.search} />;
  const user = session.data.user;
  return (
    <AppShell
      userId={user.id}
      organizationId={organizationId || undefined}
      documentsActive={tab === 'documents'}
      operationsActive={tab === 'operations'}
      operationId={operationId || undefined}
      documentId={documentId || undefined}
      name={user.name}
      email={user.email}
      busy={busy}
      onLogout={() => {
        void logout();
      }}
    >
      <Feedback message={logoutError} error />
      {!user.emailVerified ? (
        <section>
          <h1>Verificá tu correo</h1>
          <p>
            Necesitás verificar tu dirección antes de acceder a las
            organizaciones.
          </p>
          <a
            href={
              invitationId
                ? `/verify-email?invitationId=${encodeURIComponent(invitationId)}`
                : '/verify-email'
            }
          >
            Solicitar enlace de verificación
          </a>
        </section>
      ) : route.pathname === '/accept-invitation' ? (
        <Invitation
          key={`${user.id}:${invitationId}`}
          id={invitationId}
          userId={user.id}
          email={user.email}
        />
      ) : organizationId ? (
        <OrganizationDetail
          key={`${user.id}:${organizationId}`}
          userId={user.id}
          organizationId={organizationId}
          tab={tab}
          page={page}
          documentId={documentId || undefined}
          operationId={operationId || undefined}
        />
      ) : route.pathname === '/' || route.pathname === '/organizations' ? (
        <OrganizationList key={user.id} userId={user.id} />
      ) : (
        <section>
          <h1>Página no encontrada</h1>
          <a href="/organizations">Volver a organizaciones</a>
        </section>
      )}
    </AppShell>
  );
}

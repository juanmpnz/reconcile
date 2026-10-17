import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router';
import { z } from 'zod';
import { authClient } from '../lib/auth';
import { AUTH_CHANGED_EVENT } from '../lib/auth-events';
import { httpFetch, SESSION_EXPIRED_EVENT } from '../lib/http';
import { Button, Loading, RequestError } from '../design-system';
import { internalDestination, navigate } from './router';

const assuranceSchema = z.object({
  required: z.boolean(),
  enrolled: z.boolean(),
  verified: z.boolean(),
});
export function useSessionAssurance(
  userId: string,
  sessionId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ['session-assurance', userId, sessionId],
    enabled,
    queryFn: async ({ signal }) => {
      const response = await httpFetch('/api/v1/session-assurance', { signal });
      if (!response.ok)
        throw new Error('No pudimos comprobar la protección de tu sesión.');
      return assuranceSchema.parse(await response.json());
    },
    retry: false,
  });
}
type Gate = { ready: boolean; expired: boolean };
const SessionGate = createContext<Gate>({ ready: false, expired: false });
export function SessionIdentityBoundary({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const client = useQueryClient();
  const [expired, setExpired] = useState(false);
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [readyGeneration, setReadyGeneration] = useState(-1);
  const identity = `${revision}:${expired}:${refreshing ? 'refreshing' : session.isPending ? 'pending' : session.error ? 'error' : (session.data?.user.id ?? 'anonymous')}`;
  const observed = useRef({ identity, generation: 0 });
  if (observed.current.identity !== identity)
    observed.current = {
      identity,
      generation: observed.current.generation + 1,
    };
  const generation = observed.current.generation;
  useEffect(() => {
    let active = true;
    void client.cancelQueries().then(() => {
      if (!active || observed.current.generation !== generation) return;
      client.clear();
      setReadyGeneration(generation);
    });
    return () => {
      active = false;
    };
  }, [client, generation]);
  useEffect(() => {
    function expire() {
      setExpired(true);
      setRevision((value) => value + 1);
      navigate('/login?notice=session-expired', true);
      void session.refetch();
    }
    function refresh() {
      setExpired(false);
      setRevision((value) => value + 1);
      setRefreshing(true);
      void Promise.resolve(session.refetch()).finally(() =>
        setRefreshing(false),
      );
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
    };
  }, [session.refetch]);
  return (
    <SessionGate.Provider
      value={{ ready: readyGeneration === generation && !refreshing, expired }}
    >
      {children}
    </SessionGate.Provider>
  );
}
export function AuthenticatedRoute() {
  const session = authClient.useSession();
  const gate = useContext(SessionGate);
  const location = useLocation();
  if (gate.expired)
    return <Navigate to="/login?notice=session-expired" replace />;
  if (session.error)
    return (
      <main className="session-state">
        <h1>No pudimos comprobar tu sesión</h1>
        <Button
          onClick={() => {
            void session.refetch();
          }}
        >
          Reintentar
        </Button>
      </main>
    );
  if (session.isPending || !gate.ready)
    return (
      <main className="session-state">
        <Loading label="Comprobando tu sesión…" />
      </main>
    );
  if (!session.data)
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(internalDestination(location.pathname + location.search))}`}
        replace
      />
    );
  if (!session.data.user.emailVerified || location.pathname === '/security')
    return <Outlet />;
  return (
    <AssuredRoute
      userId={session.data.user.id}
      sessionId={session.data.session.id}
    />
  );
}
function AssuredRoute({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}) {
  const assurance = useSessionAssurance(userId, sessionId);
  const location = useLocation();
  if (assurance.isPending)
    return (
      <main className="session-state">
        <Loading label="Comprobando la protección de tu cuenta…" />
      </main>
    );
  if (assurance.isError)
    return (
      <main className="session-state">
        <RequestError
          error={assurance.error}
          retry={() => {
            void assurance.refetch();
          }}
        />
      </main>
    );
  if (
    (assurance.data.required && !assurance.data.enrolled) ||
    ((assurance.data.required || assurance.data.enrolled) &&
      !assurance.data.verified)
  )
    return (
      <Navigate
        to={`/security?returnTo=${encodeURIComponent(internalDestination(location.pathname + location.search))}`}
        replace
      />
    );
  return <Outlet />;
}

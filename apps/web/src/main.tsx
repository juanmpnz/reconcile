import { StrictMode, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/react-query';
import { z } from 'zod';
import { authClient } from './lib/auth';
import './styles.css';

const client = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 0, refetchOnWindowFocus: true },
  },
});
const contextSchema = z.object({
  organization: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
  }),
  membership: z.object({ role: z.string() }),
  capabilities: z.record(z.string(), z.boolean()),
});
function go(path: string) {
  window.location.assign(path);
}
function callback(path: string) {
  return new URL(path, window.location.origin).href;
}
function value(form: HTMLFormElement, name: string) {
  const item = new FormData(form).get(name);
  return typeof item === 'string' ? item.trim() : '';
}
function password(form: HTMLFormElement) {
  const item = new FormData(form).get('password');
  return typeof item === 'string' ? item : '';
}
function Field({
  name,
  label,
  type = 'text',
  autoComplete,
  hint,
  minLength,
  pattern,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  hint?: string | undefined;
  minLength?: number | undefined;
  pattern?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        minLength={minLength}
        pattern={pattern}
        aria-describedby={hint ? `${name}-hint` : undefined}
      />
      {hint && <small id={`${name}-hint`}>{hint}</small>}
    </div>
  );
}
function Feedback({ message, error }: { message: string; error: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (message && error) ref.current?.focus();
  }, [message, error]);
  return message ? (
    <div
      ref={ref}
      tabIndex={-1}
      className={`feedback ${error ? 'error' : ''}`}
      role={error ? 'alert' : 'status'}
    >
      {message}
    </div>
  ) : null;
}
function Frame({
  children,
  signedIn = false,
  onLogout,
}: {
  children: ReactNode;
  signedIn?: boolean;
  onLogout?: () => void;
}) {
  return (
    <>
      <a className="skip" href="#main">
        Saltar al contenido
      </a>
      <header className="topbar">
        <a className="brand" href="/">
          reconcile<span>.</span>
        </a>
        <span className="brand-caption">BY KERSHELL</span>
        {signedIn && (
          <button className="ghost logout" onClick={onLogout}>
            Cerrar sesión
          </button>
        )}
      </header>
      {children}
      <footer>Reconcile · Control de costes con evidencia</footer>
    </>
  );
}
function Account() {
  const path = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const registering = path === '/register';
  const forgot = path === '/forgot-password';
  const reset = path === '/reset-password';
  const verify = path === '/verify-email';
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    params.has('error')
      ? 'El enlace no es válido o ha caducado. Solicitá uno nuevo.'
      : '',
  );
  const [failed, setFailed] = useState(params.has('error'));
  const invitation = params.get('invitationId') ?? params.get('id');
  const destination = invitation
    ? `/accept-invitation?id=${encodeURIComponent(invitation)}`
    : '/';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage('');
    try {
      const email = value(form, 'email');
      const result = registering
        ? await authClient.signUp.email({
            name: value(form, 'name'),
            email,
            password: password(form),
            callbackURL: callback(destination),
          })
        : forgot
          ? await authClient.requestPasswordReset({
              email,
              redirectTo: callback('/reset-password'),
            })
          : reset
            ? await authClient.resetPassword({
                newPassword: password(form),
                token: params.get('token') ?? '',
              })
            : verify
              ? await authClient.sendVerificationEmail({
                  email,
                  callbackURL: callback(destination),
                })
              : await authClient.signIn.email({
                  email,
                  password: password(form),
                  callbackURL: callback(destination),
                });
      if (result.error) {
        setFailed(true);
        setMessage(
          result.error.code === 'EMAIL_NOT_VERIFIED'
            ? 'Verificá tu correo antes de ingresar. Podés solicitar otro enlace abajo.'
            : (result.error.message ??
                'No se pudo completar la solicitud. Intentá nuevamente.'),
        );
        return;
      }
      setFailed(false);
      if (registering)
        go(
          `/verify-email${invitation ? `?invitationId=${encodeURIComponent(invitation)}` : ''}`,
        );
      else if (forgot || verify)
        setMessage(
          'Si la dirección corresponde a una cuenta, recibirás un enlace. Revisá también correo no deseado.',
        );
      else if (reset) {
        setMessage('Contraseña actualizada. Ya podés iniciar sesión.');
      } else go(destination);
    } catch {
      setFailed(true);
      setMessage('No pudimos conectar. Revisá tu conexión y volvé a intentar.');
    } finally {
      setBusy(false);
    }
  }
  const title = registering
    ? 'Creá tu cuenta'
    : forgot
      ? 'Recuperá tu acceso'
      : reset
        ? 'Elegí una contraseña nueva'
        : verify
          ? 'Verificá tu correo'
          : 'Bienvenido de nuevo';
  const suffix = invitation
    ? `?invitationId=${encodeURIComponent(invitation)}`
    : '';
  return (
    <Frame>
      <main id="main" className="account-layout">
        <section className="account-intro">
          <p className="eyebrow">UN ESPACIO PARA TRABAJAR CON CLARIDAD</p>
          <h1>
            Cada diferencia,
            <br />
            con su evidencia.
          </h1>
          <p>Organizá tu equipo y prepará tu espacio de revisión de costes.</p>
          <div className="phase-note">
            <span className="status-dot" /> Identidad y espacios de trabajo
            disponibles.
            <br />
            El análisis documental llegará en la siguiente fase.
          </div>
        </section>
        <section className="card account-card" aria-labelledby="account-title">
          <p className="eyebrow">TU CUENTA</p>
          <h2 id="account-title">{title}</h2>
          <p className="muted">
            {verify
              ? 'Abrí el enlace que enviamos para activar tu cuenta. Si lo necesitás, solicitá uno nuevo.'
              : registering
                ? 'Usá tu correo personal o corporativo. El acceso a una empresa se concede por invitación.'
                : forgot
                  ? 'Te enviaremos un enlace para cambiar tu contraseña.'
                  : reset
                    ? 'Usá una contraseña única de al menos 12 caracteres.'
                    : 'Ingresá para acceder a tus organizaciones.'}
          </p>
          <Feedback message={message} error={failed} />
          <form
            onSubmit={(event) => {
              void submit(event);
            }}
            aria-busy={busy}
          >
            {registering && (
              <Field name="name" label="Nombre" autoComplete="name" />
            )}
            {!reset && (
              <Field
                name="email"
                label="Correo electrónico"
                type="email"
                autoComplete="email"
              />
            )}
            {!forgot && !verify && (
              <Field
                name="password"
                label={reset ? 'Nueva contraseña' : 'Contraseña'}
                type="password"
                autoComplete={
                  registering || reset ? 'new-password' : 'current-password'
                }
                minLength={registering || reset ? 12 : undefined}
                hint={registering ? 'Mínimo 12 caracteres.' : undefined}
              />
            )}
            <button
              className="primary"
              disabled={busy || (reset && !params.get('token'))}
            >
              {busy
                ? 'Procesando…'
                : registering
                  ? 'Crear cuenta'
                  : forgot
                    ? 'Enviar enlace'
                    : reset
                      ? 'Actualizar contraseña'
                      : verify
                        ? 'Reenviar verificación'
                        : 'Iniciar sesión'}
            </button>
            {reset && !params.get('token') && (
              <p role="alert">
                Falta el enlace de recuperación. Solicitá uno nuevo.
              </p>
            )}
          </form>
          <nav className="account-links" aria-label="Opciones de acceso">
            {!registering && !forgot && !reset && !verify && (
              <>
                <a href="/forgot-password">Olvidé mi contraseña</a>
                <a href={`/verify-email${suffix}`}>Verificar mi correo</a>
              </>
            )}
            {registering || forgot || reset || verify ? (
              <a href={`/login${suffix}`}>Volver a iniciar sesión</a>
            ) : (
              <p>
                ¿Primera vez?{' '}
                <a href={`/register${suffix}`}>Crear una cuenta</a>
              </p>
            )}
          </nav>
          {import.meta.env.DEV && (
            <p className="dev-note">
              Desarrollo local:{' '}
              <a href="http://localhost:8025" target="_blank" rel="noreferrer">
                abrir bandeja de correo de prueba
              </a>
              .
            </p>
          )}
        </section>
      </main>
    </Frame>
  );
}
function Workspace() {
  const session = authClient.useSession();
  const [organizationId, setOrganizationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const organizations = useQuery({
    queryKey: ['identity', 'organizations', session.data?.user.id],
    enabled: Boolean(session.data?.user.emailVerified),
    queryFn: async () => {
      const result = await authClient.organization.list();
      if (result.error) throw new Error(result.error.message);
      return z
        .array(z.object({ id: z.string(), name: z.string(), slug: z.string() }))
        .parse(result.data);
    },
  });
  const context = useQuery({
    queryKey: [
      'organizations',
      organizationId,
      'context',
      session.data?.user.id,
    ],
    enabled: Boolean(organizationId && session.data?.user.emailVerified),
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/v1/organizations/${encodeURIComponent(organizationId)}/context`,
        { signal, credentials: 'include' },
      );
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? 'Tu sesión expiró. Volvé a iniciar sesión.'
            : response.status === 403 || response.status === 404
              ? 'No tenés acceso actual a esta organización. Elegí otra o consultá con su administrador.'
              : 'No pudimos comprobar el acceso por un problema del servicio. Volvé a intentar.',
        );
      return contextSchema.parse(await response.json());
    },
  });
  useEffect(() => {
    if (
      organizations.data &&
      !organizations.data.some((org) => org.id === organizationId)
    )
      setOrganizationId(organizations.data[0]?.id ?? '');
  }, [organizations.data, organizationId]);
  async function logout() {
    setBusy(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error('Sign out failed');
      client.clear();
      go('/login');
    } catch {
      setFailed(true);
      setMessage('No se pudo cerrar la sesión. Volvé a intentar.');
    } finally {
      setBusy(false);
    }
  }

  async function run(
    action: () => Promise<{ error: { message?: string | undefined } | null }>,
    success: string,
  ) {
    setBusy(true);
    setMessage('');
    try {
      const result = await action();
      if (result.error)
        throw new Error(
          result.error.message ?? 'No se pudo completar la acción.',
        );
      setFailed(false);
      setMessage(success);
      await organizations.refetch();
      await client.invalidateQueries({ queryKey: ['organizations'] });
    } catch (error) {
      setFailed(true);
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo completar la acción.',
      );
    } finally {
      setBusy(false);
    }
  }
  const invitationId =
    new URLSearchParams(window.location.search).get('id') ??
    new URLSearchParams(window.location.search).get('invitationId');
  if (session.isPending)
    return (
      <Frame>
        <main id="main" className="loading" role="status">
          Cargando tu sesión…
        </main>
      </Frame>
    );
  if (session.error)
    return (
      <Frame>
        <main id="main" className="workspace">
          <h1>No pudimos comprobar tu sesión</h1>
          <button
            onClick={() => {
              void session.refetch();
            }}
          >
            Reintentar
          </button>
        </main>
      </Frame>
    );
  if (!session.data) return <Account />;
  if (!session.data.user.emailVerified)
    return (
      <Frame
        signedIn
        onLogout={() => {
          void logout();
        }}
      >
        <main id="main" className="workspace">
          <h1>Verificá tu correo para continuar</h1>
          <p>Tu cuenta todavía no tiene acceso a las organizaciones.</p>
          <Feedback message={message} error={failed} />
          {busy && <p role="status">Cerrando sesión…</p>}
          <a
            href={
              invitationId
                ? `/verify-email?invitationId=${encodeURIComponent(invitationId)}`
                : '/verify-email'
            }
          >
            Solicitar enlace de verificación
          </a>
        </main>
      </Frame>
    );
  return (
    <Frame
      signedIn
      onLogout={() => {
        void logout();
      }}
    >
      <main id="main" className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">ESPACIOS DE TRABAJO</p>
            <h1>Tu organización</h1>
            <p className="muted">
              Hola, {session.data.user.name}. Elegí dónde querés trabajar.
            </p>
          </div>
          <span className="badge">Cuenta verificada</span>
        </div>
        <Feedback message={message} error={failed} />
        {window.location.pathname === '/accept-invitation' && (
          <section className="card">
            <h2>Invitación a una organización</h2>
            <p>
              La invitación debe estar vigente y dirigida al correo de tu
              cuenta: {session.data.user.email}.
            </p>
            <button
              className="primary"
              disabled={busy || !invitationId}
              onClick={() => {
                if (invitationId)
                  void run(
                    () =>
                      authClient.organization.acceptInvitation({
                        invitationId,
                      }),
                    'Invitación aceptada. Elegí la organización para continuar.',
                  );
              }}
            >
              Aceptar invitación
            </button>
            {!invitationId && (
              <p role="alert">El enlace no contiene una invitación válida.</p>
            )}
          </section>
        )}
        <div className="workspace-grid">
          <section className="card">
            <h2>Seleccioná un espacio</h2>
            {organizations.isPending ? (
              <p role="status">Cargando organizaciones…</p>
            ) : organizations.isError ? (
              <>
                <p role="alert">No se pudieron cargar las organizaciones.</p>
                <button
                  onClick={() => {
                    void organizations.refetch();
                  }}
                >
                  Reintentar
                </button>
              </>
            ) : organizations.data?.length ? (
              <>
                <label htmlFor="organization">Organización</label>
                <select
                  id="organization"
                  value={organizationId}
                  disabled={busy}
                  onChange={(event) => {
                    const id = event.target.value;
                    setOrganizationId(id);
                    void run(
                      () =>
                        authClient.organization.setActive({
                          organizationId: id,
                        }),
                      'Organización seleccionada.',
                    );
                  }}
                >
                  {organizations.data.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                {context.isPending ? (
                  <p role="status">Comprobando acceso…</p>
                ) : context.isError ? (
                  <div>
                    <p role="alert">{context.error.message}</p>
                    <button
                      disabled={context.isFetching}
                      onClick={() => {
                        void context.refetch();
                      }}
                    >
                      Volver a comprobar
                    </button>
                  </div>
                ) : (
                  context.data && (
                    <div className="context">
                      <span className="badge">
                        {context.data.membership.role}
                      </span>
                      <h3>{context.data.organization.name}</h3>
                      <p role="status">
                        {context.isFetching
                          ? 'Actualizando permisos de acceso…'
                          : 'Acceso comprobado por el servidor en la última consulta.'}
                      </p>
                      <p className="muted">
                        Todavía no hay funciones de facturas disponibles en esta
                        fase.
                      </p>
                    </div>
                  )
                )}
              </>
            ) : (
              <div className="empty">
                <h3>Tu primer espacio empieza acá</h3>
                <p>
                  Creá una organización para vos o tu equipo, o aceptá una
                  invitación por correo.
                </p>
              </div>
            )}
          </section>
          <section className="card">
            <h2>Crear una organización</h2>
            <p className="muted">
              También podés crear un espacio personal. Serás su propietario.
            </p>
            <form
              aria-busy={busy}
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const name = value(form, 'name');
                const slug = value(form, 'slug');
                void run(
                  () => authClient.organization.create({ name, slug }),
                  'Organización creada. Ya podés seleccionarla.',
                );
              }}
            >
              <Field name="name" label="Nombre del espacio" />
              <Field
                name="slug"
                label="Identificador"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                hint="Letras minúsculas, números y guiones. Ejemplo: mi-empresa."
              />
              <button disabled={busy} className="primary">
                {busy ? 'Procesando…' : 'Crear espacio'}
              </button>
            </form>
          </section>
          {context.data &&
            context.data.capabilities.canInviteMembers &&
            !context.isError && (
              <section className="card">
                <h2>Invitar a tu equipo</h2>
                <p className="muted">
                  El destinatario recibirá un enlace para incorporarse a{' '}
                  {context.data.organization.name}.
                </p>
                <form
                  aria-busy={busy}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const email = value(form, 'invite-email');
                    const role = value(form, 'role');
                    if (role !== 'analyst' && role !== 'viewer') return;
                    void run(
                      () =>
                        authClient.organization.inviteMember({
                          email,
                          role,
                          organizationId,
                        }),
                      'Invitación enviada.',
                    );
                  }}
                >
                  <Field
                    name="invite-email"
                    label="Correo del destinatario"
                    type="email"
                  />
                  <div className="field">
                    <label htmlFor="role">Permiso</label>
                    <select id="role" name="role">
                      <option value="analyst">Analista</option>
                      <option value="viewer">Lector</option>
                    </select>
                  </div>
                  <button
                    disabled={busy || context.isFetching}
                    className="primary"
                  >
                    {busy ? 'Enviando invitación…' : 'Enviar invitación'}
                  </button>
                </form>
              </section>
            )}
        </div>
      </main>
    </Frame>
  );
}
function App() {
  return [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
    '/verify-email',
  ].includes(window.location.pathname) ? (
    <Account />
  ) : (
    <Workspace />
  );
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

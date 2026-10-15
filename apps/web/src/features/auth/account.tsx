import { useState } from 'react';
import { useMounted } from '../../lib/use-mounted';
import type { FormEvent } from 'react';
import { authClient } from '../../lib/auth';
import { callback, navigate, useRoute } from '../../app/router';
import { value, password } from '../../lib/forms';
import { Button, Field, Feedback } from '../../components/ui/primitives';
export function Account() {
  const route = useRoute();
  const mounted = useMounted();
  const path = route.pathname;
  const params = new URLSearchParams(route.search);
  const registering = path === '/register';
  const forgot = path === '/forgot-password';
  const reset = path === '/reset-password';
  const verify = path === '/verify-email';
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    params.has('error')
      ? 'El enlace no es válido o ha caducado. Solicitá uno nuevo.'
      : params.get('notice') === 'verification-processed'
        ? 'El enlace fue procesado. Iniciá sesión para continuar.'
        : '',
  );
  const [failed, setFailed] = useState(params.has('error'));
  const invitation = params.get('invitationId') ?? params.get('id');
  const destination = invitation
    ? `/accept-invitation?id=${encodeURIComponent(invitation)}`
    : '/';
  const verificationDestination = `/login?notice=verification-processed${invitation ? `&invitationId=${encodeURIComponent(invitation)}` : ''}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
            callbackURL: callback(verificationDestination),
          })
        : forgot
          ? await authClient.requestPasswordReset({
              email,
              redirectTo: callback(
                `/reset-password${invitation ? `?invitationId=${encodeURIComponent(invitation)}` : ''}`,
              ),
            })
          : reset
            ? await authClient.resetPassword({
                newPassword: password(form),
                token: params.get('token') ?? '',
              })
            : verify
              ? await authClient.sendVerificationEmail({
                  email,
                  callbackURL: callback(verificationDestination),
                })
              : await authClient.signIn.email({
                  email,
                  password: password(form),
                });
      if (!mounted.current) return;
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
        navigate(
          `/verify-email${invitation ? `?invitationId=${encodeURIComponent(invitation)}` : ''}`,
        );
      else if (forgot || verify)
        setMessage(
          'Si la dirección corresponde a una cuenta, recibirás un enlace. Revisá también correo no deseado.',
        );
      else if (reset) {
        setMessage('Contraseña actualizada. Ya podés iniciar sesión.');
      } else navigate(destination);
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
    <div className="auth-page">
      <main tabIndex={-1} id="main" className="account-layout">
        <section className="card account-card" aria-labelledby="account-title">
          <a className="brand auth-brand" href="/">
            Reconcile
          </a>
          <h1 id="account-title">{title}</h1>
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
          {failed && reset && (
            <p>
              <a href={`/forgot-password${suffix}`}>
                Solicitar otro enlace de recuperación
              </a>
            </p>
          )}
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
            <Button
              pending={busy}
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
            </Button>
            {reset && !params.get('token') && (
              <p role="alert">
                Falta el enlace de recuperación.{' '}
                <a href={`/forgot-password${suffix}`}>
                  Solicitar un enlace nuevo
                </a>
              </p>
            )}
          </form>
          <nav className="account-links" aria-label="Opciones de acceso">
            {!registering && !forgot && !reset && !verify && (
              <>
                <a href={`/forgot-password${suffix}`}>Olvidé mi contraseña</a>
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
    </div>
  );
}

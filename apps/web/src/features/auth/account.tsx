import { Card } from '../../design-system/layout';
import { useState } from 'react';
import { useMounted } from '../../lib/use-mounted';
import type { FormEvent } from 'react';
import {
  AuthMutationError,
  useSignInMutation,
  useSignUpMutation,
  useRequestPasswordResetMutation,
  useResetPasswordMutation,
  useSendVerificationEmailMutation,
} from './hooks';
import {
  callback,
  internalDestination,
  navigate,
  useRoute,
} from '../../app/router';
import { value, password } from '../../lib/forms';
import { Button, Field, Feedback } from '../../design-system/primitives';
export function Account() {
  const route = useRoute();
  const mounted = useMounted();
  const path = route.pathname;
  const params = new URLSearchParams(route.search);
  const registering = path === '/register';
  const forgot = path === '/forgot-password';
  const reset = path === '/reset-password';
  const verify = path === '/verify-email';
  const signIn = useSignInMutation();
  const signUp = useSignUpMutation();
  const requestReset = useRequestPasswordResetMutation();
  const resetPassword = useResetPasswordMutation();
  const sendVerification = useSendVerificationEmailMutation();
  const busy = [
    signIn,
    signUp,
    requestReset,
    resetPassword,
    sendVerification,
  ].some((mutation) => mutation.isPending);
  const [message, setMessage] = useState(
    params.has('error')
      ? 'El enlace no es válido o ha caducado. Solicitá uno nuevo.'
      : params.get('notice') === 'verification-processed'
        ? 'El enlace fue procesado. Iniciá sesión para continuar.'
        : params.get('notice') === 'session-expired'
          ? 'Tu sesión terminó. Iniciá sesión nuevamente.'
          : '',
  );
  const [failed, setFailed] = useState(params.has('error'));
  const invitation = params.get('invitationId') ?? params.get('id');
  const destination = invitation
    ? `/accept-invitation?id=${encodeURIComponent(invitation)}`
    : internalDestination(params.get('returnTo'));
  const verificationDestination = `/login?notice=verification-processed${invitation ? `&invitationId=${encodeURIComponent(invitation)}` : ''}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setMessage('');
    try {
      const email = value(form, 'email');
      const result = registering
        ? await signUp.mutateAsync({
            name: value(form, 'name'),
            email,
            password: password(form),
            callbackURL: callback(verificationDestination),
          })
        : forgot
          ? await requestReset.mutateAsync({
              email,
              redirectTo: callback(
                `/reset-password${invitation ? `?invitationId=${encodeURIComponent(invitation)}` : ''}`,
              ),
            })
          : reset
            ? await resetPassword.mutateAsync({
                newPassword: password(form),
                token: params.get('token') ?? '',
              })
            : verify
              ? await sendVerification.mutateAsync({
                  email,
                  callbackURL: callback(verificationDestination),
                })
              : await signIn.mutateAsync({
                  email,
                  password: password(form),
                });
      if (!mounted.current) return;
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
      } else if (
        result &&
        typeof result === 'object' &&
        'twoFactorRedirect' in result &&
        result.twoFactorRedirect === true
      ) {
        navigate(`/two-factor?returnTo=${encodeURIComponent(destination)}`);
      } else navigate(destination);
    } catch (error) {
      if (!mounted.current) return;
      setFailed(true);
      setMessage(
        error instanceof AuthMutationError &&
          error.code === 'EMAIL_NOT_VERIFIED'
          ? 'Verificá tu correo antes de ingresar. Podés solicitar otro enlace abajo.'
          : 'No pudimos completar la solicitud. Revisá los datos y volvé a intentar.',
      );
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
        <Card className="card account-card" aria-labelledby="account-title">
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
        </Card>
      </main>
    </div>
  );
}

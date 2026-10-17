import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { authClient } from '../../lib/auth';
import { authenticationChanged } from '../../lib/auth-events';
import {
  Button,
  Card,
  Checkbox,
  Field,
  Feedback,
  FormField,
  Label,
  Loading,
  RequestError,
} from '../../design-system';
import { QrCode } from '../../design-system/qr-code';
import { internalDestination, navigate, useRoute } from '../../app/router';
import { useSessionAssurance } from '../../app/session-boundary';
import { useSignOutMutation, unwrapAuth } from './hooks';

const enrollmentSchema = z.object({
  totpURI: z.string().max(2000),
  backupCodes: z.array(z.string().max(200)).min(1).max(30),
});
function secretFrom(uri: string) {
  const url = new URL(uri);
  const secret = url.searchParams.get('secret') ?? '';
  if (
    url.protocol !== 'otpauth:' ||
    url.hostname !== 'totp' ||
    !/^[A-Z2-7]+=*$/i.test(secret)
  )
    throw new Error('Invalid enrollment response');
  return secret;
}
function useCodeVerification() {
  const mutation = useMutation({
    mutationFn: async ({ code, backup }: { code: string; backup: boolean }) => {
      const data = backup
        ? await authClient.twoFactor.verifyBackupCode({
            code,
            trustDevice: false,
          })
        : await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      unwrapAuth(data);
    },
    retry: false,
    gcTime: 0,
    onSettled: (): void => {
      mutation.reset();
    },
  });
  return mutation;
}
export function TwoFactorChallenge() {
  const route = useRoute();
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState('');
  const verification = useCodeVerification();
  async function verify(form: HTMLFormElement) {
    const code = String(new FormData(form).get('code') ?? '').trim();
    setError('');
    try {
      await verification.mutateAsync({ code, backup });
      form.reset();
      authenticationChanged();
      navigate(internalDestination(route.searchParams.get('returnTo')), true);
    } catch {
      setError(
        'No pudimos verificar el código. Revisá el código y volvé a intentar.',
      );
    }
  }
  return (
    <div className="auth-page">
      <main id="main" tabIndex={-1} className="account-layout">
        <Card className="card account-card">
          <h1>Verificá tu acceso</h1>
          <p>
            {backup
              ? 'Usá uno de tus códigos de recuperación. Cada código sirve una sola vez.'
              : 'Ingresá el código de tu aplicación autenticadora.'}
          </p>
          <Feedback message={error} error />
          <form
            aria-busy={verification.isPending}
            onSubmit={(event) => {
              event.preventDefault();
              if (!verification.isPending) void verify(event.currentTarget);
            }}
          >
            <Field
              key={backup ? 'backup' : 'totp'}
              name="code"
              label={
                backup ? 'Código de recuperación' : 'Código de verificación'
              }
              autoComplete="one-time-code"
              inputMode={backup ? 'text' : 'numeric'}
              pattern={backup ? undefined : '[0-9]{6}'}
              maxLength={backup ? 200 : 6}
            />
            <Button pending={verification.isPending}>Verificar acceso</Button>
          </form>
          <Button
            type="button"
            variant="ghost"
            disabled={verification.isPending}
            onClick={() => {
              setBackup(!backup);
              setError('');
            }}
          >
            {backup
              ? 'Usar aplicación autenticadora'
              : 'Usar código de recuperación'}
          </Button>
          <a href="/login">Volver a iniciar sesión</a>
        </Card>
      </main>
    </div>
  );
}
export function SecuritySetup() {
  const session = authClient.useSession();
  const assurance = useSessionAssurance(
    session.data?.user.id ?? '',
    session.data?.session.id ?? '',
    Boolean(session.data?.user.emailVerified),
  );
  const route = useRoute();
  const destination = internalDestination(route.searchParams.get('returnTo'));
  const signOut = useSignOutMutation();
  const [enrollment, setEnrollment] = useState<z.infer<
    typeof enrollmentSchema
  > | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const verification = useCodeVerification();
  // Enrollment seeds/backups stay in this component, never in Query/Mutation result cache.
  const enable = useMutation({
    mutationFn: async (password: string) => {
      const response = unwrapAuth(
        await authClient.twoFactor.enable({ password, method: 'totp' }),
      );
      const data = enrollmentSchema.parse(response);
      secretFrom(data.totpURI);
      setEnrollment(data);
    },
    retry: false,
    gcTime: 0,
    onSettled: (): void => {
      enable.reset();
    },
  });
  const busy = enable.isPending || verification.isPending || signOut.isPending;
  if (!session.data?.user.emailVerified)
    return (
      <main className="session-state">
        <p>Verificá tu correo para configurar la protección de tu cuenta.</p>
        <a href="/verify-email">Verificar correo</a>
      </main>
    );
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
  async function start(form: HTMLFormElement) {
    setError('');
    try {
      await enable.mutateAsync(
        String(new FormData(form).get('password') ?? ''),
      );
      form.reset();
    } catch {
      setError(
        'No pudimos configurar la protección. Revisá tu contraseña e intentá nuevamente.',
      );
    }
  }
  async function confirm(form: HTMLFormElement) {
    setError('');
    try {
      await verification.mutateAsync({
        code: String(new FormData(form).get('code') ?? '').trim(),
        backup: false,
      });
      form.reset();
      setCompleted(true);
      if (!enrollment) {
        authenticationChanged();
        navigate(destination, true);
      }
    } catch {
      setError(
        'No pudimos verificar el código. Revisá la hora de tu teléfono y volvé a intentar.',
      );
    }
  }
  return (
    <div className="auth-page">
      <main id="main" tabIndex={-1} className="account-layout">
        <Card className="card account-card">
          <h1>Protegé tu cuenta</h1>
          <p>
            {assurance.data.required
              ? 'Antes de acceder a las organizaciones, necesitás verificar un segundo factor.'
              : 'Podés añadir una aplicación autenticadora a tu cuenta.'}
          </p>
          <Feedback message={error} error />
          {assurance.data.enrolled && assurance.data.verified && !enrollment ? (
            <>
              <p>Tu sesión ya tiene la verificación adicional.</p>
              <Button onClick={() => navigate(destination)}>Continuar</Button>
            </>
          ) : !enrollment && !assurance.data.enrolled ? (
            <form
              aria-busy={busy}
              onSubmit={(event) => {
                event.preventDefault();
                if (!busy) void start(event.currentTarget);
              }}
            >
              <Field
                name="password"
                label="Contraseña actual"
                type="password"
                autoComplete="current-password"
              />
              <Button pending={enable.isPending} disabled={busy}>
                Configurar aplicación autenticadora
              </Button>
            </form>
          ) : (
            <>
              {enrollment && (
                <>
                  <p>
                    Escaneá este QR con tu aplicación autenticadora o ingresá la
                    clave manual.
                  </p>
                  <QrCode
                    value={enrollment.totpURI}
                    label="QR para configurar tu aplicación autenticadora"
                  />
                  <FormField>
                    <span>Clave manual</span>
                    <code className="mfa-secret">
                      {secretFrom(enrollment.totpURI)}
                    </code>
                  </FormField>
                  <h2>Códigos de recuperación</h2>
                  <p>
                    Guardalos en un lugar seguro antes de continuar. Cada código
                    sirve una sola vez y solo los mostramos durante esta
                    configuración.
                  </p>
                  <ul className="mfa-backup-codes">
                    {enrollment.backupCodes.map((code) => (
                      <li key={code}>
                        <code>{code}</code>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(enrollment.backupCodes.join('\n'))
                        .then(() => setCopied(true))
                        .catch(() =>
                          setError(
                            'No pudimos copiar. Guardá los códigos manualmente.',
                          ),
                        );
                    }}
                  >
                    {copied
                      ? 'Códigos copiados'
                      : 'Copiar códigos de recuperación'}
                  </Button>
                  <FormField>
                    <Label>
                      <Checkbox
                        checked={acknowledged}
                        onChange={(event) =>
                          setAcknowledged(event.target.checked)
                        }
                        aria-label="Guardé mis códigos de recuperación"
                      />{' '}
                      Guardé mis códigos de recuperación
                    </Label>
                  </FormField>
                </>
              )}
              {!enrollment && (
                <a
                  href={`/two-factor?returnTo=${encodeURIComponent(destination)}`}
                >
                  Usar un código de recuperación
                </a>
              )}
              {!completed && (
                <form
                  aria-busy={busy}
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!busy) void confirm(event.currentTarget);
                  }}
                >
                  <Field
                    name="code"
                    label="Código de verificación"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                  />
                  <Button
                    pending={verification.isPending}
                    disabled={busy || Boolean(enrollment && !acknowledged)}
                  >
                    Verificar y activar protección
                  </Button>
                </form>
              )}
              {completed && (
                <>
                  <p role="status">Protección activada.</p>
                  <Button
                    disabled={!acknowledged || busy}
                    onClick={() => {
                      setEnrollment(null);
                      authenticationChanged();
                      navigate(destination, true);
                    }}
                  >
                    Continuar a la aplicación
                  </Button>
                </>
              )}
            </>
          )}
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setEnrollment(null);
              void signOut
                .mutateAsync()
                .then(() => navigate('/login', true))
                .catch(() =>
                  setError('No pudimos cerrar la sesión. Intentá nuevamente.'),
                );
            }}
          >
            Cerrar sesión
          </Button>
        </Card>
      </main>
    </div>
  );
}

import { useState } from 'react';
import { useMounted } from '../../lib/use-mounted';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '../../lib/auth';
import { errorMessage } from '../../lib/forms';
import { navigate, organizationPath } from '../../app/router';
import { Button, Feedback } from '../../components/ui/primitives';
import { identityKey } from '../organizations/queries';
export function Invitation({
  id,
  userId,
  email,
}: {
  id: string | null;
  userId: string;
  email: string;
}) {
  const mounted = useMounted();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const queryClient = useQueryClient();
  return (
    <section className="invitation-page">
      <h1>Aceptar invitación</h1>
      <p>
        Tu cuenta: <strong>{email}</strong>
      </p>
      <p>La invitación debe estar vigente y dirigida a este correo.</p>
      <Feedback message={message} error={failed} />
      {!id ? (
        <p role="alert">
          El enlace no contiene una invitación válida. Pedí al administrador que
          envíe una nueva.
        </p>
      ) : (
        <Button
          disabled={busy}
          onClick={() => {
            if (busy) return;
            setBusy(true);
            setMessage('');
            void (async () => {
              try {
                const result = await authClient.organization.acceptInvitation({
                  invitationId: id,
                });
                if (!mounted.current) return;
                if (result.error) throw new Error(result.error.message);
                await queryClient.invalidateQueries({
                  queryKey: identityKey(userId),
                });
                if (!mounted.current) return;
                setFailed(false);
                setMessage('Invitación aceptada.');
                const orgId = result.data?.member.organizationId;
                if (orgId)
                  navigate(organizationPath(orgId), false, {
                    notice: 'invitation-accepted',
                  });
              } catch (error) {
                setFailed(true);
                setMessage(errorMessage(error));
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          {busy ? 'Aceptando…' : 'Aceptar invitación'}
        </Button>
      )}
      <p>
        <a href="/organizations">Volver a organizaciones</a>
      </p>
    </section>
  );
}

import { Select } from '../../components/ui/select';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '../../lib/auth';
import { errorMessage, value } from '../../lib/forms';
import { Dialog } from '../../components/ui/dialog';
import { Button, Feedback, Field } from '../../components/ui/primitives';
import { organizationKey } from './queries';
export function InviteDialog({
  userId,
  organizationId,
  organizationName,
  disabled,
  onSuccess,
}: {
  userId: string;
  organizationId: string;
  organizationName: string;
  disabled: boolean;
  onSuccess: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      title="Invitar miembro"
      description={`Enviaremos una invitación para unirse a ${organizationName}.`}
      trigger={<Button disabled={disabled}>Invitar miembro</Button>}
      open={open}
      busy={busy}
      onOpenChange={(next) => {
        setOpen(next);
        setError('');
      }}
    >
      <form
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || disabled) return;
          const email = value(event.currentTarget, 'invite-email');
          const role = value(event.currentTarget, 'invite-role');
          if (role !== 'analyst' && role !== 'viewer') return;
          setBusy(true);
          setError('');
          void (async () => {
            try {
              const result = await authClient.organization.inviteMember({
                organizationId,
                email,
                role,
              });
              if (result.error) throw new Error(result.error.message);
              await queryClient.invalidateQueries({
                queryKey: [
                  ...organizationKey(userId, organizationId),
                  'invitations',
                ],
              });
              setOpen(false);
              onSuccess('Invitación enviada.');
            } catch (error) {
              setError(errorMessage(error));
            } finally {
              setBusy(false);
            }
          })();
        }}
      >
        <Feedback message={error} error />
        <Field
          name="invite-email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
        />
        <div className="field">
          <label htmlFor="invite-role">Permiso</label>
          <Select id="invite-role" name="invite-role">
            <option value="analyst">Analista</option>
            <option value="viewer">Lector</option>
          </Select>
        </div>
        <div className="dialog-actions">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setOpen(false);
              setError('');
            }}
          >
            Cancelar
          </Button>
          <Button pending={busy} disabled={busy || disabled}>
            {busy ? 'Enviando…' : 'Enviar invitación'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

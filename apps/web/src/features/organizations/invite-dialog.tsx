import { Label } from '../../design-system/controls';
import { FormActions } from '../../design-system/layout';
import { FormField } from '../../design-system/controls';
import { Select } from '../../design-system/select';
import { useState } from 'react';

import { useInviteMemberMutation } from './hooks';
import { errorMessage, value } from '../../lib/forms';
import { Dialog } from '../../design-system/dialog';
import { Button, Feedback, Field } from '../../design-system/primitives';

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
  const inviteMember = useInviteMemberMutation(userId);
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
              await inviteMember.mutateAsync([organizationId, { email, role }]);
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
        <FormField className="field">
          <Label htmlFor="invite-role">Permiso</Label>
          <Select id="invite-role" name="invite-role">
            <option value="analyst">Analista</option>
            <option value="viewer">Lector</option>
          </Select>
        </FormField>
        <FormActions className="dialog-actions">
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
        </FormActions>
      </form>
    </Dialog>
  );
}

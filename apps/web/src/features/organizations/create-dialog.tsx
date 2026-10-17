import { FormActions } from '../../design-system/layout';
import { useState } from 'react';
import { useMounted } from '../../lib/use-mounted';

import { useCreateOrganizationMutation } from './hooks';
import { errorMessage, value } from '../../lib/forms';
import { navigate, organizationPath } from '../../app/router';
import { Dialog } from '../../design-system/dialog';
import { Button, Feedback, Field } from '../../design-system/primitives';

export function CreateOrganizationDialog({ userId }: { userId: string }) {
  const createOrganization = useCreateOrganizationMutation(userId);
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog
      title="Crear organización"
      description="Un espacio para tu equipo o para vos. Serás su propietario."
      trigger={<Button>Crear organización</Button>}
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
          if (busy) return;
          const form = event.currentTarget;
          const name = value(form, 'name');
          const slug = value(form, 'slug');
          setBusy(true);
          setError('');
          void (async () => {
            try {
              const organization = await createOrganization.mutateAsync({
                name,
                slug,
              });
              if (!mounted.current) return;
              setOpen(false);
              navigate(organizationPath(organization.id), false, {
                notice: 'organization-created',
              });
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
          name="name"
          label="Nombre"
          autoComplete="organization"
          maxLength={120}
        />
        <Field
          name="slug"
          label="Identificador"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={80}
          hint="Letras minúsculas, números y guiones. Ejemplo: mi-empresa."
        />
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
          <Button pending={busy} disabled={busy}>
            {busy ? 'Creando…' : 'Crear organización'}
          </Button>
        </FormActions>
      </form>
    </Dialog>
  );
}

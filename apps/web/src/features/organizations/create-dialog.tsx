import { useState } from 'react';
import { useMounted } from '../../lib/use-mounted';
import { useQueryClient } from '@tanstack/react-query';
import { authClient } from '../../lib/auth';
import { errorMessage, value } from '../../lib/forms';
import { navigate, organizationPath } from '../../app/router';
import { Dialog } from '../../components/ui/dialog';
import { Button, Feedback, Field } from '../../components/ui/primitives';
import { identityKey, organizationSchema } from './queries';
export function CreateOrganizationDialog({ userId }: { userId: string }) {
  const mounted = useMounted();
  const queryClient = useQueryClient();
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
              const result = await authClient.organization.create({
                name,
                slug,
              });
              if (!mounted.current) return;
              if (result.error) throw new Error(result.error.message);
              const organization = organizationSchema.parse(result.data);
              await queryClient.invalidateQueries({
                queryKey: identityKey(userId),
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
          <Button disabled={busy}>
            {busy ? 'Creando…' : 'Crear organización'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

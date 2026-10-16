import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loading } from '../components/ui/loading';
import { RequestError } from '../components/ui/primitives';
import { OrganizationList } from '../features/organizations/organization-list';
import {
  getContext,
  identityKey,
  listOrganizations,
} from '../features/organizations/queries';
import {
  forgetOrganization,
  rememberedOrganization,
} from './workspace-context';
import { navigate, organizationPath } from './router';
export function WorkspaceEntry({ userId }: { userId: string }) {
  const organizations = useQuery({
    queryKey: identityKey(userId),
    queryFn: listOrganizations,
  });
  const hint = rememberedOrganization(userId);
  const target =
    organizations.data?.find((org) => org.id === hint)?.id ??
    organizations.data?.[0]?.id;
  const access = useQuery({
    queryKey: ['workspace-entry', userId, target ?? ''],
    queryFn: ({ signal }) => getContext(target ?? '', signal),
    enabled: Boolean(target) && organizations.isSuccess,
  });
  useEffect(() => {
    if (access.isSuccess && !access.isFetching && target)
      navigate(organizationPath(target, 'overview'), true);
    else if (access.isError) forgetOrganization(userId, target);
  }, [access.isSuccess, access.isFetching, access.isError, target, userId]);
  if (organizations.isPending || (target && access.isPending))
    return <Loading label="Abriendo tu espacio de trabajo…" />;
  if (organizations.isError)
    return (
      <RequestError
        error={organizations.error}
        retry={() => {
          void organizations.refetch();
        }}
      />
    );
  if (access.isError)
    return (
      <>
        <RequestError
          error={access.error}
          retry={() => {
            void access.refetch();
          }}
        />
        <OrganizationList userId={userId} />
      </>
    );
  return target ? (
    <Loading label="Comprobando acceso al resumen…" />
  ) : (
    <OrganizationList userId={userId} />
  );
}

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '../../lib/auth';
import { useMounted } from '../../lib/use-mounted';
import { errorMessage } from '../../lib/forms';
import {
  navigate,
  navigationNotice,
  organizationPath,
  useRoute,
} from '../../app/router';
import {
  forgetOrganization,
  rememberOrganization,
} from '../../app/workspace-context';
import { Badge, Feedback, RequestError } from '../../components/ui/primitives';
import { Loading } from '../../components/ui/loading';
import { AgreementList } from '../agreements/agreement-list';
import { DocumentList } from '../documents/document-list';
import { DocumentDetailView } from '../documents/document-detail';
import { OperationList } from '../operations/operation-list';
import { OperationDetailView } from '../operations/operation-detail';
import { DashboardView } from '../dashboard/dashboard';
import {
  getContext,
  listInvitations,
  listMembers,
  organizationKey,
  roleLabel,
} from './queries';
import { InviteDialog } from './invite-dialog';
import { MembersTable } from './members-table';
import { InvitationsTable } from './invitations-table';
export function OrganizationDetail({
  userId,
  organizationId,
  tab,
  page,
  documentId,
  operationId,
}: {
  userId: string;
  organizationId: string;
  tab:
    | 'overview'
    | 'members'
    | 'invitations'
    | 'documents'
    | 'operations'
    | 'agreements';
  operationId?: string | undefined;
  documentId?: string | undefined;
  page: number;
}) {
  const route = useRoute();
  const requestedSize = Number(route.searchParams.get('limit') ?? 25);
  const memberPageSize = [25, 50, 100].includes(requestedSize)
    ? requestedSize
    : 25;
  const memberPath = (page: number, size = memberPageSize) =>
    `${organizationPath(organizationId, 'members', page)}&limit=${size}`;
  const queryClient = useQueryClient();
  const mounted = useMounted();
  const [message, setMessage] = useState(navigationNotice);
  const [failed, setFailed] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const key = organizationKey(userId, organizationId);
  const context = useQuery({
    queryKey: [...key, 'context'],
    queryFn: ({ signal }) => getContext(organizationId, signal),
  });
  const canRead = context.isSuccess && !context.isFetching;
  useEffect(() => {
    if (canRead) rememberOrganization(userId, organizationId);
    if (context.isError) {
      forgetOrganization(userId, organizationId);
      queryClient.removeQueries({
        queryKey: organizationKey(userId, organizationId),
        predicate: (query) => query.queryKey.at(-1) !== 'context',
      });
    }
  }, [canRead, context.isError, userId, organizationId, queryClient]);
  const members = useQuery({
    queryKey: [...key, 'members', page, memberPageSize],
    queryFn: () => listMembers(organizationId, page, memberPageSize),
    enabled: canRead && tab === 'members',
  });
  const invitations = useQuery({
    queryKey: [...key, 'invitations'],
    queryFn: () => listInvitations(organizationId),
    enabled: canRead && tab === 'invitations',
  });
  async function cancel(invitationId: string) {
    if (cancelling || !canRead || !context.data?.capabilities.canInviteMembers)
      return;
    setCancelling(invitationId);
    setMessage('');
    try {
      const result = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (result.error) throw new Error(result.error.message);
      if (!mounted.current) return;
      await queryClient.invalidateQueries({
        queryKey: [...key, 'invitations'],
      });
      if (mounted.current) {
        setFailed(false);
        setMessage('Invitación cancelada.');
      }
    } catch (error) {
      if (mounted.current) {
        setFailed(true);
        setMessage(errorMessage(error));
      }
    } finally {
      if (mounted.current) setCancelling(null);
    }
  }
  if (context.isPending)
    return <Loading label="Comprobando acceso a la organización…" />;
  if (context.isError)
    return (
      <>
        <h1>Organización no disponible</h1>
        <RequestError
          error={context.error}
          retry={() => {
            void context.refetch();
          }}
        />
        <a href="/organizations?manage=1">Volver a organizaciones</a>
      </>
    );
  const organization = context.data.organization;
  const team = tab === 'members' || tab === 'invitations';
  const operational =
    tab === 'operations' || tab === 'documents' || tab === 'agreements';
  const tabs = team
    ? [
        ['members', 'Miembros'],
        ['invitations', 'Invitaciones'],
      ]
    : operational
      ? [
          ['operations', 'Operaciones'],
          ['documents', 'Documentos'],
          ['agreements', 'Tarifas y acuerdos'],
        ]
      : [];
  return (
    <>
      <div className="page-header workspace-page-header">
        <div>
          <h1>{team ? 'Equipo' : operational ? 'Operativa' : 'Resumen'}</h1>
          <p className="organization-metadata">
            <span>{organization.name}</span>
            <Badge>{roleLabel(context.data.membership.role)}</Badge>
          </p>
        </div>
        {team && context.data.capabilities.canInviteMembers && (
          <InviteDialog
            userId={userId}
            organizationId={organizationId}
            organizationName={organization.name}
            disabled={!canRead}
            onSuccess={(message) => {
              setFailed(false);
              setMessage(message);
            }}
          />
        )}
      </div>
      <Feedback message={message} error={failed} />
      {tabs.length > 0 && (
        <nav
          className="tabs"
          aria-label={team ? 'Secciones del equipo' : 'Secciones de operativa'}
        >
          {tabs.map(([id, label]) => (
            <a
              key={id}
              href={organizationPath(organizationId, id)}
              aria-current={tab === id ? 'page' : undefined}
              onClick={(event) => {
                if (!event.ctrlKey && !event.metaKey) {
                  event.preventDefault();
                  navigate(organizationPath(organizationId, id));
                }
              }}
            >
              {label}
            </a>
          ))}
        </nav>
      )}
      {!canRead && (
        <Loading label="Comprobando permisos antes de mostrar los datos…" />
      )}
      <div hidden={!canRead}>
        {tab === 'overview' ? (
          <DashboardView
            userId={userId}
            organizationId={organizationId}
            disabled={!canRead}
          />
        ) : tab === 'agreements' ? (
          <AgreementList
            userId={userId}
            organizationId={organizationId}
            canWrite={context.data.capabilities.canWriteDocuments}
            disabled={!canRead}
          />
        ) : tab === 'operations' ? (
          operationId ? (
            <OperationDetailView
              key={operationId}
              userId={userId}
              organizationId={organizationId}
              operationId={operationId}
              authorizationPending={!canRead}
            />
          ) : (
            <OperationList
              key={`${organizationId}:${page}`}
              userId={userId}
              organizationId={organizationId}
              page={page}
              canWrite={context.data.capabilities.canWriteDocuments}
              disabled={!canRead}
            />
          )
        ) : tab === 'documents' ? (
          documentId ? (
            <DocumentDetailView
              key={documentId}
              userId={userId}
              organizationId={organizationId}
              documentId={documentId}
              authorizationPending={!canRead}
            />
          ) : (
            <DocumentList
              key={`${organizationId}:${page}`}
              userId={userId}
              organizationId={organizationId}
              page={page}
              canWrite={context.data.capabilities.canWriteDocuments}
              disabled={!canRead}
            />
          )
        ) : tab === 'members' ? (
          members.isPending ? (
            <Loading label="Cargando miembros…" rows={4} />
          ) : members.isError ? (
            <RequestError
              error={members.error}
              retry={() => {
                void members.refetch();
              }}
            />
          ) : (
            <MembersTable
              members={members.data.members}
              total={members.data.total}
              page={page}
              pageSize={memberPageSize}
              onPageSizeChange={(size) => navigate(memberPath(0, size))}
              onPageChange={(page) => navigate(memberPath(page))}
              busy={members.isFetching}
            />
          )
        ) : invitations.isPending ? (
          <Loading label="Cargando invitaciones…" rows={4} />
        ) : invitations.isError ? (
          <RequestError
            error={invitations.error}
            retry={() => {
              void invitations.refetch();
            }}
          />
        ) : (
          <InvitationsTable
            invitations={invitations.data}
            canInvite={context.data.capabilities.canInviteMembers}
            cancelling={cancelling}
            disabled={!canRead || Boolean(cancelling) || invitations.isFetching}
            onCancel={(id) => {
              void cancel(id);
            }}
          />
        )}
      </div>
    </>
  );
}

import { OperationList } from '../operations/operation-list';
import { OperationDetailView } from '../operations/operation-detail';
import { useState } from 'react';
import { DocumentList } from '../documents/document-list';
import { DocumentDetailView } from '../documents/document-detail';
import { Loading } from '../../components/ui/loading';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '../../lib/auth';
import { errorMessage } from '../../lib/forms';
import { navigate, navigationNotice, organizationPath } from '../../app/router';
import {
  Badge,
  Button,
  EmptyState,
  Feedback,
  RequestError,
  TableRegion,
} from '../../components/ui/primitives';
import {
  getContext,
  listInvitations,
  listMembers,
  organizationKey,
  roleLabel,
} from './queries';
import { InviteDialog } from './invite-dialog';
function dateLabel(date: Date) {
  return Number.isNaN(date.valueOf())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(date);
}
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
  tab: 'members' | 'invitations' | 'documents' | 'operations';
  operationId?: string | undefined;
  documentId?: string | undefined;
  page: number;
}) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState(navigationNotice);
  const [failed, setFailed] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const key = organizationKey(userId, organizationId);
  const context = useQuery({
    queryKey: [...key, 'context'],
    queryFn: ({ signal }) => getContext(organizationId, signal),
  });
  const canRead = context.isSuccess && !context.isFetching;
  const members = useQuery({
    queryKey: [...key, 'members', page],
    queryFn: () => listMembers(organizationId, page),
    enabled: canRead && tab === 'members',
  });
  const invitations = useQuery({
    queryKey: [...key, 'invitations'],
    queryFn: () => listInvitations(organizationId),
    enabled: canRead && tab === 'invitations',
  });
  async function cancel(invitationId: string) {
    if (
      cancelling ||
      context.isFetching ||
      !context.data?.capabilities.canInviteMembers
    )
      return;
    setCancelling(invitationId);
    setMessage('');
    try {
      const result = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (result.error) throw new Error(result.error.message);
      await queryClient.invalidateQueries({
        queryKey: [...key, 'invitations'],
      });
      setFailed(false);
      setMessage('Invitación cancelada.');
    } catch (error) {
      setFailed(true);
      setMessage(errorMessage(error));
    } finally {
      setCancelling(null);
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
        <p>
          <a
            href="/organizations"
            onClick={(event) => {
              event.preventDefault();
              navigate('/organizations');
            }}
          >
            Volver a organizaciones
          </a>
        </p>
        <a href="/login">Iniciar sesión con otra cuenta</a>
      </>
    );
  const organization = context.data.organization;
  return (
    <>
      <div className="page-header">
        <div>
          <h1>{organization.name}</h1>
          <p className="organization-metadata">
            <span>{organization.slug}</span>
            <Badge>{roleLabel(context.data.membership.role)}</Badge>
          </p>
        </div>
        {tab !== 'documents' &&
          tab !== 'operations' &&
          context.data.capabilities.canInviteMembers && (
            <InviteDialog
              userId={userId}
              organizationId={organizationId}
              organizationName={organization.name}
              disabled={context.isFetching}
              onSuccess={(message) => {
                setFailed(false);
                setMessage(message);
              }}
            />
          )}
      </div>
      <Feedback message={message} error={failed} />
      {context.isFetching && (
        <Loading inline label="Actualizando permisos de acceso…" />
      )}
      <nav className="tabs" aria-label="Secciones de la organización">
        <a
          href={organizationPath(organizationId, 'members')}
          aria-current={tab === 'members' ? 'page' : undefined}
          onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              navigate(organizationPath(organizationId, 'members'));
            }
          }}
        >
          Miembros
        </a>
        <a
          href={organizationPath(organizationId, 'invitations')}
          aria-current={tab === 'invitations' ? 'page' : undefined}
          onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              navigate(organizationPath(organizationId, 'invitations'));
            }
          }}
        >
          Invitaciones
        </a>{' '}
        <a
          href={organizationPath(organizationId, 'documents')}
          aria-current={tab === 'documents' ? 'page' : undefined}
          onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              navigate(organizationPath(organizationId, 'documents'));
            }
          }}
        >
          Documentos
        </a>
        <a
          href={organizationPath(organizationId, 'operations')}
          aria-current={tab === 'operations' ? 'page' : undefined}
          onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey) {
              event.preventDefault();
              navigate(organizationPath(organizationId, 'operations'));
            }
          }}
        >
          Operaciones
        </a>
      </nav>
      {tab === 'operations' ? (
        <>
          {!canRead && (
            <Loading label="Comprobando permisos antes de mostrar las operaciones…" />
          )}
          <div hidden={!canRead}>
            {operationId ? (
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
            )}
          </div>
        </>
      ) : tab === 'documents' ? (
        <>
          {!canRead && (
            <Loading label="Comprobando permisos antes de mostrar los documentos…" />
          )}
          <div hidden={!canRead}>
            {documentId ? (
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
            )}
          </div>
        </>
      ) : !canRead ? (
        <Loading label="Comprobando permisos antes de mostrar los datos…" />
      ) : tab === 'members' ? (
        <section aria-label="Miembros de la organización">
          {members.isPending ? (
            <Loading label="Cargando miembros…" rows={4} />
          ) : members.isError ? (
            <RequestError
              error={members.error}
              retry={() => {
                void members.refetch();
              }}
            />
          ) : members.data.members.length === 0 ? (
            <EmptyState
              title={
                page > 0
                  ? 'No hay miembros en esta página'
                  : 'No hay miembros disponibles'
              }
            >
              <p>
                {page > 0
                  ? 'Volvé a la página anterior para consultar los miembros.'
                  : 'No se encontraron miembros en esta consulta.'}
              </p>
              {page > 0 && (
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(
                      organizationPath(organizationId, 'members', page - 1),
                    )
                  }
                >
                  Página anterior
                </Button>
              )}
            </EmptyState>
          ) : (
            <>
              <TableRegion label="Miembros de la organización">
                <table>
                  <caption className="sr-only">
                    Miembros, correos y roles de {organization.name}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Nombre</th>
                      <th scope="col">Correo electrónico</th>
                      <th scope="col">Rol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.data.members.map((member) => (
                      <tr key={member.id}>
                        <td>{member.user.name}</td>
                        <td>{member.user.email}</td>
                        <td>
                          <Badge>{roleLabel(member.role)}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableRegion>
              <div className="pagination">
                <p className="metadata" role="status">
                  {page * 25 + 1}–{page * 25 + members.data.members.length} de{' '}
                  {members.data.total} miembros
                </p>
                <div>
                  <Button
                    variant="outline"
                    disabled={page === 0 || members.isFetching}
                    onClick={() =>
                      navigate(
                        organizationPath(organizationId, 'members', page - 1),
                      )
                    }
                  >
                    Anterior
                  </Button>
                  <span className="metadata">Página {page + 1}</span>
                  <Button
                    variant="outline"
                    disabled={
                      (page + 1) * 25 >= members.data.total ||
                      members.isFetching
                    }
                    onClick={() =>
                      navigate(
                        organizationPath(organizationId, 'members', page + 1),
                      )
                    }
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
          {members.isFetching && !members.isPending && (
            <Loading inline label="Actualizando miembros…" />
          )}
        </section>
      ) : (
        <section aria-label="Invitaciones de la organización">
          {!context.data.capabilities.canInviteMembers && (
            <p className="permission-note">
              Podés consultar las invitaciones. Solo los propietarios y
              administradores pueden enviarlas o cancelarlas.
            </p>
          )}
          {invitations.isPending ? (
            <Loading label="Cargando invitaciones…" rows={4} />
          ) : invitations.isError ? (
            <RequestError
              error={invitations.error}
              retry={() => {
                void invitations.refetch();
              }}
            />
          ) : invitations.data.length === 0 ? (
            <EmptyState title="No hay invitaciones">
              <p>
                {context.data.capabilities.canInviteMembers
                  ? 'Invitá a una persona para incorporarla a este equipo.'
                  : 'Las invitaciones del equipo aparecerán acá.'}
              </p>
            </EmptyState>
          ) : (
            <TableRegion label="Invitaciones de la organización">
              <table>
                <caption className="sr-only">
                  Invitaciones de {organization.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Correo electrónico</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Vencimiento</th>
                    {context.data.capabilities.canInviteMembers && (
                      <th scope="col">
                        <span className="sr-only">Acciones</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {invitations.data.map((invitation) => {
                    const expired =
                      invitation.expiresAt.valueOf() <= Date.now();
                    const status =
                      invitation.status === 'pending' && expired
                        ? 'Vencida'
                        : ({
                            pending: 'Pendiente',
                            accepted: 'Aceptada',
                            canceled: 'Cancelada',
                            cancelled: 'Cancelada',
                            rejected: 'Rechazada',
                          }[invitation.status] ?? invitation.status);
                    return (
                      <tr key={invitation.id}>
                        <td>{invitation.email}</td>
                        <td>
                          <Badge>{roleLabel(invitation.role)}</Badge>
                        </td>
                        <td>{status}</td>
                        <td>{dateLabel(invitation.expiresAt)}</td>
                        {context.data.capabilities.canInviteMembers && (
                          <td className="table-action">
                            {invitation.status === 'pending' && !expired ? (
                              <Button
                                pending={cancelling === invitation.id}
                                variant="outline"
                                disabled={
                                  Boolean(cancelling) ||
                                  context.isFetching ||
                                  invitations.isFetching
                                }
                                onClick={() => {
                                  void cancel(invitation.id);
                                }}
                                aria-label={`Cancelar invitación de ${invitation.email}`}
                              >
                                {cancelling === invitation.id
                                  ? 'Cancelando…'
                                  : 'Cancelar'}
                              </Button>
                            ) : (
                              <span className="metadata">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableRegion>
          )}
          {invitations.isFetching && !invitations.isPending && (
            <Loading inline label="Actualizando invitaciones…" />
          )}
        </section>
      )}
    </>
  );
}

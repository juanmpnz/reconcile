import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { authClient } from '../../lib/auth';
import { useOrganizationMutation } from '../../lib/query-mutation';
import * as api from './queries';

export const organizationQueries = {
  list: (userId: string) =>
    queryOptions({
      queryKey: api.identityKey(userId),
      queryFn: api.listOrganizations,
    }),
  context: (userId: string, organizationId: string) =>
    queryOptions({
      queryKey: [...api.organizationKey(userId, organizationId), 'context'],
      queryFn: ({ signal }) => api.getContext(organizationId, signal),
    }),
  members: (
    userId: string,
    organizationId: string,
    page: number,
    pageSize = 25,
  ) =>
    queryOptions({
      queryKey: [
        ...api.organizationKey(userId, organizationId),
        'members',
        page,
        pageSize,
      ],
      queryFn: () => api.listMembers(organizationId, page, pageSize),
    }),
  invitations: (userId: string, organizationId: string) =>
    queryOptions({
      queryKey: [...api.organizationKey(userId, organizationId), 'invitations'],
      queryFn: () => api.listInvitations(organizationId),
    }),
};

async function createOrganization(
  input: Parameters<typeof authClient.organization.create>[0],
) {
  const result = await authClient.organization.create(input);
  if (result.error) throw new Error(result.error.message);
  return api.organizationSchema.parse(result.data);
}
export function useCreateOrganizationMutation(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createOrganization,
    retry: false,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: api.identityKey(userId) });
    },
  });
}
async function inviteMember(
  organizationId: string,
  input: { email: string; role: 'analyst' | 'viewer' },
) {
  const result = await authClient.organization.inviteMember({
    organizationId,
    ...input,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export const useInviteMemberMutation = (userId: string) =>
  useOrganizationMutation(userId, inviteMember);
async function cancelInvitation(organizationId: string, invitationId: string) {
  // The organization is an invalidation scope; Better Auth checks invitation membership server-side.
  void organizationId;
  const result = await authClient.organization.cancelInvitation({
    invitationId,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export const useCancelInvitationMutation = (userId: string) =>
  useOrganizationMutation(userId, cancelInvitation);
async function acceptInvitation(invitationId: string) {
  const result = await authClient.organization.acceptInvitation({
    invitationId,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
export function useAcceptInvitationMutation(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: acceptInvitation,
    retry: false,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: api.identityKey(userId) });
    },
  });
}

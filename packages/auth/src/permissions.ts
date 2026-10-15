import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements } from 'better-auth/plugins/organization/access';
export const ac = createAccessControl(defaultStatements);
export const roles = {
  owner: ac.newRole({
    organization: ['update', 'delete'],
    member: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
  }),
  admin: ac.newRole({
    organization: ['update'],
    member: ['create', 'update', 'delete'],
    invitation: ['create', 'cancel'],
  }),
  analyst: ac.newRole({}),
  viewer: ac.newRole({}),
};
export type OrganizationRole = keyof typeof roles;
export function isOrganizationRole(value: string): value is OrganizationRole {
  return Object.hasOwn(roles, value);
}
export function capabilities(role: OrganizationRole) {
  return {
    canWriteDocuments:
      role === 'owner' || role === 'admin' || role === 'analyst',
    canInviteMembers: role === 'owner' || role === 'admin',
    canManageMembers: role === 'owner' || role === 'admin',
    canManageOrganization: role === 'owner' || role === 'admin',
  };
}

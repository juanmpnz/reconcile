import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';
import { roles } from '@reconcile/auth/permissions';
export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [organizationClient({ roles })],
});

import { queryOptions } from '@tanstack/react-query';
import { organizationKey } from '../organizations/queries';
import { getDashboard } from './api';
export const dashboardQueries = {
  detail: (userId: string, organizationId: string) =>
    queryOptions({
      queryKey: [...organizationKey(userId, organizationId), 'dashboard'],
      queryFn: ({ signal }) => getDashboard(organizationId, signal),
    }),
};

import { serverListParams } from '../../lib/list-query';
import { queryOptions } from '@tanstack/react-query';
import { useOrganizationMutation } from '../../lib/query-mutation';
import * as api from './api';
export const useCreateAgreementMutation = (userId: string) =>
  useOrganizationMutation(userId, api.createAgreement);
export const useSetOperationAgreementsMutation = (userId: string) =>
  useOrganizationMutation(userId, api.setOperationAgreements);

export const agreementQueries = {
  list: (
    userId: string,
    organizationId: string,
    page: number,
    options: Parameters<typeof api.listAgreements>[3] = {},
  ) =>
    queryOptions({
      queryKey: [
        ...api.agreementsKey(userId, organizationId),
        'list',
        serverListParams(page, options, [
          'createdAt',
          'provider',
          'title',
          'service',
          'validFrom',
          'validUntil',
        ]).toString(),
      ],
      queryFn: ({ signal }) =>
        api.listAgreements(organizationId, page, signal, options),
    }),
};

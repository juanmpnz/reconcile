import { queryOptions } from '@tanstack/react-query';
import {
  useOrganizationMutation,
  useDownloadMutation,
} from '../../lib/query-mutation';
import * as api from './api';
import { organizationKey } from '../organizations/queries';
export const useDecideFindingMutation = (userId: string) =>
  useOrganizationMutation(userId, api.decideFinding);
export const useCreateClaimMutation = (userId: string) =>
  useOrganizationMutation(userId, api.createClaim);
export const useSaveClaimMutation = (userId: string) =>
  useOrganizationMutation(userId, api.saveClaim);
export const useRecordEventMutation = (userId: string) =>
  useOrganizationMutation(userId, api.recordEvent);
export const useExportClaimMutation = (userId: string) =>
  useOrganizationMutation(userId, api.exportClaim);
export const useRebaseClaimMutation = (userId: string) =>
  useOrganizationMutation(userId, api.rebaseClaim);
export const useDownloadClaimExportMutation = () =>
  useDownloadMutation(api.downloadClaimExport);

export const claimQueries = {
  review: (userId: string, organizationId: string, operationId: string) =>
    queryOptions({
      queryKey: api.reviewKey(userId, organizationId, operationId),
      queryFn: ({ signal }) =>
        api.getReview(organizationId, operationId, signal),
    }),
  detail: (
    userId: string,
    organizationId: string,
    operationId: string,
    claimId: string,
  ) =>
    queryOptions({
      queryKey: [
        ...organizationKey(userId, organizationId),
        'claim',
        operationId,
        claimId,
      ],
      queryFn: ({ signal }) =>
        api.getClaim(organizationId, operationId, claimId, signal),
    }),
};

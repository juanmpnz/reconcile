import { serverListParams } from '../../lib/list-query';
import { queryOptions } from '@tanstack/react-query';
import { useOrganizationMutation } from '../../lib/query-mutation';
import * as api from './api';
export const useCreateOperationMutation = (userId: string) =>
  useOrganizationMutation(userId, api.createOperation);
export const useLinkDocumentsMutation = (userId: string) =>
  useOrganizationMutation(userId, api.linkDocuments);
export const useAttachDocumentMutation = (userId: string) =>
  useOrganizationMutation(userId, api.attachDocument);
export const useSaveFactsMutation = (userId: string) =>
  useOrganizationMutation(userId, api.saveFacts);
export const useRequestAnalysisMutation = (userId: string) =>
  useOrganizationMutation(userId, api.requestAnalysis);
export const useUpdateOperationMutation = (userId: string) =>
  useOrganizationMutation(userId, api.updateOperation);

export const operationQueries = {
  list: (
    userId: string,
    organizationId: string,
    page: number,
    options: Parameters<typeof api.listOperations>[3] = {},
  ) =>
    queryOptions({
      queryKey: [
        ...api.operationsKey(userId, organizationId),
        'list',
        serverListParams(page, options, [
          'createdAt',
          'reference',
          'name',
        ]).toString(),
      ],
      queryFn: ({ signal }) =>
        api.listOperations(organizationId, page, signal, options),
    }),
  detail: (userId: string, organizationId: string, operationId: string) =>
    queryOptions({
      queryKey: [
        ...api.operationsKey(userId, organizationId),
        'detail',
        operationId,
      ],
      queryFn: ({ signal }) =>
        api.getOperation(organizationId, operationId, signal),
    }),
  history: (
    userId: string,
    organizationId: string,
    operationId: string,
    page: number,
  ) =>
    queryOptions({
      queryKey: [
        ...api.operationsKey(userId, organizationId),
        'history',
        operationId,
        page,
      ],
      queryFn: ({ signal }) =>
        api.listAnalysisHistory(organizationId, operationId, page, signal),
    }),
  analysis: (
    userId: string,
    organizationId: string,
    operationId: string,
    runId: string,
    sourceFingerprint = '',
  ) =>
    queryOptions({
      queryKey: [
        ...api.operationsKey(userId, organizationId),
        'analysis',
        operationId,
        runId,
        sourceFingerprint,
      ],
      queryFn: ({ signal }) =>
        api.getAnalysis(organizationId, operationId, runId, signal),
    }),
};

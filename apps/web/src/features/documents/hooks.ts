import { serverListParams } from '../../lib/list-query';
import { queryOptions } from '@tanstack/react-query';
import {
  useOrganizationMutation,
  useDownloadMutation,
} from '../../lib/query-mutation';
import * as api from './api';
export const useUploadDocumentMutation = (userId: string) =>
  useOrganizationMutation(userId, api.uploadDocument);
export const useRetryDocumentMutation = (userId: string) =>
  useOrganizationMutation(userId, api.retryDocument);
export const useCorrectDocumentMutation = (userId: string) =>
  useOrganizationMutation(userId, api.correctDocument);
export const useUpdateDocumentMetadataMutation = (userId: string) =>
  useOrganizationMutation(userId, api.updateDocumentMetadata);
export const useDownloadDocumentMutation = () =>
  useDownloadMutation(api.downloadDocument);

export const documentQueries = {
  list: (
    userId: string,
    organizationId: string,
    page: number,
    options: Parameters<typeof api.listDocuments>[3] = {},
  ) =>
    queryOptions({
      queryKey: [
        ...api.documentsKey(userId, organizationId),
        'list',
        serverListParams(page, options, [
          'createdAt',
          'filename',
          'kind',
          'status',
          'reference',
          'operation',
        ]).toString(),
      ],
      queryFn: ({ signal }) =>
        api.listDocuments(organizationId, page, signal, options),
    }),
  detail: (userId: string, organizationId: string, documentId: string) =>
    queryOptions({
      queryKey: [
        ...api.documentsKey(userId, organizationId),
        'detail',
        documentId,
      ],
      queryFn: ({ signal }) =>
        api.getDocument(organizationId, documentId, signal),
    }),
};

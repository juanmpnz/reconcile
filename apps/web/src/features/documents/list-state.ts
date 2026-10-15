import { documentListQuerySchema } from '@reconcile/contracts';
import type { DocumentListOptions } from './api';
export function documentListState(
  params: URLSearchParams,
): DocumentListOptions {
  const result = documentListQuerySchema.safeParse({
    q: params.get('q') ?? '',
    sort: params.get('sort') ?? 'createdAt',
    direction: params.get('direction') ?? 'desc',
  });
  return result.success ? result.data : documentListQuerySchema.parse({});
}
export function documentListPath(
  organizationId: string,
  options: DocumentListOptions,
  page = 0,
) {
  const params = new URLSearchParams({
    tab: 'documents',
    sort: options.sort,
    direction: options.direction,
  });
  if (options.q) params.set('q', options.q);
  if (page > 0) params.set('page', String(page));
  return `/organizations/${encodeURIComponent(organizationId)}?${params}`;
}

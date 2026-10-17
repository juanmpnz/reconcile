import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { organizationKey } from '../features/organizations/queries';

/** Every invocation is one explicit action. Writes never retry automatically.
 * Invalidate the organization prefix: document edits also affect operation,
 * review, claim and dashboard freshness. Drafts remain component-owned.
 */
export function organizationMutationOptions<
  Args extends [string, ...unknown[]],
  Result,
>(
  userId: string,
  action: (...args: Args) => Promise<Result>,
  client: QueryClient,
) {
  return {
    mutationFn: (args: Args) => action(...args),
    retry: false as const,
    onSuccess: async (_result: Result, args: Args) => {
      await client.invalidateQueries({
        queryKey: organizationKey(userId, args[0]),
        // Domain writes do not change membership; revalidating this gate would
        // unmount the submitting form before its success flow can complete.
        predicate: (query) => query.queryKey.at(-1) !== 'context',
      });
    },
  };
}
export function useOrganizationMutation<
  Args extends [string, ...unknown[]],
  Result,
>(userId: string, action: (...args: Args) => Promise<Result>) {
  const client = useQueryClient();
  return useMutation(organizationMutationOptions(userId, action, client));
}

/** A user-triggered download is tracked without invalidating server data. */
export function useDownloadMutation<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
) {
  return useMutation({
    mutationFn: (args: Args) => action(...args),
    retry: false,
  });
}

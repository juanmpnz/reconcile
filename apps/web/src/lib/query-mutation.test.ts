import { describe, expect, it } from 'vitest';
import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { organizationMutationOptions } from './query-mutation';

describe('organization mutation boundaries', () => {
  it('invalidates dependent documents, operations, reviews and dashboard for the exact identity and tenant', async () => {
    const client = new QueryClient();
    const prefix = ['identity', 'user-a', 'organizations', 'org-a'];
    const affected = ['documents', 'operations', 'review', 'dashboard'].map(
      (resource) => [...prefix, resource],
    );
    const accessKey = [...prefix, 'context'];
    const foreign = [
      accessKey,
      ['identity', 'user-a', 'organizations', 'org-b', 'documents'],
      ['identity', 'user-b', 'organizations', 'org-a', 'documents'],
    ];
    for (const key of [...affected, ...foreign])
      client.setQueryData(key, { value: 'cached' });
    const action = async (org: string, version: number) => ({ org, version });
    const observer = new MutationObserver(
      client,
      organizationMutationOptions('user-a', action, client),
    );
    await expect(observer.mutate(['org-a', 4])).resolves.toEqual({
      org: 'org-a',
      version: 4,
    });
    for (const key of affected)
      expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    for (const key of foreign)
      expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    client.clear();
  });
  it('does not repeat an uncertain financial write or invalidate confirmed cached data after failure', async () => {
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: 3 } },
    });
    const key = ['identity', 'user', 'organizations', 'org', 'operations'];
    client.setQueryData(key, { value: 'confirmed' });
    let invocations = 0;
    const failure = new Error('Connection lost after submission');
    const action = async (org: string) => {
      expect(org).toBe('org');
      invocations++;
      throw failure;
    };
    const observer = new MutationObserver(
      client,
      organizationMutationOptions('user', action, client),
    );
    await expect(observer.mutate(['org'])).rejects.toBe(failure);
    expect(invocations).toBe(1);
    expect(client.getQueryState(key)?.isInvalidated).toBe(false);
    client.clear();
  });
});

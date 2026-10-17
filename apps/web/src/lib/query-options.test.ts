import { describe, expect, it } from 'vitest';
import { hashKey } from '@tanstack/react-query';
import { documentQueries } from '../features/documents/hooks';
import { operationQueries } from '../features/operations/hooks';
import { agreementQueries } from '../features/agreements/hooks';

describe('canonical private list query keys', () => {
  it('shares default server requests across consumers without crossing identities, organizations or filters', () => {
    for (const factory of [
      documentQueries.list,
      operationQueries.list,
      agreementQueries.list,
    ]) {
      const defaults = factory('user', 'org', 0).queryKey;
      const explicit = factory('user', 'org', 0, {
        q: ' ',
        sort: 'createdAt',
        direction: 'desc',
        limit: 25,
      }).queryKey;
      expect(hashKey(defaults)).toBe(hashKey(explicit));
      for (const isolated of [
        factory('other', 'org', 0).queryKey,
        factory('user', 'other', 0).queryKey,
        factory('user', 'org', 1).queryKey,
        factory('user', 'org', 0, { q: 'invoice' }).queryKey,
      ]) {
        expect(hashKey(isolated)).not.toBe(hashKey(defaults));
      }
    }
  });
  it('rechecks historical analysis freshness when current sources change', () => {
    const before = operationQueries.analysis(
      'user',
      'org',
      'operation',
      'run',
      'fingerprint-before',
    );
    const after = operationQueries.analysis(
      'user',
      'org',
      'operation',
      'run',
      'fingerprint-after',
    );
    expect(hashKey(before.queryKey)).not.toBe(hashKey(after.queryKey));
  });
});

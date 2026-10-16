import { describe, expect, it } from 'vitest';
import { serverListParams } from './list-query';
describe('server table list controls', () => {
  it('uses the requested page size for the global query offset and keeps server order/search', () => {
    const params = serverListParams(
      2,
      { q: '  OP / 99 ', sort: 'reference', direction: 'asc', limit: 50 },
      ['createdAt', 'reference', 'name'],
    );
    expect(Object.fromEntries(params)).toEqual({
      q: 'OP / 99',
      sort: 'reference',
      direction: 'asc',
      limit: '50',
      offset: '100',
    });
  });
  it('rejects private/unsupported sort fields and out-of-bounds pages before requesting the API', () => {
    expect(() =>
      serverListParams(0, { sort: 'storageKey' }, ['createdAt', 'reference']),
    ).toThrow();
    expect(() =>
      serverListParams(100001, { limit: 100 }, ['createdAt']),
    ).toThrow();
  });
});

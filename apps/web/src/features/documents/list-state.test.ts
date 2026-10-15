import { describe, expect, it } from 'vitest';
import { documentListPath, documentListState } from './list-state';
describe('global document list URL state', () => {
  it('preserves search and server ordering while paginating, and resets the page for a new search', () => {
    const options = {
      q: 'OP / 99',
      sort: 'operation' as const,
      direction: 'asc' as const,
    };
    const paged = new URL(
      documentListPath('org', options, 2),
      'http://localhost',
    );
    expect(documentListState(paged.searchParams)).toEqual(options);
    expect(paged.searchParams.get('page')).toBe('2');
    const changed = new URL(
      documentListPath('org', { ...options, q: 'OTHER' }),
      'http://localhost',
    );
    expect(changed.searchParams.has('page')).toBe(false);
    expect(changed.searchParams.get('q')).toBe('OTHER');
  });
  it('rejects unsupported sort/direction URL values without forwarding arbitrary server fields', () => {
    expect(
      documentListState(
        new URLSearchParams({
          sort: 'storageKey',
          direction: 'sideways',
          q: 'demo',
        }),
      ),
    ).toEqual({ q: '', sort: 'createdAt', direction: 'desc' });
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  callback,
  configureNavigation,
  internalDestination,
  navigate,
  organizationPath,
} from './router';
describe('internal navigation boundary', () => {
  it('preserves same-origin email callbacks, including login notices and invitations', () => {
    vi.stubGlobal('window', { location: { origin: 'https://reconcile.test' } });
    try {
      expect(
        callback('/login?notice=verification-processed&invitationId=demo'),
      ).toBe(
        'https://reconcile.test/login?notice=verification-processed&invitationId=demo',
      );
      expect(callback('//external.test')).toBe('https://reconcile.test/');
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('preserves deep links and rejects external and authentication-loop destinations', () => {
    expect(
      internalDestination('/organizations/a?tab=documents&page=2#file'),
    ).toBe('/organizations/a?tab=documents&page=2#file');
    for (const path of [
      null,
      'https://example.com',
      '//example.com',
      '/\\example.com',
      '/\nexample',
      '/login?returnTo=/login',
      '/two-factor',
      '/security',
    ])
      expect(internalDestination(path)).toBe('/');
  });
  it('delegates valid navigation to the router with replacement and notice state', () => {
    const delegate = vi.fn();
    configureNavigation(delegate);
    navigate('/organizations', true, { notice: 'organization-created' });
    expect(delegate).toHaveBeenCalledWith('/organizations', {
      replace: true,
      state: { notice: 'organization-created' },
    });
    expect(() => navigate('//example.com')).toThrow(
      'Invalid internal navigation',
    );
    expect(organizationPath('a/b', 'documents', 2)).toBe(
      '/organizations/a%2Fb?tab=documents&page=2',
    );
  });
});

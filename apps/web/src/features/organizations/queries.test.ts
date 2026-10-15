import { afterEach, describe, expect, it, vi } from 'vitest';
import { getContext, invitationsSchema } from './queries';
afterEach(() => vi.unstubAllGlobals());
describe('organization response boundaries', () => {
  it('rejects a context returned for another organization', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            organization: { id: 'other', name: 'Other', slug: 'other' },
            membership: { role: 'owner' },
            capabilities: {
              canInviteMembers: true,
              canManageMembers: true,
              canManageOrganization: true,
            },
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      getContext('requested', new AbortController().signal),
    ).rejects.toThrow('no corresponde');
  });
  it('distinguishes a service failure from authorization denial', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    vi.stubGlobal('fetch', fetch);
    await expect(
      getContext('org', new AbortController().signal),
    ).rejects.toThrow('servicio');
    await expect(
      getContext('org', new AbortController().signal),
    ).rejects.toThrow('no está disponible para tu cuenta');
  });
  it('rejects unusable expiry values rather than displaying an active invitation', () => {
    expect(
      invitationsSchema.safeParse([
        {
          id: 'invitation',
          organizationId: 'org',
          email: 'demo@example.test',
          role: 'viewer',
          status: 'pending',
          expiresAt: 'not-a-date',
          createdAt: '2026-10-15T12:00:00Z',
        },
      ]).success,
    ).toBe(false);
  });
});

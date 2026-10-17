import { describe, expect, it } from 'vitest';
import { useIdentityFixture, body, text } from './support/identity-fixture.js';
import { syntheticTotp } from './support/totp.js';

describe('required MFA: real enrollment, challenge and recovery HTTP', () => {
  const fixture = useIdentityFixture({
    addressPrefix: '198.51.102',
    requireMfa: true,
  });
  const { request, prisma, password, verifiedUser } = fixture;

  it('locks repeated second-factor failures across renewed challenges and client addresses', async () => {
    const user = await verifiedUser();
    const enabled = await request('/api/auth/two-factor/enable', user, {
      password,
      method: 'totp',
    });
    expect(enabled.statusCode, enabled.body).toBe(200);
    const uri = text(body(enabled).totpURI);
    expect(
      (
        await request('/api/auth/two-factor/verify-totp', user, {
          code: syntheticTotp(uri),
        })
      ).statusCode,
    ).toBe(200);
    await request('/api/auth/sign-out', user, {});
    for (let attempt = 0; attempt < 10; attempt++) {
      user.address = `198.51.103.${attempt + 10}`;
      if (attempt % 5 === 0)
        expect(body(await fixture.login(user)).twoFactorRedirect).toBe(true);
      const failed = await request('/api/auth/two-factor/verify-totp', user, {
        code: 'invalid-synthetic-code',
      });
      expect(failed.statusCode, failed.body).toBe(401);
    }
    user.address = '198.51.103.99';
    const locked = await request('/api/auth/two-factor/verify-totp', user, {
      code: syntheticTotp(uri),
    });
    expect(locked.statusCode, locked.body).toBe(429);
    expect(body(locked).code).toBe('ACCOUNT_TEMPORARILY_LOCKED');
    expect((await request('/api/v1/session-assurance', user)).statusCode).toBe(
      401,
    );
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { email: user.email },
    });
    await prisma.twoFactor.update({
      where: { userId: dbUser.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    // Account lock expiry does not replenish the exhausted five-attempt challenge.
    const exhausted = await request('/api/auth/two-factor/verify-totp', user, {
      code: syntheticTotp(uri),
    });
    expect(exhausted.statusCode, exhausted.body).toBe(400);
    expect(body(exhausted).code).toBe('TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE');
    expect((await request('/api/v1/session-assurance', user)).statusCode).toBe(
      401,
    );
    const renewed = await fixture.login(user);
    expect(renewed.statusCode, renewed.body).toBe(200);
    expect(body(renewed).twoFactorRedirect).toBe(true);
    const verified = await request('/api/auth/two-factor/verify-totp', user, {
      code: syntheticTotp(uri),
    });
    expect(verified.statusCode, verified.body).toBe(200);
    expect(
      body(await request('/api/v1/session-assurance', user)).verified,
    ).toBe(true);
  });

  it('requires proof for existing sessions, gates native organizations, and creates proof only after TOTP', async () => {
    const user = await verifiedUser();
    const oldDevice = {
      ...user,
      address: '198.51.102.200',
      cookies: new Map<string, string>(),
    };
    expect((await fixture.login(oldDevice)).statusCode).toBe(200);
    expect(body(await request('/api/v1/session-assurance', user))).toEqual({
      required: true,
      enrolled: false,
      verified: false,
    });
    const denied = await request('/api/auth/organization/list', user);
    expect(denied.statusCode, denied.body).toBe(403);
    expect(body(denied).code).toBe('MFA_REQUIRED');
    const enabled = await request('/api/auth/two-factor/enable', user, {
      password,
      method: 'totp',
    });
    expect(enabled.statusCode, enabled.body).toBe(200);
    const uri = text(body(enabled).totpURI);
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { email: user.email },
    });
    const secret = await prisma.twoFactor.findFirstOrThrow({
      where: { userId: dbUser.id },
    });
    expect(secret.secret).not.toContain(
      new URL(uri).searchParams.get('secret'),
    );
    const codes: unknown = body(enabled).backupCodes;
    if (!Array.isArray(codes))
      throw new Error('Expected synthetic backup codes');
    expect(secret.backupCodes).not.toContain(text(codes[0]));
    expect(
      body(await request('/api/v1/session-assurance', user)).verified,
    ).toBe(false);
    const invalid = await request('/api/auth/two-factor/verify-totp', user, {
      code: 'not-a-code',
    });
    expect(invalid.statusCode).toBeGreaterThanOrEqual(400);
    expect(
      body(await request('/api/v1/session-assurance', user)).verified,
    ).toBe(false);
    // Enrollment plus its first verification is three 2FA calls in this socket window.
    user.address = '198.51.102.201';
    const verified = await request('/api/auth/two-factor/verify-totp', user, {
      code: syntheticTotp(uri),
      trustDevice: false,
    });
    expect(verified.statusCode, verified.body).toBe(200);
    expect(body(await request('/api/v1/session-assurance', user))).toEqual({
      required: true,
      enrolled: true,
      verified: true,
    });
    expect(body(await request('/api/v1/session-assurance', oldDevice))).toEqual(
      { required: true, enrolled: true, verified: false },
    );
    expect(
      (await request('/api/auth/organization/list', oldDevice)).statusCode,
    ).toBe(403);
    for (const path of ['get-totp-uri', 'generate-backup-codes', 'enable']) {
      const management = await request(
        `/api/auth/two-factor/${path}`,
        oldDevice,
        { password },
      );
      expect(management.statusCode, management.body).toBe(403);
      expect(body(management).code).toBe('MFA_REQUIRED');
    }
    expect(
      (await request('/api/auth/list-sessions', oldDevice)).statusCode,
    ).toBe(403);
    const changePassword = await request(
      '/api/auth/change-password',
      oldDevice,
      { currentPassword: password, newPassword: password + '-new' },
    );
    expect(changePassword.statusCode).toBe(403);
    expect(body(changePassword).code).toBe('MFA_REQUIRED');
    const org = await fixture.organization(user);
    expect(
      (await request(`/api/v1/organizations/${org}/dashboard`, oldDevice))
        .statusCode,
    ).toBe(403);
    expect(
      (await request(`/api/v1/organizations/${org}/dashboard`, user))
        .statusCode,
    ).toBe(200);
    const disabled = await request('/api/auth/two-factor/disable', user, {
      password,
    });
    expect(disabled.statusCode).toBe(403);
    expect(body(disabled).code).toBe('MFA_REQUIRED');
    const dbSession = await prisma.session.findFirstOrThrow({
      where: { userId: dbUser.id, mfaVerifiedAt: { not: null } },
    });
    await prisma.session.delete({ where: { id: dbSession.id } });
    expect(
      (await request(`/api/v1/organizations/${org}/dashboard`, user))
        .statusCode,
    ).toBe(401);
  });

  it('does not issue a session at password login, consumes backup codes once and rejects trusted devices', async () => {
    const user = await verifiedUser();
    const enabled = await request('/api/auth/two-factor/enable', user, {
      password,
      method: 'totp',
    });
    expect(enabled.statusCode, enabled.body).toBe(200);
    const uri = text(body(enabled).totpURI);
    const rawCodes: unknown = body(enabled).backupCodes;
    if (!Array.isArray(rawCodes))
      throw new Error('Expected synthetic backup codes');
    const backup = text(rawCodes[0]);
    expect(
      (
        await request('/api/auth/two-factor/verify-totp', user, {
          code: syntheticTotp(uri),
        })
      ).statusCode,
    ).toBe(200);
    expect((await request('/api/auth/sign-out', user, {})).statusCode).toBe(
      200,
    );
    const challenge = await fixture.login(user);
    expect(challenge.statusCode, challenge.body).toBe(200);
    expect(body(challenge).twoFactorRedirect).toBe(true);
    expect(
      JSON.parse((await request('/api/auth/get-session', user)).body),
    ).toBeNull();
    expect((await request('/api/v1/session-assurance', user)).statusCode).toBe(
      401,
    );
    user.address = '198.51.102.202';
    const trusted = await request('/api/auth/two-factor/verify-totp', user, {
      code: syntheticTotp(uri),
      trustDevice: true,
    });
    expect(trusted.statusCode).toBe(400);
    const recovered = await request(
      '/api/auth/two-factor/verify-backup-code',
      user,
      { code: backup, trustDevice: false },
    );
    expect(recovered.statusCode, recovered.body).toBe(200);
    expect(
      body(await request('/api/v1/session-assurance', user)).verified,
    ).toBe(true);
    await request('/api/auth/sign-out', user, {});
    expect(body(await fixture.login(user)).twoFactorRedirect).toBe(true);
    user.address = '198.51.102.203';
    const replay = await request(
      '/api/auth/two-factor/verify-backup-code',
      user,
      { code: backup },
    );
    expect(replay.statusCode, replay.body).toBeGreaterThanOrEqual(400);
    expect((await request('/api/v1/session-assurance', user)).statusCode).toBe(
      401,
    );
    const totp = await request('/api/auth/two-factor/verify-totp', user, {
      code: syntheticTotp(uri),
      trustDevice: false,
    });
    expect(totp.statusCode, totp.body).toBe(200);
    expect(
      body(await request('/api/v1/session-assurance', user)).verified,
    ).toBe(true);
  });
});

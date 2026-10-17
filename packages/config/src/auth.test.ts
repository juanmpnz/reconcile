import { describe, expect, it } from 'vitest';
import { parseAuthConfig } from './auth.js';
const development = {
  AUTH_BASE_URL: 'http://localhost:5173',
  WEB_ORIGIN: 'http://localhost:5173',
  AUTH_SECRET: 'local-development-secret-replace-before-deployment-2026',
};
describe('authentication environment', () => {
  it('parses explicit MFA policy without coercing false strings to true', () => {
    expect(parseAuthConfig(development).AUTH_REQUIRE_MFA).toBeUndefined();
    expect(
      parseAuthConfig({ ...development, AUTH_REQUIRE_MFA: 'true' })
        .AUTH_REQUIRE_MFA,
    ).toBe(true);
    expect(
      parseAuthConfig({ ...development, AUTH_REQUIRE_MFA: 'false' })
        .AUTH_REQUIRE_MFA,
    ).toBe(false);
    expect(() =>
      parseAuthConfig({ ...development, AUTH_REQUIRE_MFA: 'yes' }),
    ).toThrow();
  });
  it('supports local SMTP and test-only capture', () => {
    expect(parseAuthConfig(development).MAIL_MODE).toBe('smtp');
    expect(
      parseAuthConfig({
        ...development,
        NODE_ENV: 'test',
        MAIL_MODE: 'capture',
      }).MAIL_MODE,
    ).toBe('capture');
  });
  it('rejects capture in development and production', () => {
    for (const NODE_ENV of ['development', 'production'])
      expect(() =>
        parseAuthConfig({ ...development, NODE_ENV, MAIL_MODE: 'capture' }),
      ).toThrow();
  });
  it('rejects unsafe production deployment without leaking secrets', () => {
    const values = {
      ...development,
      NODE_ENV: 'production',
      AUTH_SECRET: 'very-sensitive-value-that-is-not-configured-for-production',
    };
    try {
      parseAuthConfig(values);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(String(error)).toContain('Invalid authentication environment');
      expect(String(error)).not.toContain(values.AUTH_SECRET);
    }
  });
  it('requires one explicit same origin without credentials or paths', () => {
    for (const AUTH_BASE_URL of [
      'https://evil.invalid/path',
      'ftp://localhost',
      'http://user:password@localhost:5173',
      'http://other.invalid',
    ])
      expect(() =>
        parseAuthConfig({ ...development, AUTH_BASE_URL }),
      ).toThrow();
  });
  it('accepts an explicitly configured HTTPS SMTP production deployment', () => {
    expect(
      parseAuthConfig({
        NODE_ENV: 'production',
        AUTH_BASE_URL: 'https://reconcile.kershell.invalid',
        WEB_ORIGIN: 'https://reconcile.kershell.invalid',
        AUTH_SECRET: 'Q8u9naP3x5VkL6s7z2A1w0b4E9r8T3y5',
        SMTP_HOST: 'smtp.mail-provider.net',
        SMTP_PORT: '465',
        SMTP_SECURE: 'true',
        SMTP_USER: 'service-user',
        SMTP_PASSWORD: 'provider-password',
        MAIL_FROM: 'noreply@heykershell.com',
      }).NODE_ENV,
    ).toBe('production');
  });
});

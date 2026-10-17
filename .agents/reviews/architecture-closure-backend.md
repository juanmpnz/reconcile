# Architecture closure — backend implementation evidence

- Role: backend-engineer, with security implementation scope.
- Execution: `/root/backend_security`; implementation and sequential checks, not an independent review.
- Workspace branch: `feat/architecture-closure` (working tree; final SHA recorded by coordinator).

## Implemented boundary

`apps/api/src/request-context.ts` centralizes UUID parameter checks, current database-backed verified sessions, exact Origin / Sec-Fetch write protection, request-local actor reuse, current membership permission checks and atomic PostgreSQL mutation budgets. Document, operation/analysis, agreement, claim and dashboard routes use the same guard. Existing use-case/resource/tenant checks and worker current-actor checks remain in place. Context/capability lookup shares the verified-session helper and retains its own current-membership/audit logic.

Mutation budgets preserve the existing durable 100/minute per-user domains: documents, analysis/agreements, and claims. Upload onRequest and handler reuse one guard result rather than charging twice. No financial calculations or extraction rules changed.

All `/api/` responses receive `private, no-store`, pragma no-cache and nosniff in an onSend hook, including authentication errors and redirects. Forwarding headers remain stripped before Better Auth; trusted client identity is the actual socket. This prevents spoofing but means unauthenticated users behind the same proxy share an IP bucket. This limitation is explicit; no blind trustProxy or header trust was added.

Sessions have explicit eight-hour rolling expiration, thirty-minute refresh and fifteen-minute freshAge; cookie caching stays disabled. FreshAge applies to Better Auth endpoints that enforce freshness, not every business mutation.

## MFA policy and migration

Better Auth 1.7.8 twoFactor plugin provides TOTP and encrypted backup codes. `20261017010000_mfa` adds user enrollment, a unique per-user factor record, account lockout fields and nullable `Session.mfaVerifiedAt`. Existing sessions start without proof. Only a successful TOTP/backup verification response can mark the actual resulting session; initial enrollment, errors and a user-level enabled flag cannot grant assurance. Auth-required policy defaults to production; an explicit `AUTH_REQUIRE_MFA` string boolean can configure other environments. A user who opts into MFA still requires proof even when the environment does not require enrollment.

Business/context and native Better Auth organization endpoints enforce proof. A minimal pre-assurance native-auth allowlist permits login, logout, verification/reset and initial factor enrollment/challenge. Existing enabled but unassured sessions cannot read TOTP secrets, regenerate backup codes, list sessions or change account security. Trusted-device bypass is rejected. Required policy prevents disabling MFA. Recovery uses single-use backup codes; there is no administrator reset or silent email fallback.

Production smoke enrolls a real synthetic authenticator, proves the initial business denial, verifies a real TOTP, and completes an actual password+TOTP challenge after recreation. Its synthetic authenticator secret is stored only in the isolated smoke Redis project and removed with synthetic cleanup.

## Production response policy

Nginx applies a self-only CSP for scripts, fonts and connections; styles permit required inline layout styles, images permit local/data sources, and objects/framing are denied. Forms and base URLs are same-origin. Existing upstream policies are preserved exactly through a map, including the stricter document download `sandbox; default-src 'none'`. X-Frame-Options DENY and disabled camera/microphone/geolocation permissions apply to all statuses. No unverified HSTS topology is claimed. Production Compose explicitly fixes MFA to true; local example false and both deployment/local runbooks explain enrollment, recovery and stable AUTH_SECRET requirements.

Production smoke additionally asserts homepage CSP directives/frame/permissions headers and exact preservation of the original PDF sandbox plus private no-store. These executable checks require the production CI container environment; no Nginx/Docker runtime is available locally.

## Evidence executed locally

- `pnpm --filter @reconcile/database build`: passed; Prisma schema and generated client valid.
- `pnpm --filter @reconcile/config build`: passed.
- `pnpm --filter @reconcile/auth build`: passed.
- `pnpm --filter @reconcile/api typecheck`: passed, including integration test types.
- Targeted ESLint on changed backend/auth/config/tests/smoke: passed.
- `pnpm exec vitest run packages/config/src/auth.test.ts`: six tests passed, including explicit false/invalid MFA strings.

Eight new real-HTTP integration groups are committed as executable acceptance, but **not executed locally**: no PostgreSQL/Docker runtime is available here. Five cover auth cache headers, session lifetime/expiration/revocation, foreign/revoked membership across route families, missing/cross-site/lookalike origins and durable limits despite forged forwarding headers. Three cover real enrollment/TOTP proof, old-session and management bypass denial, password-only challenges, single-use backup recovery, trusted-device denial, and account lockout across renewed challenges and IP addresses. CI must execute these before verified status. Production smoke changes likewise require CI execution.

## Independent review and limits

`/root/security_architecture` independently reviewed the design/source and identified enrollment-session and seed/backup-management bypass risks during implementation. Both were corrected with server-owned per-session proof and the native-auth allowlist; the reviewer maintains its separate report. Runtime hook behavior must pass real HTTP acceptance.

No live deployment, certificate, encrypted host-volume, offsite backup restore or hostile-upload OS sandbox was verified by this work. Repository hardening is not a complete external security audit. Loss of both authenticator and backup codes requires a separately designed recovery process; no bypass is introduced here.

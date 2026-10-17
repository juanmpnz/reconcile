# Architecture closure: independent security and architecture review

Reviewer: `/root/security_architecture`, separate execution from implementation.
Scope: source preflight on 2026-10-17; final implementation review pending. Roles: solution-architect, security-engineer, platform-engineer. Status: changes-requested (preflight; not a production audit).

## Evidence actually examined

- `AGENTS.md`, `.agents/WORKFLOW.md`, the three applicable role profiles, `docs/architecture/overview.md`, implementation plan identity/deployment requirements.
- `packages/auth/src/index.ts`, application authorization entry points, the five API route modules, `apps/api/src/application.ts` and main bootstrap.
- `packages/document-processing/src/extract.ts` and `storage.ts`, production Compose and Nginx configuration.
- Installed Better Auth 1.7.8 types and two-factor schema. No dependency change proposed by this review.
- Read-only source inspection with `rg`, `cat`, `sed`. No attack, server access, or credential inspection. No service-backed execution by this reviewer at preflight.

## Existing boundaries to preserve

The modular monolith, separate worker, durable PostgreSQL state, private S3 and current membership authorization are appropriate for this scope. Session cookies are server-validated; cookie caching is disabled. Domain use cases re-check tenant membership and writers. Active organization and frontend routes are navigation state, never permission. PDF download must remain authorized attachment delivery. No bearer token in localStorage is necessary.

## Required bounded source work

1. **Medium — duplicated request security policy:** document/analysis/agreement/claim routes carry independent UUID/origin/session/rate code; dashboard and context implement their own subsets. Introduce a shared guard without removing use-case authorization, current membership, verified email or job checks. Preserve per-user durable rate limits, exact origin on browser writes, no cross-site writes, no information disclosure through invalid/cross-tenant IDs. Validate the change with negative HTTP tests.
2. **Medium — response security policy gaps:** auth/error responses need consistent private,no-store. Nginx lacks CSP/frame/Permissions policy. Add CSP compatible with actual bundled assets and dynamic inline styles; restrict scripts, objects, framing, origins and forms. Test actual rendered app rather than declaring a header alone sufficient.
3. **Medium — implicit session policy:** set and document expiration/refresh/freshness values explicitly. A configured freshAge only protects endpoints that actually require freshness; it does not make every business mutation require reauthentication.
4. **Operational — rate identity behind proxy:** request.ip currently identifies the immediate proxy; forwarded headers are stripped before Better Auth, preventing spoofed client IP but sharing the unauthenticated IP bucket. Do not introduce trustProxy=true or trust all X-Forwarded-For without a verified proxy topology and a header overwritten by that trusted proxy. Record and test before production scale.

## Release conditions outside this UI refactor

- **High, open for sensitive-data pilot:** implementation plan explicitly requires MFA for privileged accounts before real data. Better Auth two-factor is feasible but needs User.twoFactorEnabled plus a twoFactor table (secret, backupCodes, userId, verification/lock state), migration, enrollment/verification/backup recovery UI and server-side privileged policy. Adding a plugin alone does not fulfill this requirement. Must remain an explicit release blocker until implemented and exercised; do not claim security fully closed.
- Production TLS/domain/certificate, external encrypted backups and successful restore, access to host/volumes and encryption at rest remain unverified. Repository hardening is not evidence of these server controls.
- PDF parser has byte/page/text/time/heap bounds, disabled JS eval in PDF.js and no worker env. Worker threads are not an OS security sandbox; parser compromise could inherit process privileges and network/file access. Current isolated worker container still has private-service access. No malware quarantine/scanner or OS-level parser sandbox is verified. Record risk and isolation roadmap before hostile uploads.
- HSTS should be enabled only with verified stable HTTPS topology. Do not infer final domain correctness from environment examples.

## Review limits

No certification against all OWASP ASVS controls. No live Coolify inspection, backup restoration, certificate inspection, pentest, filesystem encryption verification or MFA acceptance. Final source and test review will be appended after implementation freezes.

### Additional frontend boundary requirement (source in progress)

**High if left unaddressed — sensitive cache across identity transitions:** explicit logout clears TanStack Query, but automatic session loss/account changes also need cancellation and cache clearance before another identity renders private content. Several organization-scoped query keys do not contain userId. The centralized 401 event plus App session identity guard must invalidate the previous boundary, including in-flight requests, rather than only redirecting the URL. Communicated to root and query/HTTP implementer; final behavior review pending.

## Follow-up scope decision and independent source review

Root explicitly expanded this closure to implement complete MFA, rather than deferring the sensitive-data blocker. Review will cover enrollment/challenge/backup recovery, server-owned per-session assurance, native organization endpoints, migration and production policy. The initial open condition is not yet resolved merely by this scope decision.

Shared HTTP/query source review passed for `lib/http.ts`, `lib/query-mutation.ts`, document transport/hooks, and associated HTTP/mutation tests. The transport forces same-origin relative API URLs, credentials, no-store, no redirect following; it preserves AbortSignal and does not expose response bodies in generic errors. Financial conflict classes remain typed 409 errors. Organization query keys include identity and tenant; mutation invalidation targets the exact prefix and explicitly disables retries, including when a caller configures global retries. Tests use a real QueryClient/MutationObserver for invalidation and failure behavior. This review did not rerun implementer tests.

Independent QA test-source review passed for the two new workspace browser groups: an actual UI refresh receives fixture HTTP401, private dashboard/navigation disappear and login renders; anonymous deep operation URL redirects before making any organization request. The suites explicitly use synthetic API fixtures and make no backend authorization claim. They do not substitute for identity-switch/cache race tests, real MFA or real database HTTP acceptance.

### MFA independent review, source checkpoint

Reviewed the installed Better Auth 1.7.8 implementation, not only its public configuration. Identified two material risks during implementation: enrollment rotates only the current session, and authenticated management endpoints can return the TOTP URI or regenerate backup codes with only a password. A flag-only gate would allow old password-only sessions to acquire assurance.

The implementation now uses an input-disabled `Session.mfaVerifiedAt` field and requires both current `User.twoFactorEnabled` and that per-session proof for business and native organization APIs when MFA policy is enabled. The successful TOTP/backup response hook selects `newSession` before existing session and ignores failure-shaped responses; initial enable alone cannot create assurance. Existing enabled but unassured sessions cannot access seed/backup management. Required policy forbids disabling MFA, trusted-device bypass is rejected, and the two-factor userId has a unique constraint to prevent concurrent duplicate enrollment records. Final source/CI and frontend flow review remain pending.

The two new real-HTTP MFA groups contain substantive assertions: encrypted seed/backup storage, initial/invalid-code denial, valid enrollment, old-session denial, management bypass rejection, password login without a full session, single-use backup recovery, trust-device rejection and TOTP challenge. These are source-reviewed tests, not tests this reviewer has executed; runtime hook behavior must pass CI before declaring the MFA condition resolved.

## Integrated source review (subsequent implementation checkpoint)

Independent review passed for current root integration: `app/session-boundary.tsx`, `app/routes.tsx`, `app/router.ts`, main provider wiring, auth mutation hooks/security setup, QR generation and context-invalidation correction.

- Identity generation immediately denies private rendering until query cancellation and clearance complete. Query keys include user identity; assurance additionally includes session identity. Explicit auth changes refetch and reset expiry, while HTTP401 hides private content and returns to login. Async generation checks prevent obsolete clearing work from marking a later identity ready.
- MFA gate applies both required-policy unenrolled accounts and optionally enrolled but unverified sessions. Background assurance/context refresh no longer unmounts or hides editing forms solely because a fetch began. Error/denial still blocks private content; backend authorization remains current on every request.
- Setup keeps seed/backups only in component state; password/code mutation results are reset and have zero garbage-collection time. QR is generated locally as a data URL. Recovery acknowledgment gates activation, and continuing removes secret UI. Backup recovery is available for existing unverified sessions. No secret persistence or external QR service was introduced.
- Native auth uses a small pre-assurance allowlist; non-exempt identity/session management endpoints require assurance for required/enabled accounts, closing the reviewed seed/backup management bypass. Business paths use the same effective policy. The unique per-user factor constraint and input-disabled session proof field are present.
- Nginx sets same-origin script/connect/font/form policy, blocks objects and embedding, and permits only the dynamic styles/local data images needed by current UI. Its upstream-policy map preserves the stricter attachment sandbox. No HSTS or broad proxy trust was asserted without server evidence.

Independent reviewer actually executed `pnpm exec vitest run apps/web/src/lib/http.test.ts apps/web/src/lib/query-mutation.test.ts`: **6/6 passed**. Source-reviewed new browser MFA cases exercise the forms/gates/local QR and transient secret UI with explicitly synthetic API success fixtures. They do not prove TOTP crypto or real backend permission enforcement.

Source status: passed for reviewed architecture/security changes, with no currently identified critical/high code finding remaining in that reviewed scope. Runtime acceptance for real HTTP MFA/migration, production Nginx and identity-change cache race remains required before verified task closure. Operational limits above remain unchanged; no server security certification.

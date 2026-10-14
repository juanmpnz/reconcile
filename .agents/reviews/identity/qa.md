# Phase 1 bounded QA review

Author/reviewer: `/root/harness_qa`. Backend implementation was authored by sibling `/root/identity_backend`; the integration tests were authored by this QA execution. This is independent examination of backend behavior and source, not independent review of this QA execution's own test code.

## Scope and evidence

Read AGENTS.md, the expert workflow, the QA profile, the phase-1 acceptance brief, the application/auth factories, schema and pinned Better Auth 1.7.8 source relevant to invitations, member hooks, password reset, cookies and rate limiting.

The current `apps/api/test/identity.integration.test.ts` contains 18 PostgreSQL/Fastify HTTP cases using actual Better Auth and Prisma. They cover registration and verification, canonical UUID organizations, tenant isolation including forged/stale active organization state, invitation matching/expiry/cancellation/replay, viewer/analyst restrictions, admin invitation and owner protection, immediate membership/role revocation, minimal scoped audit events, hostile/missing Origin and Referer, Fetch Metadata, rate limiting despite forged forwarding headers, multiple Set-Cookie preservation, password-reset replay and pre-reset session/signout revocation. Auth and database are not mocked. Only mail delivery uses the test-only injected capture callback; direct expiry/state fixtures exercise adversarial persisted state without replacing authorization.

Executed on the current test correction:

- `./node_modules/.bin/tsc -p apps/api/tsconfig.test.json`: passed.
- `./node_modules/.bin/eslint apps/api/test/identity.integration.test.ts`: passed.
- Prettier on the integration test: passed.

Local Vitest loaded the suite but correctly refused a missing isolated PostgreSQL DATABASE_URL. No local successful database execution or bypass of native PostgreSQL root restrictions is claimed.

## CI observations and corrections

The coordinator reported that [run 38619915838](https://github.com/juanmpnz/reconcile/actions/runs/38619915838) passed 9/11 initial cases. Hostile Origin acceptance and the expected rate-limit header required investigation. Pinned Better Auth disables origin checks by default in the test environment; this observation alone does not establish a production bypass. The backend now explicitly enables the native checks and applies an exact-origin browser-write guard. Better Auth emits `X-Retry-After`; the bridge preserves it and normalizes it to standard `Retry-After`. Expanded tests assert both headers and their numeric value.

The coordinator reported that [run 38620933718](https://github.com/juanmpnz/reconcile/actions/runs/38620933718), revision `0d4813c`, passed 17/18 cases including the expanded origin, limiter and reset cases. This execution has not independently fetched those CI logs; this paragraph attributes the observation to the coordinator.

The remaining failure was an incorrect test assumption that ordinary login emits multiple cookies when cookie cache is disabled. Pinned native `sign-in.mjs` passes `rememberMe:false` to `setSessionCookie`; `cookies/index.mjs:167-178` then emits both the signed session and `dont_remember` cookies independently of cookie caching. The corrected test exercises that actual HTTP flow, requires distinct Set-Cookie headers containing both named HttpOnly cookies, and proves the resulting browser session can create and access its organization. No cache or security setting was changed to satisfy the test.

## Independently observed final runtime evidence

This QA execution independently fetched the completed GitHub job steps and decoded logs for [run 38621534018, job 116050008456](https://github.com/juanmpnz/reconcile/actions/runs/38621534018/job/116050008456). The run belongs to source revision `d43d78571a36e709b487e969d6d81485f401c294`; GitHub checkout logs identify the tested PR merge revision as `115a2346b39974b0da94a24f7478cc207cdcc9dc`.

Observed results:

- Frozen dependency installation and `pnpm check`: passed.
- Real infrastructure startup and migration `20261014190000_identity`: passed.
- `Identity integration tests (real PostgreSQL)`: passed. Logs report `18 passed (18)`, one passing integration file, in approximately 6.8 seconds. This includes the corrected native multiple-cookie flow.
- `Smoke API and worker`: passed. Logs report ready PostgreSQL, Redis and private bucket, followed by `Smoke passed: API, PostgreSQL, Redis, private bucket and worker.`
- Cleanup: passed.
- The overall workflow is not green: its final evidence gate fails with `Task is not verified: 2026-10-14-phase-1-identity`. This is the deliberately pending task-record certification, distinct from the passing runtime/integration checks. The coordinator owns the task record and final gate rerun.

## Verdict and limits

Verdict: `passed` for the bounded phase-1 backend identity/tenant acceptance at the exact tested revisions above, based on source review and independently fetched real-service CI results. No new unresolved backend source finding in this bounded review. This verdict does not certify this QA execution's own test code as independently reviewed, and does not change the coordinator-owned task state or claim the final workflow gate is green. Native Codex/Claude discovery, real-company data, production SMTP/SSO and deployed reverse-proxy behavior were not tested. Later executable changes require fresh applicable verification.

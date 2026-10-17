# Architecture closure — data layer implementation

- Role: frontend-engineer (data access scope).
- Execution: `/root/query_http`; implementation and sequential verification, not independent review.
- Scope: `apps/web/src/lib/http.ts`, `query-mutation.ts`, feature API modules, organization queries, feature query/mutation hooks. Feature TSX integration belongs to `/root/ds_frontend`; authentication/MFA integration belongs to the principal.

## Implemented contracts

- One application fetch transport: same-origin `/api/` only, credentials included, browser cache disabled, redirect following rejected, caller AbortSignal preserved. Better Auth SDK keeps its own supported transport.
- A 401 emits `reconcile:session-expired` without payload. The principal owns cache cancellation, identity-boundary clearing, session revalidation and private route gating. A 403 does not emit logout.
- HTTP status errors expose typed `HttpError`; existing operation/document/claim/agreement conflict classes retain their identity, codes and Spanish messages. Financial optimistic fingerprints and explicit retry semantics remain intact.
- Success payloads retain contract schemas and tenant/resource identity checks. Malformed JSON in read helpers produces generic messages, not reflected document content.
- Typed query option factories include user identity, organization, resource and canonical parameters; implicit and explicit defaults share one cache key. AbortSignal reaches application API requests. Better Auth query methods do not expose a compatible AbortSignal contract, so cancellation relies on Query lifecycle there.
- Actual write functions use TanStack `useMutation`, with `retry: false` even when a QueryClient supplies a retry default. Successful domain writes invalidate the exact identity/organization prefix, including dependent dashboard, operations, reviews, claims and documents. Failed writes preserve caches and component drafts. Domain mutations exclude the unchanged membership-context query from invalidation: revalidating that blocking gate would unmount submitting forms before their post-submit navigation completes; server authorization remains mandatory and context still revalidates through normal route/focus/session checks. Explicit downloads track pending/error without invalidating unchanged data.
- Organization create/invite/cancel/accept invoke actual SDK methods and invalidate affected identity scopes. Authentication wrappers are handed off to the principal for integration with MFA and public-error handling.

## Verification

- `pnpm exec vitest run apps/web/src/features/operations/api.test.ts apps/web/src/features/agreements/api.test.ts apps/web/src/features/claims/api.test.ts apps/web/src/features/documents/api.test.ts apps/web/src/features/dashboard/api.test.ts apps/web/src/features/organizations/queries.test.ts`: 25 passed.
- `pnpm exec vitest run apps/web/src/lib/http.test.ts apps/web/src/lib/query-mutation.test.ts`: 6 passed. Tests exercise transport cookie/cache/redirect boundaries, cross-origin rejection, 401 versus 403, cancellation, malformed JSON, real optimistic conflict identity, exact-tenant dependent invalidation and no uncertain-write retry under a retrying global default.
- `pnpm exec vitest run apps/web/src/lib/query-options.test.ts`: 1 passed; canonical defaults deduplicate while identity, organization, page and filters remain isolated. Combined focused run: 9 files / 32 tests passed. A follow-up historical-analysis freshness regression adds a second canonical-key test (2/2 passed); the analysis factory keeps the current source fingerprint in its key. The mutation-context exclusion was rechecked with both mutation tests passing.
- Scoped ESLint on shared HTTP/mutation code, tests, feature hooks/API modules and organization queries: passed.
- `pnpm --filter @reconcile/web typecheck`: passed after concurrent DS source stabilized.

## Limits

No server penetration test or deployment verification was performed by this implementation execution. No claim of complete security certification. The full application acceptance, browser checks, independent security review and full workspace checks remain the principal's closure gates. Existing financial/domain authorization remains server-owned; frontend cache scoping is not authorization.

## Architecture enforcement and background authorization follow-up

- The principal assigned ESLint architecture gates to this execution: production frontend TS/TSX cannot call raw global/window/globalThis/self fetch; only `lib/http.ts` owns it. Production TSX outside the DS cannot instantiate native controls, table structure or disclosure widgets directly. Feature/app modules cannot import the compatibility `components/ui` path. Tests and DS implementation have explicit, narrow exceptions. Semantic page structure, fieldset/legend grouping and option descriptions remain valid HTML composition.
- `apps/web/src/lib/architecture.test.ts` executes real ESLint against representative source paths and checks rejection/acceptance for every gated tag, direct/global/computed fetch, legacy imports, supported DS imports and compatibility re-exports: 3 tests passed. `pnpm exec eslint apps/web/src --max-warnings 0`: passed.
- With the principal's authorization, `OrganizationDetail` now uses successful membership context for `canRead` during background revalidation. Initial pending and failed/denied membership still block private content and remove dependent resource caches. Background focus/reconnect no longer closes nested forms through the `authorizationPending` prop. Independent security execution `/root/security_architecture` reviewed the exact follow-up and returned source PASS; browser focus/draft evidence remains QA-owned.

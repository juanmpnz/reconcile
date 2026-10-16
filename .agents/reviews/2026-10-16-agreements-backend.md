# Reusable agreements backend implementation

- Role: backend-engineer, with data-engineer/security-engineer/solution-architect profiles loaded for implementation guidance.
- Execution: backend child agent `/root/backend`; implementation and sequential checks, **not independent review**. Independent security review is recorded separately by `/root/security_review`.
- Scope: contracts, tenant persistence/migration, API, application collector and explicit invoice selection; actual API integration acceptance tests. References read: AGENTS.md, .agents/WORKFLOW.md, README.md, architecture overview, implementation plan and affected existing analysis/document/claims flows.

## Implemented behavior

`agreement_versions` stores append-only reviewed terms with immutable version UUID, tenant, source original checksum, current extraction UUID, metadata and correction lineage, author and reason. Publication accepts only extracted tariff/quotation documents and verifies every submitted pricing/terms evidence snippet exists on the pinned extraction page. Replacements create a new immutable UUID; v1 intentionally has no edit endpoint or version family chain. PostgreSQL trigger denies UPDATE; composite FKs enforce source extraction/document/tenant ownership, and scope CHECK separates reusable and operation-local spot terms.

`operation_agreement_bindings` explicitly associates a linked invoice with a pinned reviewed version and service date, route and decimal distance. Composite FKs enforce tenant, operation and invoice membership. Operation row lock, current fingerprint, current membership and active-analysis guards protect replacement. Mutations append audit with before/after context and reason, bump revision, and existing claim/export freshness guards observe the resulting fingerprint. No-op identical context retains fingerprint. Unlinking an invoice removes its selection, while differential link edits preserve selections of retained invoices. Reclassifying a selected invoice removes its selections with operation lock/revision update and rejects active jobs.

Collector embeds immutable reviewed bindings in analysis snapshots, adds pinned source metadata and includes bindings in the input fingerprint. A selected source supersedes its mutable linked PDF facts globally, so another invoice must receive its own explicit selection rather than silently inheriting that agreement; unbound invoices receive `UNBOUND_INVOICES_REQUIRE_EXPLICIT_AGREEMENT_SELECTION`. With no bindings, the pre-existing fingerprint shape and snapshot shape remain (rule version changes still correctly invalidate older current results). Historic snapshots remain parseable. Worker version guard fails old queued jobs safely if the rule version is unavailable.

API exposes organization agreement list/create/detail and PUT operation agreements. Existing exact trusted Origin/current session/current membership/writer rules, no-store headers, bounded bodies and per-user mutation rate limits are retained. Pricing transport uses decimal strings; BigInt fixed-scale comparisons avoid Number precision loss and malformed input refinements do not throw.

## Evidence

- `pnpm build:packages`: passed after domain optional-type alignment.
- `pnpm --filter @reconcile/worker build`: passed.
- `pnpm --filter @reconcile/api typecheck`: passed, including integration test compilation.
- `pnpm exec vitest run packages/contracts/src/agreements.test.ts`: passed, 2 meaningful malformed-input and exact-precision boundary tests.
- Targeted ESLint for owned implementation/test paths: passed.
- Targeted Prettier check for owned TS paths: passed.
- Prisma schema generation and migration diff generation: passed.
- Real PostgreSQL/API integration tests written in `apps/api/test/agreements.integration.test.ts`: **not run locally**, no local Docker/PostgreSQL. Must run in CI before verified status. Tests use actual HTTP/auth/Prisma and deterministic seeded extraction to isolate agreement logic; they do not claim uploaded-PDF/S3 parsing coverage, which remains in existing document suites.

## Findings and limits

- Exact decimal refinement could throw on malformed amounts; fixed by validated BigInt conversion and regression tests.
- Composite source extraction and linked invoice FKs added after independent security feedback.
- Delete-all/recreate document linking would cascade retained selections; fixed with differential add/remove and acceptance assertion.
- Self-source invoice binding explicitly rejected with `AGREEMENT_SELF_SOURCE`.
- Current scope uses one selected agreement per invoice, exact provider/route identity, finite non-overlapping lower-inclusive upper-exclusive bands and reviewed accepted terms. No fuzzy supplier identity, connector/email automation, route-distance estimation or implied commercial approval.
- Status: implementation locally checked; real-service migration, tenant deletion and integration acceptance await CI and independent review closure.

Final follow-up checks: Prisma validation passed using a synthetic DATABASE_URL (schema validation only; no database connection claimed). Source/spot/version foreign keys use NO ACTION following independent security recommendation, retaining standalone deletion protection while supporting cascading tenant cleanup at statement end. API integration regressions additionally cover viewer/revoked access, mismatched source extraction FK, self-source rejection, and explicit replacement/reselection preserving the completed snapshot/result while staling its current status and auditing full selection context. Parser contract bumped to `logistics-text-v2` for km invoice extraction; old queued parser versions are rejected by the existing worker guard. Final API/integration typecheck, targeted lint/format and 2 contract tests passed after those changes. Real-service tests remain pending CI.

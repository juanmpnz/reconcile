# Operation usability — architecture decision and independent review

Reviewer: `/root/analysis_architecture`; roles solution-architect, security-engineer, data-engineer and integration-engineer. Owns this decision/review only, not production implementation. Read AGENTS.md, workflow, relevant profiles and existing operation application/contracts/routes, schema and ADR 0005. Scope: concise UX and safe operation/document editing before Phase 4; no new financial rules or connectors.

## Prior implementation contract

- Add `PATCH /api/v1/organizations/:organizationId/operations/:operationId` with strict `{name,reference,expectedFingerprint}`. Use existing create limits: trimmed nonempty name up to 200, reference up to 100, fingerprint SHA-256 hex. Return the existing full operation detail DTO.
- Reuse verified fresh membership, canWrite roles (owner/admin/analyst), trusted Origin/Fetch Metadata, safe errors, no-store and mutation-rate policy. A viewer cannot edit; absent/foreign tenant resources remain non-disclosing not-found.
- In a repeatable-read transaction serialize against the operation row, collect the current fingerprint and compare the supplied token. Return `409 STALE_OPERATION` (or existing safe concurrent-update conflict) instead of overwriting newer changes. Preserve unique organization/reference and map conflicts to `409 REFERENCE_EXISTS`. An identical name/reference is a no-op rather than an invented edit event.
- Name or reference changes increment the existing operation revision. Preserve the existing fingerprint hash shape: operation revision already captures name-only changes, so adding operationName would unnecessarily mark all pre-upgrade runs stale without an edit. Never rewrite historical fingerprints. This marks prior runs stale through the existing fingerprint, including name-only edits as requested. Never mutate a queued/completed run's snapshot, result or source provenance. Reference changes do not rewrite document facts or bypass operation-reference mismatch rules; explain that mismatch in the interface.
- Protect document association replacement with required `{documentIds,expectedFingerprint}` too. Compare the token under the same serialized transaction before adding/removing links; this prevents an older screen from silently undoing another user's associations or fact reviews. Existing structured fact revision optimistic checks remain in force. Do not change document originals or erase extraction/correction history when unlinking.
- Coordinator-approved product decision: metadata and association edits are blocked while any operation run is queued/processing, with `409 ANALYSIS_ACTIVE`. Check this inside the same serialized transaction as edits and analysis requests, preventing a check/write race. Explain the short wait and preserve drafts. This is a UX policy, not a requirement of snapshot isolation: captured inputs remain immutable regardless. Any change after completion marks that run stale; a new analysis is explicit. Structured fact revisions retain the existing Phase 3 permission during an active run; this compatibility behavior can make that run historical while metadata/link edits wait. Explain it explicitly in the UI; no mutable current-input reread by workers or new queue behavior is required.
- Persist an atomic before/after audit for actual metadata edits: operation ID, actor, timestamp, bounded before/after name/reference and revision. The existing audit table lacks a payload field; a single additive nullable JSON details column is justified if no existing suitable durable audit store exists. Validate a narrow server-created payload, do not log document contents or use an unrelated field as a hidden history store. No migration is warranted solely for UI changes or the existing revision/fingerprint semantics.
- The UI retains drafts on network/conflict errors and refreshes data for review before retry. It must not silently rebase an old user's submission onto a new fingerprint and automatically overwrite current data. Current canWrite controls actions, while the server remains authoritative. Query keys and fresh context gates retain user/tenant/resource isolation.

## Required review and acceptance

Independently inspect backend diff after implementation: strict schemas, tenant/read/write boundaries, Origin, unique-reference conflict, optimistic concurrency across metadata/links/facts, atomic audit and immutable queued/completed history. Meaningful actual-service tests should cover successful name/reference edit, duplicate reference in same organization, same reference permitted in another organization, stale token, viewer/foreign/revoked access, write Origin rejection, before/after audit, no-op behavior and active-analysis edit rejection plus old completed-run snapshot remaining unchanged after edits. Browser checks cover compact editor, retained draft/error state and link-edit conflict handling. No broad financial regression expansion is needed because the comparison engine remains unchanged.

Planning status at contract handoff: prior decision complete, final diff review then pending. Final source review is recorded below; no runtime success is claimed by this document.

## Final independent source review

Passed against the working-tree diff based on `d6bac070dd7131ad83dc8a0e3bff2c0da6c378da`. Independently inspected `operationUpdateSchema`, required document-link fingerprint, PATCH route, application update/link transactions, audit schema/migration and new HTTP test source. No production code or tests were authored by this reviewer.

The operation row is locked using parameterized `SELECT ... FOR UPDATE` inside RepeatableRead; analysis requests and fact revisions already update that same row. This serializes metadata/link mutations against execution requests and preserves optimistic concurrency. Prisma serialization conflicts use the existing safe 409 route handling. A no-op neither increments revision nor creates an edit event; it also avoids an update solely to lock the row. Active-run changes reject before changing state, while identical requests remain harmless no-ops. Tenant checks and strict Origin/rate policies precede writes, and the audit payload is constructed on the server in the same transaction.

One compatibility finding was resolved before closure: initially adding `operationName` to the fingerprint would mark every earlier run stale without an edit. The final code preserves the old hash shape; name-only edits increment the already-hashed revision. Historical fingerprints, snapshots and results are not rewritten. The additive nullable JSONB audit column is necessary for bounded before/after evidence and does not modify existing rows or financial rules.

The new HTTP test source covers successful metadata change with retained associations, immutable historical snapshot, before/after audit, stale metadata and document-link tokens, no-op revision/audit behavior, duplicate reference conflict, identical reference allowed in another tenant, restoration and re-analysis of the 62 USD case, unlink/relink without deleting originals, viewer/foreign/hostile-Origin/invalid-input rejection, name-only staleness, and active-run metadata/link rejection. These are meaningful real-service tests; no runtime execution is claimed by this source review. Final CI/QA acceptance remains required.

Source SHA-256 fingerprints:

```text
a032e2757b1e6ebe761ead7369f6f34a06535033f4e87207442be930294549bf packages/contracts/src/analysis.ts
54a2d7b49a1ce6c036d0fe8cd585f3f381c161f7837d05c5ce6c57e31ecd6896 packages/application/src/analysis.ts
0c896d1c53f0a8331878a48f94279fbb0064fce4d0b77367884b73abfdc46587 apps/api/src/analysis.routes.ts
a89ef3f8c6c95cc98591c71687a937a5179998e53440ea072b1bab690fc33206 packages/database/prisma/schema.prisma
fc82c7523dd274c51c4228eee4461dc148ce2b169841810ab2f063b869b32fe8 packages/database/prisma/migrations/20261016090000_operation_audit/migration.sql
451f587428287a6b7331770beb168547c6ae9db9e90c450b360a562e562dfc9f apps/api/test/analysis.integration.test.ts
```

Final status: independent architecture/security/data/integration source review passed; no open critical/high findings. Review execution here was read-only source inspection (`git diff`, `sed`, `rg`, `cat`, `sha256sum`), not infrastructure testing. Full review-history UI and financial Phase 4 remain outside this change.

## Incremental review after real CI concurrency failure

CI run `38719968438` reported two failures in 44 real HTTP cases: concurrent PATCH/PUT returned `[200,503]` instead of required `[200,409]`, and the identity audit exact-key assertion lacked the new nullable details column. QA supplied the actual PostgreSQL serialization-failure evidence; this reviewer does not claim an independent CI retrieval.

Independently inspected the corrective diff after source `3eddfea099bdae07eeffa7d8206416ff324ca2d1`: retain Prisma P2034 handling, and additionally map only a `PrismaClientKnownRequestError` P2010 with string SQLSTATE `40001` to safe `409 CONCURRENT_UPDATE`. Other raw SQL failures remain service-unavailable; no database message or SQL reaches clients. This preserves strict concurrency rather than weakening the test. Identity audit tests add `details` to the exact key set and require null for existing identity events, preserving prior email/cookie exclusion assertions.

Incremental source review passed. New hashes: routes `c7706a9a016efd8de634300255a5e4b74b08bf5318d5b981ed95464b0dacf290`, identity tests `6f052a1aad046afe3fe160571f455c3bb96c9a2098bbbc84fd1321dff0e969ed`, concurrency test source `3452a861c174d1bf8d51fd56fe8629a37b53621aa0a8a82e7ff1389deeab32d5`. Real CI rerun remains required; earlier runtime success is not extrapolated to this correction.

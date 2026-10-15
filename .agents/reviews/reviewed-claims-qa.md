# Reviewed claims — independent QA and platform execution

Execution: `/root/analysis_qa`, roles qa-engineer and platform-engineer. Owns this review/evidence record; production and new backend test code are authored by other executions. Prior phase-3 test authorship is disclosed in its own record and is not relabeled independent here. No phase-4 implementation or acceptance success is claimed at this planning point.

Read AGENTS.md, expert workflow, QA/platform profiles, current architecture, pilot requirements, implementation plan phase 4 and `docs/design/reviewed-claims.md`. Product and architecture decisions will define final endpoint/state details before dependent assertions are certified.

## Meaningful acceptance plan

1. Real uploaded/extracted documents lead to an actual completed analysis; a reviewed 62 USD eligible finding creates a server-calculated claim with source provenance. The client cannot supply or change the questioned amount, currency, supplier or evidence by forged request fields.
2. Decisions append immutable actor/time/reason history without rewriting engine results or accounting state. Expected revisions/fingerprints reject older screens and duplicate/replayed mutation behavior follows the explicit contract.
3. Eligibility is checked server-side: required human confirmation, current source/run, positive supported amount and compatible supplier/currency. Overlapping arithmetic/total/service findings are not summed into multiple monetary claims. Matched, rejected/accepted, unsupported or non-verifiable cases follow the product policy rather than becoming invented correction requests.
4. Repeated request and a later run representing the same charge cannot create duplicate active monetary claims. The source snapshot and claim amount remain reconstructible when another analysis is created or a document is corrected/unlinked.
5. Draft editing changes wording/recipient only within its declared contract; original evidence and financial snapshot remain intact. Conflicts retain the old server version and do not silently overwrite.
6. Export/copy is explicit, authorized and faithful to the claim's immutable provenance, with filenames/pages and necessary business references only. No private storage keys, presigned URLs, secrets or unrelated source content. Export/copy never marks sent. Stale-source export behavior must match the agreed policy and reject accidental use of outdated evidence.
7. Sent tracking is a separate explicit manual action with valid bounded date/note. State transitions, follow-up dates, resolutions and any accepted/corrected amounts are validated independently from questioned amount; no export infers sending or financial recovery.
8. Every decision, claim, revision, export and tracking route verifies current identity, tenant and resource membership, role and Origin for writes. Cover viewer, outsider, foreign operation/run/finding/claim identifiers, revoked membership, malformed/extra input and concurrent writes. Audit is bounded and atomic with successful mutations.
9. Real PostgreSQL migration constraints support tenant-safe associations, append-only histories and deduplication. Existing identity/document/analysis tests and service smoke remain enabled. No blanket exception mapping masks unrelated failures.
10. Browser interaction is reviewed by the separately assigned product/browser execution with explicit HTTP fixtures and production build. It remains separate from actual-service acceptance.

## Execution feasibility and limits

Docker is not installed in this executor (`command -v docker` returns no executable). Actual PostgreSQL/private-S3/Redis acceptance must run in CI, with decoded logs inspected at the exact source and tested merge tree. Do not replace real services with mocked outputs to claim integration. Run one full `pnpm check` after source freeze and hand its production build to browser QA, avoiding duplicate heavy compilation.

Backups/restoration, production server deployment and monitoring belong to phase 5 and are not acceptance claims for this phase. Confidential real-document accuracy, real mail sending, accounting writes and full screen-reader certification are outside this synthetic MVP check.

Status: plan prepared; implementation, independent test-source review, local gate and actual-service CI pending.

## Initial independent test-source review

Read the backend-authored four groups in `apps/api/test/claims.integration.test.ts` and frontend claim API/presentation tests. The backend suite constructs an actual uploaded four-PDF dossier, runs the real document processor and financial engine against persisted input, and uses native identity/HTTP. No financial output, authentication or parser mocks are injected. UI API tests explicitly mock `fetch` and cannot substitute for these service checks.

Meaningful existing assertions cover authoritative 62 USD creation after confirmation, unchanged analysis fingerprint for human review, per-invoice deduplication, append-only draft history, concurrent decisions/draft edits, exact re-download of persisted export bytes, export-not-sent, explicit recipient confirmation, manual follow-up/resolution, stale export blocking, explicit rebase preserving source/draft history, unpriced clarification and tenant/viewer/Origin/revocation boundaries.

Requested before final approval: concurrent edit versus export (not only two draft edits), reversal of a confirmation blocking export, event dates before claim creation/last event, explicit fiscal/operation-mismatch ineligibility, dossier provenance/checksum/export-hash assertions, sent-source rebase/export prohibition and broader viewer mutation coverage. Backend owns those test changes. A concrete test mismatch was identified: document correction endpoint returns 201 while the new claim negative setup expected 200; fix the setup assertion rather than altering that existing API. A frontend fixture lacked the required exports array and would fail schema validation before its intended foreign-tenant check; frontend was notified to complete the fixture.

Source review remains open pending corrections and actual execution. No runtime pass is inferred from this inspection.

## Final assembled source review and local gate

Reexamined the backend changes and expanded four HTTP test groups. The earlier correction setup now correctly expects 201. Added acceptance checks cover concurrent edit/export requiring exactly `[200,409]`, SHA-256 of exact persisted export bytes, dossier draft ID/version and parser/rule/run lineage plus original invoice reference, reversal blocking export, stale source/rebase history, manual event date before creation, sent export/rebase rejection, contradictory terminal outcomes, fiscal and operation-mismatch rejection, and strict rejection of client-supplied amount. The mismatch negative explicitly selects the known invoice document, avoiding a vacuous 422 caused by an unrelated operational-record kind. Frontend fixture exports are present, so its foreign-attribution tests reach their intended checks.

Independent new test-source review: passed for the examined implementation. Runtime safety is still pending actual CI. The broader role/tenant surface is reviewed in the shared backend authorization path; the four new groups are proportional, not an exhaustive every-route/every-role matrix.

`pnpm check > /tmp/reconcile-phase4-check.log 2>&1` completed with exit 0 after backend/frontend source freeze:

- Catalog validation and **8 harness regression tests** passed.
- Formatting, ESLint and strict application/test TypeScript passed.
- **67 unit tests in 13 files** passed.
- All packages, API, worker and web production builds passed.

A final frontend-only correction during this run requires explicit resolution outcome selection rather than defaulting to withdrawn. It landed before the final web build: `claim-detail.tsx` mtime 2026-10-15T12:47:42.752Z; production JS artifact mtime 12:47:55.488Z. The built JS includes the explicit resolution placeholder; this is artifact attribution, not a replacement for browser behavior tests. Post-fix scoped Prettier and ESLint also passed. Actual final production assets handed to independent browser QA: **`index-CXNIMy76.css` / `index-enDI0Y2i.js`**. No duplicate production build was requested.

Known Rollup dependency-annotation and bundle-size advisories remain visible. Real migration/HTTP/storage acceptance and service smoke remain pending the exact CI candidate; neither compilation nor the UI fixture suite certifies them.

## Final UI delta attribution

After the full check and its first web artifact, frontend added the explicit disabled Save condition for a resolved event without a chosen outcome. QA did not attribute the previous artifact to that later line. Ran scoped Prettier, scoped ESLint and `pnpm --filter @reconcile/web build` (strict TypeScript plus Vite), all passed, log `/tmp/reconcile-phase4-web-delta.log`.

The **definitive final browser artifact** is **`index-DwBAVmrC.js` / `index-CXNIMy76.css`**, replacing the earlier JS artifact above. Final `claim-detail.tsx` SHA-256: `965be0b89ca40d1dda576e1b5e644728f624615ce0428e105985e99f86446b90`. Frontend explicitly stopped production edits. Browser execution was informed to rerun its full thirteen groups against this final artifact; the earlier in-flight browser pass is not relabeled as testing the later change.

## Additional lifecycle finding RC-R1

The principal identified a blocking recovery gap after the first candidate publication: claim summary/detail stale flags compared only source input fingerprint, while export correctly checked decision identity. A confirm → dismiss → confirm sequence on the same run could leave `stale=false` but export blocked by `REVIEW_CHANGED`, hiding the UI's explicit rebase route. Initial CI run 38737672379 tests only the earlier source and cannot certify this later correction.

Backend owns the bounded decision-identity stale calculation plus real HTTP reversal/reconfirmation/same-run rebase recovery acceptance. QA will independently reexamine it and require a corrected-source CI run. Earlier source/full-check evidence is retained with its limits; no final runtime approval is inferred while RC-R1 is open.

## RC-R1 corrective source reexamination

QA independently read the correction in `packages/application/src/claims.ts` and the backend-authored second HTTP group. Claim detail now reads the latest decision scoped by organization/operation/run/finding and compares both its exact ID and confirmed action with the captured source decision. Review summaries apply the equivalent bounded LATERAL metadata lookup without loading all financial snapshots.

The real-service test explicitly checks stale flags in both summary/detail after dismissal and after reconfirming the same run, rebases the same claim/run/finding explicitly, requires both flags to clear, permits export again and compares prior source/draft versions unchanged. A subsequent new-run rebase requires three preserved source versions. This is meaningful recovery acceptance, not just a textual predicate test.

Incremental independent source review: passed. RC-R1 runtime closure remains pending a corrected-source CI run; initial source `124b2b1caa84d968e98a3c34625c4ed26a0389f9` predates this fix.

## Initial actual-service collection run — baseline only

Independently fetched GitHub job summaries, decoded logs and both Git commit-tree endpoints for [run 38737672379](https://github.com/juanmpnz/reconcile/actions/runs/38737672379), job 116431016858. Source `124b2b1caa84d968e98a3c34625c4ed26a0389f9` and tested PR merge `a474b77d3db763ab26ffb3e234b28fb4da3ec0e5` have identical tree **`c82db31c81966f6aba68e266fed00d08006c3fe4`**.

- Frozen install and full check: passed, **67 unit tests**.
- Real Compose infrastructure and migrations: passed, including `20261016120000_claims`.
- Real HTTP/PDF/Prisma/storage acceptance: **48/48 groups passed**: 4 reviewed-claims, 13 analysis, 10 documents and 21 identity.
- Service smoke: passed API, PostgreSQL, Redis, private bucket and worker.
- Complete job conclusion is failure solely at the expected final expert gate: `Task is not verified: 2026-10-15-reviewed-claims`.

This initial source predates RC-R1. Its passing four claim groups do **not** certify the later decision-identity stale/rebase correction. Final independent QA approval still needs the corrected-source real-service result. The separate final production browser run reported 13/13 fixture interaction groups on `index-DwBAVmrC.js`; it confirms UI behavior when supplied correct DTO flags, not the server computation of those flags.

## Corrected actual-service acceptance and RC-R1 closure

Independently fetched summaries, decoded job logs and commit-tree metadata for [run 38738540920](https://github.com/juanmpnz/reconcile/actions/runs/38738540920), job 116433953122. Corrected source **`ddd93dbd818d05300174f325cde23301dc84a3c6`** and actual PR merge checkout **`2adfa467729f26f8b55faf1cbb88863b65257981`** both report tree **`681bbaa358860b56a1d769186fbe2c9f70c7860a`** through independently queried Git commit endpoints.

- Frozen install and full check passed, including **67 unit tests**, retained harness/lint/format/strict types and all builds.
- Actual Compose infrastructure and all migrations passed, including the claims migration.
- Actual-service acceptance: **48/48 groups passed** — 4 claims, 13 analysis, 10 documents, 21 identity. The revised claims group now includes dismissal/reconfirmation stale flags in summary/detail, explicit same-run rebase recovery and retained source/draft versions.
- API/worker smoke passed with PostgreSQL, Redis and private S3 readiness up.
- Overall collection job is still failure solely at the expected task-closure gate: `Task is not verified: 2026-10-15-reviewed-claims`. It is not called globally green.

**RC-R1 is resolved** by the independently examined correction and this corrected-source real HTTP acceptance. Independent QA acceptance is passed on the pinned source/tree. Browser evidence remains separately attributed to `/root/analysis_product_domain`: 13/13 synthetic HTTP-fixture interaction groups on final production JS `index-DwBAVmrC.js`; it is not used as proof of backend financial authorization or stale computation.

The initial candidate's passing result remains above as historical baseline, without attribution to this later fix. A final documentation/task-closure commit requires its own final CI gate result before describing the complete PR workflow as green. Phase-5 production deployment, backups/restoration and validation with confidential company data remain outside this acceptance.

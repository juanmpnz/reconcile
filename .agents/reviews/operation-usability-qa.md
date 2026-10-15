# Operation usability — independent QA

Execution: `/root/analysis_qa`, canonical qa-engineer; platform feasibility also checked against the platform-engineer profile. Owns this review record only. Backend production and new test code belong to `/root/analysis_backend`; frontend belongs to `/root/analysis_frontend`. Reviewing these separately authored tests is independent; previous analysis acceptance test authorship is disclosed in the earlier phase record and is not relabeled here.

Read AGENTS.md, expert workflow, QA/platform profiles, implementation plan, pilot requirements, current application/contracts/routes and operation-usability architecture decision.

## Required acceptance

- Edit the existing operation's name/reference from a placeholder to `OP-DEMO-062` without changing its ID, documents or immutable analysis history. The old completed analysis becomes stale and a new explicit run uses the corrected reference.
- Name-only edits also mark prior analysis stale; identical submissions are no-ops. Actual edits append atomic bounded before/after audit with actor and operation ID.
- Duplicate same-organization reference returns a safe conflict; another organization can independently use the same reference.
- Metadata and document-link writes compare the submitted fingerprint inside a serialized transaction. An older screen cannot overwrite a newer metadata, association or fact revision. Conflict drafts remain reviewable in UI.
- Queued/processing analysis blocks metadata/link edits atomically; it retains its captured source snapshot. Completed historical snapshots/results remain unchanged after edits.
- Linking/unlinking changes only association records, preserves original downloadable bytes and extraction/correction history, and marks prior runs stale.
- Verified current owner/admin/analyst can mutate; viewer/foreign/revoked accounts and hostile/missing Origin cannot. Cross-tenant document IDs and mismatched operation/run resources remain rejected.
- UI is compact and keeps source limitations available without permanent oversized explanatory blocks. Browser fixtures, when used, are reported separately from real-service acceptance.

## Infrastructure feasibility and pending checks

`command -v docker` found no Docker executable in this executor. Local real-service acceptance cannot be claimed; use actual GitHub Actions PostgreSQL/Redis/private-S3 services and inspect its decoded logs. Do not start PostgreSQL as root, bypass its runtime restrictions or replace services with mocks to present an integration pass.

Final `pnpm check`, independent new backend-test source review and real-service CI are pending implementation. No success claimed yet. Browser execution is coordinated separately with `/root/analysis_product_domain` and must name its actual source and fixture boundary.

## Independent source review and local final gate

Reviewed the backend-authored addition to `apps/api/test/analysis.integration.test.ts` and its production schemas/routes/application diff. The integration file now has **13 test groups**; the new group contains multiple related assertions and is not presented as thirteen separate financial scenarios. Existing helper adaptations obtain a fresh fingerprint, while the dedicated stale-write probe intentionally submits the previous token.

The new group meaningfully proves the same operation ID survives reference edits and restores `OP-DEMO-062` for a new actual analysis finding of 62 USD; metadata audit captures before/after and revision; no-op writes do not manufacture edits; duplicate same-tenant references conflict while another tenant can use the same reference; stale links cannot erase associations; viewer, foreign tenant, hostile Origin and invalid fields are rejected; name-only edits stale history; queued analysis blocks metadata/link mutation.

QA requested two additions before approval. Backend implemented and QA reexamined: original download bytes remain exactly equal before/after unlink; old snapshot/result remain equal; concurrent PATCH metadata and PUT links submit the same fingerprint and require exactly one 200 plus one 409, one revision increment and unchanged historical snapshot/result. These source findings are resolved. No test assertions were weakened by QA and QA did not modify the test code.

Also reviewed frontend API response-boundary tests, bounded conflict-code handling, evidence deduplication preserving document/extraction/revision/page/snippet identity, and outcome counts that avoid summing overlapping or differently denominated monetary findings. These unit tests exercise local behavior with clearly declared `fetch` fixtures; they are not real-service HTTP acceptance or browser interaction proof.

`pnpm check` executed to completion with exit 0 on the assembled implementation after frontend freeze, including the backend test additions during its TypeScript phase:

- Harness validation and **8 harness regression tests** passed.
- Formatting, ESLint and strict application/test TypeScript checks passed.
- **61 unit tests in 11 files** passed.
- All packages/API/worker/web production builds passed.

Log: `/tmp/operation-usability-check.log` (transient execution evidence). Production web output `index-DTf3doRQ.css` and `index-f4qJtmNB.js` was handed to the separate browser execution without another heavy build. Existing Rollup dependency-annotation and bundle-size advisories remain visible and do not indicate a failed gate.

Independent source review status: passed. Actual-service runtime status remains pending the new CI run; the previous phase's 43-HTTP result does not certify this new 13th analysis group.

## First actual-service CI — failures found, not verified

Independently fetched GitHub job summaries and decoded logs for [run 38719968438](https://github.com/juanmpnz/reconcile/actions/runs/38719968438), job 116371821910, source `3eddfea099bdae07eeffa7d8206416ff324ca2d1` (PR merge checkout begins `49c8331`). Frozen install, full `pnpm check` with 61 unit tests, real Compose infrastructure and migrations passed. Actual-service HTTP acceptance: **42 passed, 2 failed out of 44 groups**. Smoke and final harness gate were skipped after integration failure; neither is claimed as passed.

Findings sent to the backend owner and principal:

- **Medium, runtime concurrency conflict:** the simultaneous metadata/link mutation test received `[200,503]` instead of required `[200,409]`. PostgreSQL diagnostic logs explicitly report `could not serialize access due to concurrent update`. The mutation rollback protects data, but the safe HTTP boundary must classify this genuine transaction conflict as 409 so the UI can retain/review the draft. Keep the acceptance assertion unchanged and fix production error classification; no broad SQL-message matching or unsafe raw error reflection.
- **Low, baseline audit shape regression:** the existing identity test at line 124 asserts exact audit-event keys and does not include the newly introduced nullable `details` column. Update the expected schema shape and assert existing identity events retain null details; do not remove its bounded audit checks.

Status: source review passed earlier, actual-service runtime **not yet passed**. Await production/test correction and a new actual CI run. The failing collection run is retained here as evidence and is not relabeled green after later fixes.

## Incremental corrective source review

Independently reexamined the two-file corrective diff at `2f8c722c4d54d3398c554d1fbda703cefa3c9fe9`: the API boundary maps only known Prisma `P2010` with a string SQLSTATE exactly `40001` to the existing safe `409 CONCURRENT_UPDATE`, alongside its existing `P2034` mapping. It does not match SQL error prose, expose raw errors or hide unrelated infrastructure failures. The identity test now includes the additive `details` key, explicitly asserts it is null for the existing identity audit events and retains email/token leakage checks. The concurrent-write acceptance still requires `[200,409]`.

Incremental source review: passed; both earlier runtime findings await confirmation by the new actual-service CI [run 38720562507](https://github.com/juanmpnz/reconcile/actions/runs/38720562507). Frontend source did not change; its separately attributed production-browser evidence remains applicable.

## Corrected actual-service acceptance — findings resolved

Independently fetched job summaries, decoded logs and Git commit-tree metadata for [run 38720562507](https://github.com/juanmpnz/reconcile/actions/runs/38720562507), job 116373789035. Source `2f8c722c4d54d3398c554d1fbda703cefa3c9fe9` and actual PR merge checkout `56d2bbd027c5ae55e123d24eb79d56a88ddfc297` both have tree **`3d457fe396299755c706974260c73ccc2012bdb2`**, confirmed through both Git commit endpoints.

- Frozen install and full `pnpm check`: passed, **61 unit tests**; existing harness regressions, lint, format, strict types and builds retained.
- Real Compose infrastructure and all migrations: passed, including `20261016090000_operation_audit`.
- Real-service HTTP acceptance: **44/44 groups passed**: **13 analysis**, 10 document and 21 identity groups. The unchanged concurrent PATCH/PUT assertion now succeeds, preserving exactly one successful mutation and a 409 conflict. The new identity details shape/null checks also pass.
- Service smoke: passed; readiness reports PostgreSQL, Redis and private S3 up; API and worker smoke complete.
- The complete collection job remains **failure only at the final harness gate**, with `Task is not verified: 2026-10-15-operation-usability`. This run intentionally collects runtime evidence before task closure; it is not described as globally green.

Both findings from the first actual-service run are **resolved by the examined production/test correction and this actual runtime evidence**. Earlier failure evidence remains intact above. Independent QA acceptance status: passed for this pinned source/tree, with separately authored browser evidence in `operation-usability-browser.md` (10/10 fixture-based interaction groups). No production frontend changes occurred after that browser build.

A subsequent documentation/task-closure commit needs its own final CI gate result. Synthetic PDFs and UI fixtures do not establish accuracy on real company documents; no deployed-server, backup restore, full-auth browser E2E or screen-reader certification is claimed.

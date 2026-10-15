# Document controls — independent QA

Execution `/root/analysis_qa`, canonical qa-engineer. Owns this review/evidence record only; production implementation and author tests belong to other executions. Read AGENTS/workflow and QA profile, current architecture/plan, `document-metadata-architecture.md` and `operation-document-controls.md`. Base main is `1bc136d`.

## Proportional acceptance plan

- Authorized metadata edit from the document table changes safe bounded display filename/type, increments metadataVersion once, and atomically records actor/time/reason/before/after. No-op creates no fake history. Existing original bytes, storage key, checksum, extraction run/result and scalar corrections remain identical; download uses safe current display filename.
- Optimistic and concurrent writes reject older versions with 409, with exactly one successful mutation for the same version. Viewer, foreign resource/tenant, revoked membership, absent/hostile Origin and malformed/extra input are rejected by the backend.
- MetadataVersion0 remains compatible with existing provenance/fingerprints. A rename stales old linked analyses/claims and a new analysis captures metadata version, while prior snapshots/results remain unchanged. Rename preserves reviewed financial facts; kind change invalidates classification-specific structured review through its existing financial fingerprint semantics. Test true associations, including documents linked to multiple operations if relevant to implementation.
- List operation links and summary fields reflect real bounded relationships rather than per-row heavy detail requests or invented counts. Search and allowed sort apply to the whole organization before pagination, have deterministic tie-breaking, reset page on new search and distinguish no documents from no results. Unknown sort/search bounds are validated and tenant scope applies before filtering.
- Compact operation header exposes the actual disabled reason visibly and accessibly, with keyboard/hover help only supplementary. Document edit retains draft on error/conflict and restores focus; current versus draft metadata is clear. Viewer remains read-only. Browser fixtures prove UI behavior, not actual backend security.

## Execution plan and limits

Review separately authored backend/frontend tests for meaningful assertions instead of duplicating their implementation. Execute targeted checks after stable source; retain the existing full quality and real-service CI gates. Local Docker has been unavailable throughout this executor session; confirm actual runtime feasibility before claiming HTTP/storage/database execution. CI provides real PostgreSQL/S3/Redis and exact tested source/tree evidence. Production-image regression checks remain separate from browser fixtures.

Status: preimplementation QA plan prepared. No code changes, test success, runtime approval or final acceptance claimed yet.

## Initial independent backend/platform source review

Read the separate author's metadata contract/schema/migration, document route/application changes, analysis provenance change and two new HTTP groups. Strict input and existing Origin/verified-role/rate boundaries are reused. Document row locking, expected metadata version, no-op handling and atomic bounded before/after audit preserve original fields. The financial source fingerprint deliberately excludes display metadata version; positive-only metadataVersion is included in operation provenance so unedited version-0 inputs retain their prior serialized shape. A kind change still invalidates classification-specific reviewed facts through the existing financial fingerprint.

The global list uses a tenant-scoped projected/filter CTE before pagination. Search values are bound parameters; sort and direction come from explicit allowlists with deterministic ID tie-breaking. Only the selected page receives bounded relation summaries; no per-row full-detail requests are introduced. Detail history is bounded by the revision cap and displayed version order. The additive migration `20261016100000_document_metadata` defaults existing rows to zero.

Separately reviewed the coordinator's platform delta: every production workflow Compose command now specifies `--project-directory .`, matching the current root-relative build context; the runbook explains the same invocation. SMTP documentation now describes port 587 and required STARTTLS consistently with the preexisting `1bc136d` configuration change. This task does not alter authentication implementation.

The new separately authored HTTP groups meaningfully assert immutable PDF bytes/checksum/run/corrections, metadata before/after/no-op, stale token and two-writer 200/409 race, path-safe filename, role/tenant/Origin boundaries, server search across a page boundary and allowed sorting, actual operation relationships, unchanged version-0 provenance and retained reviewed facts on rename versus invalidation on kind change.

No blocking production-source issue found in this initial read. Requested proportional acceptance additions before final QA closure: a linked claim becomes stale after rename, a new analysis captures the positive metadata version, and fresh revocation/missing-Origin checks on the new mutation where feasible. No runtime pass is claimed; source is still being finalized and full checks have not been started by QA.

## Incremental acceptance-source closure

Reexamined the added claims HTTP group: renaming the same invoice makes the existing claim stale, preserves its source/draft arrays exactly and blocks export with 409. The analysis group now explicitly creates a new run after rename and asserts source metadataVersion 1; the original run's snapshot/result and reviewed financial revision stay intact. These close the two requested provenance/staleness coverage additions.

Also read the new URL-state unit tests and metadata editor. Search/sort survive pagination, a new search resets page and unsupported sort/direction are not forwarded as arbitrary server fields. The dialog retains draft values across errors/conflicts, fetches current metadata and requires explicit review before using the newer version. The header exposes its disabled reason as visible text and an accessible description on the focusable wrapper. Actual interaction/focus/mobile claims require separately attributed browser execution, not this source read.

Independent source/test review: passed in the examined scope, no blocking finding open. New-route security reuses the existing fresh shared authorizer and baseline negative tests; the new groups test viewer/foreign/hostile-Origin but are not represented as an exhaustive every-route/every-role matrix. Local full checks are being coordinated by the principal; QA does not launch a duplicate heavy build. Real service acceptance remains pending exact CI source/runtime evidence.

## DC-P1 targeted re-review

Independently reexamined the final SQL-label correction and its HTTP assertions. `kindLabel`/`statusLabel` CASE values match all current Spanish labels in the frontend (`Factura`, `Tarifa`, `Cotización`, `Registro operativo`, `Otro` and the six processing labels). Global search includes both technical enum values and visible labels; sort maps only the allowed kind/status keys to those fixed label columns, retaining ID tie-breaking and parameter-bound search.

The separately authored document HTTP group now queries `Tarifa` and asserts the matching renamed document, then queries `Requiere revisión` and asserts both extracted documents before pagination. This exercises actual server filtering rather than a browser-only fixture. Targeted source/test review passed; DC-P1 runtime evidence remains pending CI. The principal reports the preceding full local check passed 71 unit tests plus 8 harness regressions, while this later SQL-only change received author-scoped format/lint; QA does not independently relabel those reported commands as its own execution.

The separate UX execution recorded 5/5 browser groups against final web assets `index-8GqciYnx.js` / `index-bLennfph.css` in `document-controls-ux.md`. Those explicit HTTP fixtures demonstrate interaction and responsive layout, not the corrected SQL's runtime truth. No frontend changes are required by this SQL correction.

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

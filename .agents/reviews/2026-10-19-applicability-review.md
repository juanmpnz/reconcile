# Independent applicability review — 2026-10-19

Reviewer execution: `/root/review`, separate from implementation agents. Canonical profiles consulted: QA, security, data, document AI, platform and accessibility. Scope: agreement applicability, economic evidence, extraction boundaries, authorization/provenance, immutable analysis history and changed UI. This execution authors only its independent regression test and this review; it does not implement the reviewed behavior.

Final status: **passed for the bounded independent code, financial, tenant/provenance and QA scope**, after the corrections and executions recorded below. Earlier changes-requested observations are retained chronologically. The repository-wide harness/full-check blocker remains open and is not a passed gate.

## Evidence actually examined

Read AGENTS.md, .agents/WORKFLOW.md, README, architecture overview, implementation plan and local-development runbook; examined the in-flight changes in contracts/domain, extraction, application agreement selection/fact revision, logistics engine, Prisma schema/migration and UI.

- `pnpm exec vitest run packages/sector-rules/src/logistics/evaluate.test.ts packages/document-processing/src/analysis-facts.test.ts packages/contracts/src/agreements.test.ts`: 62 tests passed in 3 files (20:50:23 execution output).
- Independent `applicability.review.test.ts`: initially 2 passed / 1 failed; missing operational identity incorrectly yielded PRICE_MATCH. Engine agent corrected the behavior. Rerun at 20:51:25: **3 tests passed**, covering independent BL/container charges, contradictory booking and missing identity pending.
- Docker Compose read-only inventory: PostgreSQL, Redis, SeaweedFS and Mailpit running and healthy. No implication that migrations or smoke passed.

## Preliminary findings and resolution tracking

- High — new nested evidence in fact revisions initially bypassed validation and revision marking. Communicated to principal; current code now traverses applicability/restrictions, references and equipment quantities. Integration proof pending.
- High — unknown operational identity could produce a verified comparison. Independent failing test reproduced; fix independently rerun successfully.
- High — explicit booking contradictions and billing basis/concept collisions initially missed. Engine correction independently covered by passing regression tests.
- Medium — selection recreated unchanged binding metadata with the current actor/reason. Principal correction observed preserving unchanged metadata; integration proof pending.
- Medium — bound agreement recursion discarded operational context, and candidate creation inherited invoice fields. Sent to engine; final reinspection pending.
- Medium — per-condition results initially absent from selected agreements. Engine correction reported; final reinspection pending.
- Medium usability limitation — advanced JSON editing is available for new conditions/equipment/bases/evidence. This is not equivalent to ordinary dedicated operator controls and must be disclosed.

## Limits

No deployment or merge. No real customer quote document evaluated; fixture identifiers and amounts remain synthetic. No browser/DOM/keyboard/contrast review executed by this reviewer yet. No final pnpm check, integration suite, migration or worker smoke result attributed to this reviewer. Final review will name the exact later commands and revision inspected.

## Independent regression expansion (20:55:30)

`pnpm exec vitest run packages/sector-rules/src/logistics/applicability.review.test.ts packages/sector-rules/src/logistics/evaluate.test.ts packages/document-processing/src/analysis-facts.test.ts packages/contracts/src/agreements.test.ts`: **74/74 passed in 4 files**. Independent file contains 11 cases. Additional regressions reproduced then verified fixed: selected incompatible contractual service, missing route falsely contradictory, duplicated corroborating container counts, and explicit contradictory BL counts silently accepted. Explicit valid/expired/missing shipment-date basis and reversed Valencia/Mundra route also covered. Synthetic monetary examples do not assert actual Q2603BCN00826 prices.

Current static reinspection confirms: nested source evidence validation/marking covers all newly introduced evidence collections; unchanged binding actor/time/reason is retained; selected decisions carry real contractual service and reviewed date context; recursive bound comparisons retain operational records; quantity calculations reconcile distinct normalized decimal counts and retain records used in economic evidence. Pure domain remains independent of ORM/HTTP; no dependency changes observed.

Independently inspected `/tmp/agreements-qa-mobile.png`: narrow layout and dialog actions fit; applicability pending and economic findings are separate and textual. Screenshot supplied by implementer; this is independent image inspection, not independent browser execution or a compliance certification. Implementer browser/keyboard evidence is separately attributed by the principal. Native new operation fields have since been added; the JSON editor remains for advanced complete structures.

Open follow-up sent before final scope freeze: published agreement terms must preserve explicit typed source references, since selected source facts are superseded by the immutable published version. Otherwise a source booking/BL contradiction may disappear when selecting a published version. Also verify resolved equipment from operational records is used consistently during economic tariff/quantity selection. Awaiting final implementation/reinspection.

## Final-edge verification (20:57:15)

Same four-file targeted command: **76/76 passed**, including **13 independent reviewer cases**. Newly confirmed selected immutable terms preserve explicit booking contradictions; booking-only equipment/count evidence supports tariff lookup. Publication now merges typed references from its pinned source and validates manually supplied reference evidence. Legacy terms reference enrichment is restricted to the pinned tenant/run/document and correction revision bound; it modifies current snapshots/fingerprints, not stored historical runs. Shared selected-context construction removes the observed decision/economic inconsistency.

Remaining high finding before final approval: absent `applicability` must not let current v3 publications or human-edited agreement facts use legacy wildcard behavior for unknown party/mode/equipment/conditions. Principal accepted the finding and assigned current-pipeline normalization from pinned source with missing dimensions explicitly unknown. Historical immutable stored results remain unchanged. Final approval awaits inspection and regression evidence for that correction.

## Current final source review and full unit evidence (20:58:36 onward)

`pnpm test` independently executed by `/root/review`: **162/162 tests passed in 28 files**. Includes actual PDF adapter tests, parser tests, all 13 independent financial/identity regressions and DS/Query architecture enforcement.

The high missing-model finding is now **resolved by source inspection**: `normalizeAgreementApplicability` explicitly marks missing dimensions/date basis unknown; new publication invokes it when the model is omitted; current analysis input collection applies it to legacy selected terms and revised agreement facts. Only pinned source run/document/tenant/correction revisions contribute to historical agreement enrichment. Frozen stored runs remain unmodified. Application integration regression now asserts omitted publication conditions stay pending and cannot produce matched prices. Final independent API execution is running separately.

Independent `pnpm harness:check` reproduced failure: canonical adapters match, but existing task evidence path `Agent planning and final static review reports in this task session` is missing. This review does not fabricate that historical evidence or claim the complete `pnpm check` gate passed. `git diff --check` passed.

## Final independent API execution and verdict

`node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts apps/api/test/agreements.integration.test.ts apps/api/test/analysis.integration.test.ts`: **19/19 passed in 2 files**, execution start 20:59:18, duration 14.02 s. Actual uploaded synthetic PDF bytes, identity, PostgreSQL, private S3 and Redis participated. Covers organization/resource/viewer/revoked-member boundaries, nested forged provenance rejection and revision stamping, immutable earlier snapshots and stale recalculation, pinned agreement/source versions and retained selections, omitted applicability pending, inherited operational source references, and audit metadata preservation.

No critical/high findings remain in this reviewed implementation. Scope-specific verdicts:

- **QA / logistics-domain:** passed supported financial and applicability cases, including 13 independent reviewer regressions. No inference of customer quote prices.
- **Security / backend:** passed bounded source review and actual API negative evidence for tenant authorization, untrusted evidence validation, viewer/revoked roles and resource identity. No new external endpoints or document-driven execution introduced.
- **Data / solution architecture:** passed additive nullable migration inspection, pinned source/version handling, current normalization and immutable historical run behavior. No dependency/ORM leakage into pure rules.
- **Document AI:** passed bounded supported label/row extraction review and actual PDF tests. Unsupported tables/restrictions stay pending; no general matrix/OCR accuracy claim.
- **Frontend / UI / accessibility:** source pattern review passed internal DS and Query/mutations; independently inspected the supplied mobile screenshot. Browser keyboard/focus/Escape, width and runtime checks were executed by implementer `/root/workflow`, not independently repeated by this reviewer. No comprehensive accessibility certification.
- **Platform:** migration reviewed as additive/nullable without backfilled invented actors; healthy local dependencies independently observed. Root owns full build/migration/smoke evidence. Repository-wide harness remains failed as recorded above.

All implementation fixes were made by other agents; this execution wrote only its regression test and this report. Last reviewed source includes normalized current-pipeline applicability and preserved typed source references; later changes need proportionate reinspection.

Remaining limitations: advanced condition/charge authoring still requires structured JSON; arbitrary PDF matrices/OCR and legal restrictions are not auto-verified; arbitrary other billing units remain pending without a supported actual-unit mapping; no FX conversion model is fabricated. Real Q2603BCN00826 PDF/prices were not supplied or evaluated. No deployment, merge or message sending occurred.

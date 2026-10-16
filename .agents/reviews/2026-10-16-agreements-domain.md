# Reusable agreements domain implementation and sequential verification

- Role: logistics-domain, backend-engineer, product-manager (implementation assignment).
- Identity: Codex subagent `/root/domain`; sequential self-check, **not independent review**.
- Scope: `packages/domain/src/{analysis,index}.ts`, `packages/sector-rules/src/logistics/evaluate{,.test}.ts`.
- Inputs read: `AGENTS.md`, `.agents/WORKFLOW.md`, applicable three role profiles, `docs/product/pilot-requirements.md`, `docs/plans/implementation.md`, `docs/architecture/overview.md`, existing engine/tests and agreed transport contracts.

## Decisions and evidence

- Snapshot optionally pins explicit invoice-to-agreement version selections. Selected agreement requires matching organization, version ID, provider, currency, service, route, service date and validity. Spot requires exact operation ID; reusable agreements must not carry an operation ID. No manufactured operation reference on shared source PDFs.
- Human-reviewed terms require `agreementBasis: accepted`; internal estimates and unknown acceptance produce not-verifiable. All term/price evidence must identify the pinned PDF and extraction run with page/snippet. Findings identify the immutable agreement version as evidence revision, distinct from machine extraction.
- Explicitly bound invoice uses only selected version; incompatible/missing conditions never fall back to another agreement. Unbound legacy documents retain existing per-operation behavior and the 62 USD excluded-service/other-provider scenario. This compatibility behavior is intentional, approved in task delegation.
- Distance bands are ordered non-overlapping `[fromKm, toKm)` with a finite exclusive upper bound. Gaps stay unsupported; zero/unknown distance cannot choose a band. Bands can specify whole-trip amount or whole-distance per-km rate. No marginal tier assumptions.
- Fixed-trip requires one compatible trip/service invoice unit. Per-km requires `km` and invoice quantity equal to reviewed distance. Unsupported units/quantities remain not-verifiable.
- Arithmetic uses Decimal precision 128 and exact decimal strings. No inferred exchange rates, rounding or monetary tolerance.
- `logistics-v2` identifies the new evaluator. Queue/history compatibility and snapshots are application/backend responsibility; backend notified.

## Findings and limits

- Closed high: draft terms lacked acceptance basis. Added required basis and rejecting guard; backend notified to align contracts/UI.
- Closed medium: manual terms initially emitted null revision identity. Findings now emit selected agreement version ID; security reviewer checked no document-revision lookup is triggered.
- Current selected-terms MVP describes one service/rate and does not describe exclusions. It must not borrow exclusions from another nonselected agreement; legacy exclusions are preserved for legacy unbound analyses.
- No assertion of accounting approval, actual service fulfillment, deployment, human contractual validation, integration smoke or independent approval.

## Checks

- `pnpm --filter @reconcile/domain build`: passed.
- `pnpm --filter @reconcile/sector-rules typecheck`: passed.
- `pnpm exec vitest run packages/sector-rules/src/logistics/evaluate.test.ts`: passed, 43 tests, including boundary/gap/overlap, exact decimal whole-distance rate, wrong supplier/currency/date/tenant/source, spot scope, separate providers, missing distance, basis and preserved legacy demo.
- `pnpm exec eslint packages/domain/src packages/sector-rules/src --max-warnings 0`: passed after final wording/basis additions.
- Full monorepo gates and independent review owned by principal.

Status: implementation ready for independent review; no known domain blocker after contract alignment.

## Follow-up: bounded kilometre invoice table parser

Root explicitly extended ownership to `packages/document-processing/src/analysis-facts.ts` and its focused test. Read document-ai-engineer profile before implementation. The existing bounded table grammar now accepts `km` alongside `trip`/`service`, with unit case normalized while retaining original source snippet/page. No arbitrary concepts, unsupported units or missing amounts are inferred.

- `pnpm --filter @reconcile/document-processing typecheck`: passed.
- `pnpm exec vitest run packages/document-processing/src/analysis-facts.test.ts`: passed, 4 tests (km/KM/Km decimal values and raw provenance; existing trip/service; unsupported/incomplete rows).
- Focused ESLint for parser and test: passed.
- Backend notified to bump parser version to `logistics-text-v2`; security and QA notified for independent review.

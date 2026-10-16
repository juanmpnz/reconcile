# Reusable agreements — independent preimplementation planning

Date: 2026-10-16. Execution identity: `/root/planning`. Mode: independent consultation requested by `/root`, before dependent code implementation. Roles consulted sequentially in this execution: product-manager, logistics-domain, solution-architect, ux-designer, visual-designer. This record does not certify implementation, QA, company validation or deployment.

## Evidence consulted

Read `AGENTS.md`, `.agents/WORKFLOW.md`, `.agents/manifest.json`, all five named role profiles, `README.md`, `docs/architecture/overview.md`, `docs/plans/implementation.md`, `docs/product/pilot-requirements.md`, ADRs 0005 and 0006, `packages/contracts/src/analysis.ts`, `packages/application/src/analysis.ts::collectAnalysisInputs`, Prisma `Operation`/`OperationDocument` relations, `apps/web/src/features/operations/operation-detail.tsx` and `apps/web/src/app/app.tsx`. Used read-only shell inspection (`cat`, `sed`, `rg`) and wrote `docs/plans/reusable-agreements.md`. No tests or browser interaction were performed for this planning stage.

## Decisions supplied before implementation

- Product/domain: reuse one annual PDF instead of requiring an upload per operation. Explicitly select the commercial basis per invoice, allowing annual and spot terms for the same provider and multiple providers in one operation. Email/ERP automation remains later scope. Unknown terms never become a verified invoice.
- Architecture: immutable reviewed agreement versions and tenant-owned source PDFs; per-invoice operation bindings. Bindings are authoritative applicability context without changing the original source operation reference. Capture exact terms/source provenance in immutable queued snapshots and include selections in the analysis fingerprint. Advancing operation revision preserves existing stale claim guards. Preserve historical snapshot compatibility.
- Pricing: separate fixed trip, per-kilometer and distance-band terms, with explicit interval semantics, decimal arithmetic, reviewed distance, validity/service/scope/currency checks and deterministic rounding. Unsupported/gap/missing conditions are not verifiable. No implicit FX, tax assumptions or proof of performance from matching prices.
- UX: organization “Tarifas y acuerdos” list/create; per-invoice selected basis/source/version and use saved/create reusable/create spot choices in operation detail; visible missing-data and stale-result states. Never silently choose the newest supplier agreement. Conflicts preserve user work.
- Visual: reuse current compact panels, controls, dialogs, tables, type and spacing. Status includes readable text, keyboard-operable actions, visible focus and mobile-readable layout. No unrelated visual redesign or dependencies.

## Risks and required closure

High: tenant/source/spot associations must be checked in backend transactions with composite tenant constraints; independent security/data review and service acceptance remain required. High: replay and claims cannot depend on mutable current agreement terms. Medium: numeric distance boundaries and fixed/per-km semantics must agree between contract, domain, UI and documentation. Medium: extraction support is bounded; manually reviewed terms cannot be described as automatically extracted.

Status: passed for preimplementation scope and design consultation. No final code diff was examined. Follow-up: inspect final implementation for product/domain and UX/visual alignment, then update current user guidance with only implemented behavior.

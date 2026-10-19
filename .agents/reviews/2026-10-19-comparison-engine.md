# Comparison case engine implementation evidence

- Identity: actual delegated agent `/root/engine`, backend implementation with logistics-domain scope.
- Mode: implementation and sequential self-check, not independent approval.
- Scope: `packages/sector-rules/src/logistics/applicability.ts`, `evaluate.ts`, `evaluate.test.ts`, `applicability.review.test.ts`.
- Instructions consulted: AGENTS.md, .agents/WORKFLOW.md, .agents/manifest.json, backend-engineer and logistics-domain profiles, README.md, architecture overview and implementation plan.

## Changes

The free case label is never compared with extracted external identifiers. Evidence-backed typed external references are checked against assigned operational records; agreement-specific restrictions are checked against invoice/context references within the same type. Assignment establishes membership, never commercial applicability. Missing external operation identity no longer adds a mandatory `operation-link` unknown condition. Operational context uses invoice-to-document identity, not the case label. Economic mismatch findings are emitted only for invoices. Agreement contradictions remain applicability decisions. Rules version is `logistics-v4`; no historical runs or extraction revisions are rewritten.

## Checks actually executed

- `node_modules/.bin/vitest run packages/sector-rules`: passed, 2 files / 69 tests (53 comparison, 16 applicability).
- `node_modules/.bin/tsc -p packages/domain/tsconfig.json && node_modules/.bin/tsc -p packages/sector-rules/tsconfig.json --noEmit`: passed.
- Prettier for all four owned files: passed.

Regression scenarios cover arbitrary case label with differing invoice/quotation identifiers, contracts as reference-only sources, explicit agreement booking contradiction, and provider incompatibility despite manual assignment. Existing tests retain booking conflicts against operational records, ambiguous agreement selection, unknown applicability and financial evidence cases. An obsolete test requiring external operation identity was updated to the confirmed membership model.

The first direct sector typecheck hit stale emitted domain declarations; rebuilding domain resolved it. The first `pnpm exec` triggered environment dependency verification/installation; no dependency or lockfile change was present in git status. Later checks used local executables.

## Limits

No production records, deployed API/worker, browser UI, or extraction revision flows were validated by this agent. No merge, commit or deployment performed. The coordinator owns full quality gates and independent review. Multiple invoices may represent different shipments, so no blanket invoice-to-invoice identity contradiction was added. Commercial conditions remain independently required.

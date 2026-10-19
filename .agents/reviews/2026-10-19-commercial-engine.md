# Commercial extraction engine implementation evidence

- Execution: `/root/commercial_engine`, delegated by principal engineer.
- Role: backend implementation of logistics-domain rules. Self-checks are sequential implementation checks, not independent review.
- Scope: `packages/sector-rules/src/logistics/evaluate.ts`, `applicability.ts`, and their two existing test files.
- Instructions consulted: AGENTS.md, .agents/WORKFLOW.md, manifest routing, logistics-domain and security-engineer profiles, README, architecture overview, implementation plan and pilot product requirements.

## Implemented behavior

Rules are versioned as `logistics-v5`. Extracted commercial rows remain visible as per-line nonverifiable findings: foreign tariff currency requires explicit FX review; unsupported concepts and missing invoice providers receive separate explanations. No currency conversion, provider inference, acceptance or date-basis inference is introduced.

Commercial charge keys must match after whitespace and case normalization whenever either side has a key. Missing or different keys cannot match on broad service alone. Keyed lines cannot use legacy broad-service exclusions. Legacy unkeyed comparisons retain existing behavior.

Rates with explicit billing basis may omit quoted quantity. Expected amounts still require independently documented invoice/operational quantity; the engine never invents a quantity of one.

Aggregate total mismatch is suppressed for `COMMERCIAL_ROWS_PARTIAL`, `SOURCE_INCOMPLETE` and `COMMERCIAL_TABLE_LIMIT`, because incomplete extraction does not establish a genuine invoice arithmetic error. Complete-source arithmetic checks remain active. This guard expansion addresses the independent review request delivered by principal engineer; independent review approval is not claimed here.

## Validation

- `pnpm exec vitest run packages/sector-rules/src/logistics`: passed, 77 tests across 2 files (final warning-guard revision).
- `pnpm --filter @reconcile/sector-rules typecheck`: passed on the final warning-guard revision.
- Prettier run on changed engine files.

Added coverage: foreign-rate preservation without false arithmetic; unsupported concepts and provider unknown without false missing-lines claims; distinct or absent commercial charge keys; normalized identical charge keys with distinct display labels; documented billing quantities with nullable quoted quantity; each incomplete-source warning suppressing false total errors while complete input detects the mismatch.

## Limits

No public real customer documents were added. These tests use synthetic evidence. This execution did not inspect production documents, deploy, certify provider identification, implement general commercial concept mapping, validate exchange conversion, or independently review its own code. Overall CI, service/API/browser acceptance and independent review are coordinated by the principal engineer.

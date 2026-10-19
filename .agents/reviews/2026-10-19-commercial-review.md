# Independent commercial extraction review — 2026-10-19

Execution: `/root/commercial_review`, independent of parser, rules and coordinator implementation. Roles: logistics-domain, solution-architect, security-engineer and qa-engineer. Status: passed for the bounded code/QA scope below; operational deployment and API/real-service verification belong to the coordinator's separate evidence.

## Scope and evidence

Read AGENTS.md, WORKFLOW.md, task brief, the four role profiles, README, architecture overview, pilot requirements, implementation plan and ADR 0008. Examined optional line/source/FX contracts, parser v4, reference matrix and invoice header adapters, application nested-evidence validation/revision marking, rules v5 and source-price/billed-amount presentation. Reviewed final working diff rather than only original implementation descriptions.

## Verification performed

- `pnpm exec vitest run packages/document-processing/src/commercial-tables.test.ts packages/sector-rules/src/logistics/applicability.review.test.ts`: final run passed 34 tests, two files. An earlier run found a swallowed BL condition following a matrix; parser implementation was corrected and the final run rechecked the regression.
- `git diff --check`: passed at review time.
- Source inspection confirms decimal/sign preservation; unknown/unsupported malformed rows become partial coverage; headers and section/footer boundaries delimit parsing; one-to-three equipment alternatives are handled; equivalent reference recaps merge evidence, while invoice duplicate rows remain distinct.
- Source inspection confirms nested FX evidence undergoes document/run/page/snippet validation and receives the append-only review marker. Optional fields retain old snapshot compatibility; parser and rules version bumps invalidate fresh fingerprints without rewriting historical runs.
- Public diff/new fixtures inspected: synthetic identifiers and altered amounts only; no original PDF or copied private source data included. No external service, new network destination, dependency, document logging, shell interpretation of source content or tenant authorization bypass was introduced.

## Findings and resolution

1. High — incomplete/truncated commercial row sets could generate false aggregate mismatch. Corrected rules now suppress `TOTAL_INCONSISTENT` for `COMMERCIAL_ROWS_PARTIAL`, `SOURCE_INCOMPLETE` and `COMMERCIAL_TABLE_LIMIT`; corresponding rule regression passed.
2. High — source foreign price must not masquerade as booked domestic unit price. Final contract/parser keep original tariff separate, booked amount unchanged, and monetary comparison pending for differing currencies; literal extracted FX does not itself authorize conversion. Checked with targeted tests.
3. Medium — broad active matrix state initially swallowed a later BL condition; corrected explicit section boundary and final regression passed. Footer termination and equivalent-reference dedup also inspected/tested.
4. Medium — long/malformed values, excessive rows/equipment/FX and oversized grouped decimals could fail a whole document or produce false completeness. Final bounded parser skips invalid values with partial warnings and retains supported rows; targeted bounds tests passed.

No critical/high findings remain open in this reviewed scope.

## Explicit limits

This is bounded extraction support, not universal invoice understanding or full automatic reconciliation. Commercial rows retain `service: unknown` until supported/reviewed semantics exist; missing supplier, source completeness, agreement acceptance, route scope, date basis, inclusion semantics and uncertain tariff values stay unresolved. Charge keys avoid merging unrelated concepts but do not establish translation/alias equivalence. Final inland destination is not replaced with an intermediate port to force agreement applicability. FX values are displayed as source facts only, never silently applied. No OCR, source authenticity certification, production server audit, browser visual approval or API-service execution is claimed by this reviewer. Coordinator must report these limitations and attach separate integration/check evidence.

Post-review amendment: the final equipment header matcher also accepts the curly apostrophe produced by PDFJS. Independently re-executed `pnpm exec vitest run packages/document-processing/src/commercial-tables.test.ts` after that small change: all 10 tests passed, including the amended curly-header fixture. This amendment is included in approval.

## Independent follow-up — legacy diagnostic compatibility

Reviewed the coordinator's small `evaluate.ts` amendment restricting commercial `CONCEPT_UNVERIFIABLE` and `PROVIDER_UNVERIFIABLE` messages to keyed commercial lines, while restoring the legacy unknown-service condition in `LINE_INCOMPLETE`. This preserves the existing clarification workflow for older label-based facts without weakening commercial uncertainty checks. Updated the commercial diagnostic fixture with explicit synthetic charge keys and added separate anonymized regressions for unkeyed missing-provider and unknown-concept inputs. Both retain a single not-verifiable `LINE_INCOMPLETE` with no monetary difference; keyed lines retain explicit commercial diagnostics.

Executed `pnpm exec vitest run packages/sector-rules/src/logistics/applicability.review.test.ts packages/sector-rules/src/logistics/evaluate.test.ts`: 79 tests passed in two files. No production deployment or full integration approval is claimed by this follow-up. Status: passed for this exact compatibility delta.

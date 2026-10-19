# Commercial extraction implementation evidence

- Role: document-ai-engineer; agent execution `/root/commercial_parser`.
- Mode: implementation and sequential self-check; independent review belongs to `/root/commercial_review` and is recorded separately.
- Scope: `commercial-tables.ts`, its synthetic tests, and additive `analysis-facts.ts` integration. Read AGENTS, WORKFLOW, document-AI/logistics profiles, architecture, implementation plan and pilot requirements.

Implemented explicit-header invoice columns and 1–3 equipment quote alternatives, separate original tariff prices/currencies and billed amounts, exact normalized charge keys (no semantic aliases), explicit FX, equipment groups, BL charges, directional routes and evidence. Missing supplier remains unknown. Uncertain monetary clauses retain evidence with null prices. Inclusions, absent original pages and partial rows are explicit warnings.

Sequential checks found and fixed section leakage into summary/footer rows, repeated reference-rate duplication, general-purpose equipment group carryover, matrix per-BL clause consumption, and array/decimal/description bounds. API smoke additionally exposed PDF extraction changing straight equipment apostrophes to curly; both are accepted and covered by regression. Equivalent reference rates combine evidence; invoice rows remain independent. Unknown table sections terminate parsing. Unsupported layouts remain missing rather than inferred.

Validation:

- `pnpm exec vitest run packages/document-processing/src/commercial-tables.test.ts packages/document-processing/src/analysis-facts.test.ts`: 19 passed (10 commercial, 9 existing).
- `pnpm --filter @reconcile/document-processing typecheck`: passed.

Only synthetic anonymized fixtures are in git. Private source PDFs/text/identities were examined outside the repository and are not copied into this record. No OCR, uncertain supplier identity resolution, contractual acceptance inference or arbitrary-layout support is claimed. Commercial services remain unknown unless already supported; successful extraction alone does not imply an applicable agreement or a confirmed discrepancy.

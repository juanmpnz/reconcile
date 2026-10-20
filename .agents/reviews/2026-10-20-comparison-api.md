# Comparison API — additive attachment and nested provenance

- Agent: `/root/api_tests`; backend implementation with sequential author checks. Independent review belongs to another execution.
- Read AGENTS/workflow, backend/security profiles and existing operation locking/link/revision implementation.
- Added POST operation documents/attach and service `attach`: authenticated org write membership, tenant-owned document, operation row lock, required current fingerprint, max 20 documents, active-analysis mutation guard, same-document idempotence, append-only association with existing links and bindings retained, revision and existing document-link audit event. Existing full replacement PUT remains explicit.
- Added typed frontend `attachDocument` and `useAttachDocumentMutation` through existing organization mutation/invalidation; no automatic write retries.
- Added nested `billingPeriod.evidence` and each line `pricingTerms.evidence` to fact-revision source validation and revision ID pinning. Original bounds (16KiB facts / source page and snippet checks) retained.
- Integration assertions cover additive attachment retaining all original documents, duplicate no-op/audit unchanged, stale 409, viewer/CSRF denial, foreign document 404, active run rejection, concurrent stale writes, unchanged historical snapshots/results. Nested source tests include forged document IDs and valid-bound absent page2 for pricing and billing evidence, plus successful revision pinning.
- No local isolated database/service infrastructure available; integration is authored for actual PostgreSQL/S3/worker CI and not claimed passed locally. Only synthetic fixture bytes used; no private source content or credentials included.

## Checks

- Targeted formatting passed for application, API route, hook/client and integration tests.
- Sequential `tsc -p` builds for domain, contracts and application plus API test `--noEmit` passed (exit 0).
- Focused frontend operation API suite: 7/7 passed, including additive POST/fingerprint and cross-tenant response rejection. Attach response also verifies operation/run scope and that requested document is returned.
- Integration execution deferred to service-backed CI; no local integration pass claimed.

## Full additive intake comparison acceptance

Added independent synthetic commercial PDFs (four invoice concepts, twelve matrix rates) through real upload/extraction, creating an empty case, attaching invoice by new POST, completing a prior analysis, attaching the quotation by POST and executing a new analysis. API result assertions cover candidate fields and currencies; equal bilingual aliases, different unit price, unknown concept without amount-based matching, exact 40HC rate among alternatives, original USD prices versus booked EUR remains pending, `claimable:false`, source page/document evidence, and immutable prior run.

API test TypeScript passed after this regression. A no-service exact-PDF-array execution using real PDF.js → deriveAnalysisFacts → evaluateLogistics → analysisResultSchema.parse passed (exit 0). Four candidates: ocean freight equal USD67, origin handling equal EUR23, documentation different EUR12/15, unmapped levy unknown. All pending/nonclaimable due missing provider/acceptance. Fact payload sizes 4056/7917 bytes and result 25317 bytes stay within existing bounds. This smoke verifies extraction/rules/transport shape, not database/HTTP persistence; service-backed CI remains required.

## Bounded commercial document/result budgets

Raised per-document facts to a named 64KiB limit in both collection and reviewed facts; named result limit is 512KiB. Input snapshot remains 128KiB and HTTP fact-review request remains 256KiB. No bound was disabled.

Added synthetic reference-budget regression generated from independent commercial matrix rows plus literal variable-pricing evidence. Real PDF extraction calibrated one source above the former 16KiB bound but below 64KiB and another above 64KiB. Supported source proceeds through collection, review and new analysis; oversized attach/review must reject without appending associations/revisions/history. Additive attach validates the newly attached source before commit using a strict source ID; read-only legacy collection still surfaces unsupported sources as warnings.

Added synthetic result-expansion regression: bounded candidate/condition expansion larger than former 128KiB result limit must persist below 512KiB; a later larger expansion must fail with `ANALYSIS_RESULT_LIMIT`, retain null failed result and preserve the previous successful snapshot/result. Real PDF/rule no-service calibration confirms the independent synthetic scenarios cross the intended thresholds. Service-backed persistence checks remain CI-only.

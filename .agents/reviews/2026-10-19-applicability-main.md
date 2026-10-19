# Principal and document-processing implementation evidence

Task: 2026-10-19-agreement-applicability. Actual coordinator/implementer `/root`; sequential checks, not independent review. Applied using-agent-skills, incremental-implementation, test-driven-development, git-workflow-and-versioning, documentation-and-adrs and code-review-and-quality workflows. Read repository rules, canonical principal/document-AI profiles, README, architecture and both implementation plans before implementation.

## Scope and decisions

Coordinated independent preimplementation consultation `/root/planning`, engine implementation `/root/engine`, application/UI implementation `/root/workflow`, independent reviewer `/root/review`. Their review claims remain bounded to their actual executions.

Owned extraction changes and tests: typed references remain separate; explicit supported origin/destination/equipment/date-basis labels, actual quantity labels and per-line semicolon rows retain page evidence; negative numbers preserved. No arbitrary matrix/column inference or undocumented FX conversion. Unsupported pricing remains reviewable pending. Parser bumped logistics-text-v3, engine logistics-v3. RED: three new parser regressions failed before code, then all eight parser tests passed.

Updated synthetic agreement PDF with documented unrestricted demo conditions and relevant date basis rather than weakening unknown checks. Fixed pre-existing plural filename to the singular filename already used by generator/tests. Only the agreement PDF regenerated; no real customer amounts were introduced. Added ADR0008 and user walkthrough.

## Observed verification

- Docker Compose dependencies healthy; Prisma generation and additive migration applied successfully to local development PostgreSQL.
- Actual platform smoke passed: API, PostgreSQL, Redis, private bucket and worker. Root-owned worker stopped afterward to avoid consuming recovery-test queues.
- Full service integration run: 66/66 tests across nine files passed. Earlier attempts exposed absent canonical fixture and concurrently running worker lock; fixes recorded above. Final new source-reference changes require focused rerun recorded in task.
- Lint, strict workspace types, 157 unit tests and production builds passed on intermediate corrected source. Later corrections require applicable reruns; final counts in task record.
- Eight harness regression tests passed.
- `pnpm check` failed before executable checks: historical `.agents/tasks/2026-10-17-auth-card-width.json` cites nonexistent path `Agent planning and final static review reports in this task session`. This task does not fabricate missing historical evidence.
- Global format check reports six pre-existing files outside this change: three 2026-10-17 task records, theme.css, workspace.css, compose.yaml. Changed-file formatting and executable checks are performed separately.

## Limits

No deploy, main merge or customer-document evaluation. No arbitrary OCR/matrix extraction claim. Additional restrictions without evaluators remain pending, and FX is unsupported even when a document contains an unevaluated exchange clause. Legacy JSON/snapshots remain readable; new runs preserve immutable history and source versions.

Final source closure: workspace lint, strict types, 162/162 unit tests, all builds and 68/68 real-service integration tests passed. Independent reviewer separately passed 162 unit /19 API tests. Subsequent missing-condition normalization is included in these final checks. Six Chromium groups passed via workflow execution. Task remains reviewed due pre-existing aggregate gate failures, not unresolved high implementation findings.

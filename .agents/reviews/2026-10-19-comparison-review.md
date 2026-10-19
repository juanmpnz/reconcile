# Independent comparison-case review

- Reviewer: actual delegated execution `/root/review`, independent of the engine, UI and API-test implementers.
- Scope: logistics-domain, solution-architect, security-engineer, QA, frontend/UI, accessibility source review and platform implications of the comparison-case changes.
- Revision: working diff on `fix/comparison-case`, inspected on 2026-10-19 before final coordinator checks/CI. Subsequent changes require their own verification.
- Consulted: AGENTS.md, .agents/WORKFLOW.md, manifest and the corresponding role profiles; README, architecture overview, pilot requirements, implementation plan, ADR 0008; changed engine, frontend, tests and the analysis application version/fingerprint/worker paths.

## Findings and disposition

No high/critical blocker found in the inspected diff.

- Free dossier labels no longer participate in external identity contradictions. Evidence-backed same-type references against operational records remain checked; agreement-specific invoice/context restrictions remain separate. Assignment does not override commercial conditions or unknowns.
- Agreements are obtained from the original snapshot for applicability decisions, even when they conflict with operational records. A suspected silent candidate exclusion was investigated and closed after inspecting `evaluateLogistics`.
- Economic findings are emitted for invoices. The web filters summary and review/claim rows to invoice findings while preserving historical source-document controls separately, without economic actions. Original stored snapshots/results are not overwritten.
- The empty-applicability message now differentiates absent structured data from an empty evaluated list without claiming that either proves a historical result.
- Existing per-tenant application authorization, audit and append-only fact revisions remain the write boundary; changes introduce no new public endpoint or relaxed tenant check. The added integration scenario covers tenant rejection and immutable history, but was reviewed, not executed by this reviewer.
- Changed UI uses existing DS controls and semantic table/section/heading elements; status is described in text. No browser/keyboard/contrast or responsive verification was executed by this reviewer, so this is a source review, not accessibility certification.

## Checks actually executed

`node_modules/.bin/vitest run` was started independently. It confirmed the changed engine suites: 53 evaluation tests and 16 applicability tests passed; the changed presentation suite passed 4 tests. Other completed suites included private document/operation/claim API boundaries, shared controls, side panel and query mutation tests.

The full run also encountered stale emitted workspace contracts (unknown new structured fields and missing dashboard export). The coordinator independently identified the same unbuilt-package condition and requested stopping redundant runs before rebuilding packages. The run was interrupted with exit 130; **this is not a passed full-suite result**. Coordinator quality gates/CI must supply final full-suite evidence after a dependency-ordered package build.

## Platform and remaining limits

`LOGISTICS_RULE_VERSION = logistics-v4` is included in the input fingerprint. A new analysis is required; existing historical runs become stale but remain readable. No schema migration or automatic reinterpretation/rewrite of persisted extraction/review values is introduced. API and worker must be deployed from the same revision; in-flight older-version jobs can fail explicitly with `RULE_VERSION_UNAVAILABLE` and require a new run under the new version.

No Docker/PostgreSQL integration, production services, real customer PDF extraction, browser acceptance, Coolify deployment or service smoke was executed by this reviewer. Arbitrary tariff matrix extraction and OCR remain limitations, rather than being presented as validated capabilities. Final integration/browser/production checks belong to coordinator/CI evidence.

Status: passed independent source/domain/security/platform review, subject to final build, integration and browser checks recorded separately. No claim of deployed verification.

## Expanded final source review

Re-examined the subsequent `packages/application/src/claims.ts` change and matching `FindingReviewCell` guard. Finding decisions now require an invoice source in the immutable run snapshot before incrementing review version, appending a decision or audit. The tenant-scoped run lookup, locked authorization and freshness checks remain ahead of this guard. Missing/non-invoice sources fail with `INVOICE_SOURCE_REQUIRED`; existing invoice claim creation is already guarded. No new authorization bypass or mutable source lookup is introduced. This addition was source-reviewed; its integration regression is a coordinator/CI responsibility, not executed here.

Also inspected final ADR/user-guide/status clarification, the historical task evidence repairs, CSS whitespace formatting and Compose trailing-blank-line cleanup. Historical unsupported review approvals are downgraded to `not-run` without inventing replacement execution evidence. The CSS and Compose changes inspected have no semantic value change. Documentation records extraction limits and fresh-analysis requirements without claiming deployed verification. No additional blocker found in this expanded scope.

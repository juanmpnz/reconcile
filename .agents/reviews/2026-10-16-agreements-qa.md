# Reusable agreements — independent QA and accessibility review

Execution: `/root/qa`, independent of domain, backend and frontend implementers. Roles: qa-engineer, accessibility-reviewer, ui-engineer review. Owns this report only; no implementation edits. Read `AGENTS.md`, `.agents/WORKFLOW.md`, the three role profiles, README, architecture overview, implementation contract `docs/plans/reusable-agreements.md`, domain implementation review, and affected source/tests.

## Scope and acceptance

Reviewed immutable per-invoice selection, annual versus operation-owned spot agreement choice, reusable original PDF selection/upload flow, applicability explanations, read-only role presentation, conflict recovery and current versus historical analysis boundaries. Reviewed exact kilometer pricing, half-open finite bands, gaps/overlap, source evidence, accepted basis, supplier/currency/route/date compatibility and legacy demo compatibility.

Domain and frontend tests are authored by separate implementers and independently inspected/executed here. They are not represented as live customer-document verification.

## Source review

- `evaluateBinding` validates pinned version/tenant/spot operation and source PDF/extraction evidence before comparing, then acceptance basis, supplier/currency/date/service/route. Explicit selection takes precedence without fallback to a conflicting legacy tariff. Missing/contradictory data produces not-verifiable. Fixed-trip requires quantity one and matching service unit; per-km requires reviewed distance and matching invoice kilometers. Decimal precision 128 avoids binary money arithmetic.
- The agreed v1 pricing policy is exact decimal comparison, with no automatic rounding/tolerance or implicit FX. This was clarified with the domain implementer and principal, with the plan being aligned; sub-cent differences stay visible and contractual rounding remains unsupported. Finite upper-exclusive bands and independent immutable version UUID replacements are intentional agreed scope, not grouped revision editing or unbounded bands.
- `CreateAgreementDialog` reuses an existing tariff/quotation PDF; new uploads reuse the private document flow and poll for extraction. Every form field/select has a label; instructions explain literal evidence and manual review, accepted confirmation, price basis, boundary semantics and missing data. Dialog composition uses existing Radix focus/escape infrastructure. Feedback uses role alert/status and moves focus to errors.
- `OperationAgreements` renders three explicit writer choices per invoice and preserves independent provider/spot basis. Read-only state retains selected version, terms and source evidence but omits mutations. Selection dialog preserves controlled draft after optimistic conflict and requires deliberate review of current data before retry. Date/scope/distance and audited reason are explicit. Existing operation staleness UI handles old runs; actual integration persistence must be verified by API tests/CI.
- `AgreementList` uses real table semantics, caption, scoped headers, keyboard-focusable horizontal table region and existing responsive primitives. Source links distinguish opening another tab where applicable. Mobile/zoom/contrast/focus behavior has **not** been visually verified.

## Findings

- **AG-QA-01, medium, resolved after independent re-review:** `applicabilityNotes` initially uses `Number` for bounded decimal distances/bands while contracts/domain use exact decimal comparison. A valid band `[999999999999.00000001,999999999999.00000002)` incorrectly reports no tariff at its lower boundary because both convert to the same Number. Also nonnumeric nonband distance can omit the missing-distance warning. Frontend replaced Number comparison with bounded decimal parsing and scaled BigInt; invalid strings produce the missing-distance warning. Independently re-read the correction and its large-boundary/invalid-input regression tests. Backend/domain financial truth was unaffected; inaccurate pre-analysis UI feedback was the impact.
- Acceptance-basis omission found during initial source read was corrected by implementers to explicit accepted/internal-estimate/unknown with a rejecting engine guard. Not a remaining finding.

## Executed checks and runtime constraint

- `pnpm exec vitest run packages/sector-rules/src/logistics/evaluate.test.ts apps/web/src/features/agreements/presentation.test.ts`: 43 domain tests and 4 frontend presentation tests passed in this execution. Assertions inspect actual findings/prices/evidence, not implementation text.
- `pnpm --filter @reconcile/web dev`: failed in executor network enumeration (`uv_interface_addresses`). `pnpm --filter @reconcile/web exec vite --host 127.0.0.1 --port 5173`: started successfully; this confirms development serving only.
- Prepared `/tmp/agreements-browser-qa.cjs` with intercepted synthetic HTTP fixtures for intended browser acceptance. `node /tmp/agreements-browser-qa.cjs` could not launch because Chromium is absent. `node /opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/cli.js install chromium` failed after all retries: restricted network delivered a 195-byte HTML response instead of a ZIP. No system browser was found. No screenshots, DOM interaction, focus, keyboard, mobile, conflict or browser flow pass is claimed.
- Real PostgreSQL/Redis/private S3 HTTP and migration checks are owned by the principal's CI path; no Docker infrastructure was available for this QA execution. Live email, arbitrary OCR extraction, actual contracts, accounting approval and deployment are excluded.

Current status: independent domain/frontend source and executable unit review **passed**, AG-QA-01 resolved. Browser acceptance remains **not-run locally** due runtime limitation. Principal requested a portable CI browser suite; authored `apps/web/test/agreements.browser.mjs` using Playwright, network fixtures and built-in assertions. It exercises reusable creation from existing PDF, explicit saved and spot selections on separate invoices, source/version display, preserved synthetic history/stale notice, missing-distance feedback, conflict draft preservation/retry, keyboard escape/focus and mobile width, and viewer mutation omission. CI execution/evidence is pending and must not be conflated with real backend service tests.

## Incremental executable verification

Re-ran the targeted domain/presentation command after the precision correction: **49 tests passed** (43 domain, 6 presentation in the source at that time). Browser suite `node --check` passed; ESLint initially found an omitted structuredClone environment declaration, corrected in the suite. A subsequent complete lint result is recorded with final CI evidence. Browser fixture writes emulate persistence and staleness only; actual server snapshots/audit/tenancy remain integration-test responsibility.

## Final local source scope

`pnpm exec eslint apps/web/test/agreements.browser.mjs --max-warnings 0` passed. Final targeted domain/contracts/presentation run passed **51 tests** (43 + 2 + 6). Independently reviewed the later narrow kilometer invoice-table extraction change in `packages/document-processing/src/analysis-facts.ts`: it adds only explicit `km` unit recognition and lowercase unit normalization, retaining anchored known service syntax, exact input decimal strings and original row/page evidence; unsupported/incomplete rows remain missing rather than inferred. `pnpm exec vitest run packages/document-processing/src/analysis-facts.test.ts` passed **4 tests**. Parser-version bump and real API integration remain attributed to coordinating implementation/CI.

## Published-candidate runtime acceptance — independently inspected

Additional execution `/root/analysis_qa` independently inspected the existing source/test review and fetched GitHub job summaries, decoded logs and both Git commit-tree endpoints after the user's explicit public publication authorization. No implementation/test edits or repeated local full check were performed by this execution.

Published source **`8dbe3501cec9aa06da0da382ae5ac9f1e35a0f1a`** and tested PR merge **`32d4ac36b801cd3ed62ea9dd67d7036e90d44fbf`** both have tree **`22ecc9b89958343e4115cbb4dc5f0d042daaeafd`**, independently verified. This is the same content as the preserved local candidate; no previous unpublished runtime result is invented.

[Quality run 38946661404](https://github.com/juanmpnz/reconcile/actions/runs/38946661404):

- Job **117127395923** passed frozen install, full quality with **106 unit tests**, real infrastructure and all migrations including `20261016130000_agreements`.
- **53/53 HTTP groups passed**: 14 analysis, 11 documents, 5 claims, 21 identity and 2 new agreements groups. The agreements groups use actual native authentication/HTTP, PostgreSQL constraints and analysis jobs, with **explicitly seeded extraction records to isolate reviewed commercial terms**. They are not represented as a new PDF-upload/parser/S3 end-to-end test. Existing document/analysis/claims suites and production smoke retain actual PDF/private-storage processing coverage.
- Existing API/PostgreSQL/Redis/private-bucket/worker smoke passed.
- The complete quality job fails solely at the expected pre-closure task gate: `Task is not verified: 2026-10-16-reusable-agreements`. This collection workflow is not called globally green.
- Browser job **117127396336** completed successfully with six explicit PASS groups: reusable creation from an existing PDF source; keyboard Escape/focus; invoice-specific saved selection/source version; independent annual/spot selections and stale history; missing-distance/conflict retention/retry; mobile/focus containment; viewer read-only/no browser runtime errors (related assertions grouped by the suite's six output lines). HTTP interception is explicit synthetic fixture behavior, separate from service correctness. Browser evidence artifact **12067350776** was uploaded at https://github.com/juanmpnz/reconcile/actions/runs/38946661404/artifacts/12067350776 . No local browser pass was retroactively claimed.

[Production containers run 38946661459](https://github.com/juanmpnz/reconcile/actions/runs/38946661459), job **117127395986**, completed successfully. Actual web/API/worker targets built; migrated production stack and real >1 MiB PDF/private-S3/worker/cookie checks passed. API-only recreation retained the running Nginx proxy; full recreation preserved PostgreSQL/Redis/storage and original bytes. Docker reused the same IP addresses, so changed-IP recovery is not claimed. SMTP configuration was synthetic; no actual delivery or user-server deployment occurred.

Independent runtime QA acceptance is **passed on this exact source/tree**, with the seeded-extraction/browser-fixture boundaries above. Earlier local limitations remain historical facts, now supplemented by actual CI rather than rewritten. The principal must close task/evidence metadata and obtain its final full-workflow gate result before describing the PR as completely green or merged.

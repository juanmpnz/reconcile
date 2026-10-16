# Workspace redesign — independent QA

Execution `/root/analysis_qa`, canonical qa-engineer. Independent of dashboard/backend, shared DataTable and shell/SidePanel production authors. Owns this review, the new `apps/web/test/workspace.browser.mjs` and necessary test-only compatibility adaptations in `agreements.browser.mjs`. Browser test authorship is not described as independent review of that same test; architecture has been asked to review its source separately.

Read repository rules/workflow and QA profile, `docs/design/workspace-redesign.md`, dashboard contracts/application/HTTP tests, shared table API, shell/panel source and prior browser suite. No financial-rule reset or implementation edits by QA.

## Proportional acceptance and source inspection

The new dashboard tests explicitly seed persisted metric fixtures, then use actual Better Auth/Fastify/PostgreSQL. They check totals beyond a page, latest completed results without historical double counting, latest human decisions, pending limits and empty/current-viewer/foreign/anonymous/revoked boundaries. They do not claim new PDF/financial-engine E2E. Global operation/agreement list tests seed 60 rows and exercise real beyond-page query/order, literal wildcard characters, deterministic pagination and tenant/input validation.

Browser runner uses explicit intercepted synthetic HTTP fixtures, independently of those service tests. Planned groups: default overview and workspace section navigation; full DTO counts rather than loaded-page totals; local Inter font; table server pagination/global search/sort/page-size request parameters; right desktop and full-width mobile SidePanel; dirty Escape keep/discard and keyboard/focus return; measured brand-action text contrast; organization switch, dashboard error versus valid counts, viewer controls and zoom. Sorting is explicitly triggered from page 2 and requires both new sort and reset-page parameters, guarding atomic server-state updates.

Existing agreements suite adaptation is test-only: provide organization-list fixture for the new shell and explicitly discard the intentionally dirty mobile band editor rather than treating Escape as unconditional data loss. Existing financial/user-flow assertions remain enabled.

## Checks actually executed so far

- Node syntax check for the new portable runner: passed.
- Scoped Prettier and ESLint for the new/modified browser scripts: passed.
- No local full check/build duplicated while the coordinator prepares the final production build.
- New browser runtime, screenshot/contrast/focus results and actual-service acceptance: pending stable build/CI. No browser or financial acceptance success is inferred from script preparation.

Potential production defects are sent to the responsible authors. Architecture reported the server-sort/pagination two-callback race; the new browser case covers sort from a nonfirst page, and final review must inspect its correction. No implementation or test assertion is weakened to hide failures.

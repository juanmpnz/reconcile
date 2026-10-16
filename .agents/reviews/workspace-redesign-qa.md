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

## Source readiness and local browser constraint

Architecture independently reviewed the portable browser test source and approved its explicit fixture boundary and meaningful page-2 sorting/request checks; the production sort/page callback race was corrected by its author and reexamined independently. Backend dashboard aggregation and list-query tests use actual HTTP/auth/PostgreSQL over clearly seeded metric/list fixtures; no new financial-engine or PDF accuracy claim follows from those arrangements.

The principal reports its canonical full `pnpm check` passed **112 unit tests plus 8 harness regressions**, types/lint/format and final web build. QA did not duplicate that heavy build. Browser runner source is syntax/format/lint checked and includes actual Inter FontFace loading, accessible chart figure/text values, explicit pending-write Escape/error retention and a long mobile form's visible action footer, in addition to the earlier groups.

No Chromium/Chrome/Firefox executable was found on PATH or in the known browser cache. As requested by the principal, QA attempted the official `node node_modules/playwright/cli.js install chromium` (no alternate download or privileged bypass). It failed after retries with `End of central directory record signature not found` for the downloaded 0-MiB archive, then exit 1. Log `/tmp/workspace-browser-install.log`. Therefore **no local browser pass, screenshot, measured contrast or focus/mobile result is claimed**. The ready portable runners will execute in CI, where Playwright installation previously worked. Actual service and browser acceptance remain pending their exact source/run results.

## Initial published CI — actual results and retained failure

Published head `480ee1b343e8d7899539eacd7010d3a1c5bd56f3`; Quality run `38951637913`, tested merge `d674f997864e1eb43a6ae9140a95ddb327ae55bd`. QA independently read job metadata and decoded job logs. Quality job `117144204705` passed its full check (**112 unit tests**), infrastructure startup, all migrations, **57 actual HTTP groups** across seven suites (analysis 14, documents 11, claims 5, identity 21, agreements 2, dashboard 2, list-query 2), and API/PostgreSQL/Redis/private-bucket/worker smoke. Its evidence gate failed because this task was not yet verified. This is not a globally green workflow.

Browser job `117144204812` installed Chromium and built the production frontend. Existing agreements acceptance passed **6/6 groups** on the new shell. Workspace acceptance passed its first group (overview, navigation, DTO counts, chart text and actual local Inter font loading), then failed at the page-size selector: `getByLabel('Filas por página', {exact:true})` timed out because the implicit wrapping label includes the option text. QA corrected only that selector to `/^Filas por página/`; the assertions requiring actual limit 50, preserved query and page reset remain intact. Syntax check passed after this test-only correction. The remaining workspace groups have not passed yet and require the corrected run.

Artifact `12068083262` was downloaded and extracted to `/tmp/workspace-initial-artifacts`. It contains only agreements desktop/mobile captures; no workspace screenshots were reached. Those paths were provided to the independent UX reviewer. Initial failure is retained rather than attributed to an application regression or described as a full UI pass.

## Second browser run — bounded synchronization correction

Head `7992ff8de52ab59a0579510f0be3c3b6b15921f4`, Quality `38952140150`, browser job `117145883573`: Chromium installation/build and all six agreements groups passed. Workspace overview **and actual server table request assertions** passed after the label-selector correction. The next group failed its immediate focus-return assertion after the dialog became hidden. The test now waits for the observable required state (`trigger === document.activeElement`) before retaining the identical assertion, permitting Radix's close/focus lifecycle without sleeps or removing the focus requirement; a missing focus return still times out and fails. This is a test synchronization diagnosis, with final runtime confirmation pending.

At the UX reviewer's request, the next runner also captures the desktop overview before navigation and viewport-only mobile panels before closing. It asserts panel origin, width and height match the mobile viewport; these newly added assertions have not yet passed CI. Final publication `27804fb91de14c2fc9bf78848bb58b3be78cc508` contains these test-only corrections/captures; application source is unchanged from the tested initial candidate.

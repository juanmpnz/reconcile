# Workspace redesign — architecture/security/data review

Reviewer: `/root/analysis_architecture`, independent from application/frontend implementation. Owns this planning/review file only. Repository: `/workspace/scratch/56e2916bcd0c/reconcile`, base main `ce08718` prefix. Read AGENTS/workflow, architecture/security/data profiles, README/architecture/plan and current routing, contracts, document/analysis/claim model.

## Prior implementation contract

Dashboard is a real read model, not a new financial rule. Add tenant-scoped GET dashboard with a current verified membership check, viewer read support, non-disclosing foreign/missing resources and private no-store. Counts aggregate the entire authorized organization in a consistent database snapshot; never count only a fetched UI page. Return bounded typed nonnegative integer counts/status groups and generation time, no document contents, secrets or invented savings. Never add monetary amounts across currencies or describe disputed/claimed money as recovered.

Define metric scope before coding: persisted document processing states and open claim statuses can be counted directly; pending operation semantics must be explicit. For findings, latest completed analysis per operation avoids reanalysis duplication but may still be historical. If that metric is retained, its label/DTO must explicitly state latest-completed/historical-inclusive scope and that confirmed means documentary finding status rather than a human decision/payment approval. Do not load full snapshots and recompute every operation fingerprint merely to render a dashboard counter. Coordinator accepted the scoped metric with the explicit text: “Resultados del último análisis completado por operación. Revisá su vigencia al abrir.” Four cards show operation total plus operations without any completed run; documents needing review plus separate failed/blocked incidents; registered documentary findings with any latest human-confirmed count kept separately named; and open claims excluding resolved/rejected. The chart groups current persisted document processing states. No currentness calculation or new financial rule is implied.

Navigation can remember the last organization as a user-keyed hint, never authorization. Revalidate current session and fresh organization context before fetching or showing tenant data; clear invalid/revoked hints and scoped cache on account changes/logout. Preserve explicit operation/document/invitation deep links and do not replace a valid requested path with an eager dashboard redirect. Separate operative navigation from team/account management without inventing additional permissions.

Shared DataTable remains typed by row and column definitions. Explicit capabilities declare server pagination/filter/sort support. For server-backed data, enable manual modes and pass validated bounded query state; unavailable capabilities must not silently become sorting/filtering of one loaded page disguised as organization-wide behavior. Stable row IDs include actual entity identity, queries include user/tenant and all relevant page/filter/sort state, controls reset incompatible pagination and data responses retain total/limit/offset meaning. Do not introduce any/unchecked casts for external DTOs or fetch heavy per-row detail to fill table columns.

SidePanel reuses modal semantics: a visible title/description, focus trap/restore, scroll containment, Escape/outside handling and busy-state protections. Mobile panel fills the viewport with independently scrolling content. Rendering evidence remains escaped text; no new public downloads/HTML/remote-content trust boundary is introduced. Styling tokens/local Inter font do not change backend rules; retain local font license/source attribution and avoid external tracking/font requests.

## Required final review

Inspect actual dashboard aggregation for tenant scope, duplicate historical runs, empty organizations, status semantics and bounded JSON projection rather than full document snapshots. Review typed table modes and navigation cache/authorization boundaries; UX/accessibility expert owns visual/focus/browser acceptance. Actual-service tests should include two tenants, viewer and revoked access, counts beyond a first page, multiple runs for one operation, open/closed claims and no monetary assertions. Browser fixture coverage proves interactions only, not real service correctness.

Planning shared before dependent implementation. Dashboard metric semantics confirmed by coordinator as above. Final independent source review and runtime evidence pending; no approval or execution success claimed yet.

## Incremental source review

Dashboard backend/contracts/route and two real-service test groups independently read. Aggregation is organization-scoped inside RepeatableRead; latest completed result is selected once per operation, latest human decision is resolved by exact run/finding index and monotonic ordinal, and no monetary value is read or summed. Operations without any completed analysis and pending rows whose latest run is incomplete are separate deliberate metrics; UI labels must preserve that distinction. Current document/claim status groups and max5 actionable lists are bounded. The tests explicitly arrange persisted counter fixtures rather than claim financial-engine E2E, and cover56 operations versus a1-row list page, old/new/failed run distinctions, reversed human decisions, document/claim status groups, empty tenant, viewer/foreign/anonymous/revoked access.

WR-A1 high, open during implementation: initial shared DataTable allowed server mode without pagination/sort callbacks to fall back to local state while manual table modes prevented fetching/ordering. Controls could announce an order/page not applied to server data. Require server pagination state/count/callback at the typed API boundary, disable sort without a supported server callback/capability, and avoid multi-column server sorting where endpoints support only one column. Frontend owner notified before closure. No production implementation or acceptance test authored by this reviewer.

## Final independent source review

Passed against the working tree based on `ce087181d84f5162b2026bdf892314631ab18619`. Independent scope: dashboard read model/contracts/route and test source; new operation/agreement global query adapters/contracts/routes/tests; shared typed DataTable boundaries and its consuming server/client tables; organization entry hint, dashboard response validation/query keys and fresh-context rendering. This reviewer authored only this record, not application or tests. UX/visual/accessibility runtime acceptance remains with the other reviewers and browser evidence; no runtime claim is made here.

WR-A1 is resolved: DataTable's discriminated server props require pagination, row count and pagination callback; sorting is enabled only where a supported callback and column capability exist, search only where server search callback exists, and multi-sort is disabled. Server manual modes never locally reorder/filter one page as a global dataset. Members expose only supported native pagination; full-array invitation/organization tables can use client modes. WR-A2 (sort callback plus a second pagination navigation overwriting its URL) is also resolved in examined source: pagination resets separately only for client mode; server callbacks atomically set sort/search and page0. Actual server consumers pass controlled state and allowlisted fields. Generic row/column APIs remain typed; financial string values are displayed without arithmetic.

Dashboard queries authorize current verified members inside RepeatableRead and correlate organization in every aggregation/join. Global counts are not page totals. Latest-completed findings are counted once per operation with explicitly historical-inclusive scope, latest human confirmations are separate, current document/claim statuses drive actual distribution/open counts, and at most5 pending items are returned for each resource. No financial rule, accounting decision or money aggregate changes. UI retains the historical-results warning and distinguishes operations with no completed run from a pending latest run. It does not represent historical documentary findings as current approvals or recovered savings.

Operation search uses bounded validated input and literal wildcard escaping with global Prisma count/page in a consistent transaction. Agreement search projects only reviewed terms fields in a tenant-scoped SQL CTE, applies literal substring matching and static allowlisted order, counts/limits IDs in PostgreSQL, then loads only page DTOs. Both maintain ID tie-breakers and reject unsupported columns/directions; no heavy document pages or per-row operation details are loaded for these lists. Existing mutation/rule paths are unchanged.

Remembered organization is a user-keyed local navigation hint, not a credential or grant. Entry validates it against actual organization membership and a fresh context query; explicit invitation/document/operation links keep precedence. Organization content is hidden while fresh context is pending and revoked context clears scoped cached data/hints. Dashboard response is Zod-validated and rejects a mismatched organization ID; query keys include user and tenant, and logout retains query-client clearing. No new trusted HTML/public file/network boundary is introduced.

Inter400/500/600/700 is imported from pinned local `@fontsource/inter` and served by the build rather than an external font host. The installed package includes Inter Project Authors attribution and SIL Open Font License1.1; no font relicensing claim is made.

Independent test-source review: dashboard2groups cover56 operations versus a1-row list page, latest-completed versus newer failed runs, old duplicate results, reversed human decisions, all document/claim groups, empty tenant and viewer/foreign/anonymous/revocation. List-query2groups cover60 records, provider/date/title search/sort, `%_` literal input, stable pages and tenant rejection. Browser runner explicitly uses synthetic HTTP fixtures and asserts sort frompage2 requests server sort/page0, global OP053 search outside loaded rows, page-size/query continuity, panel dirty/focus/mobile behavior, organization switching/error/viewer states and rendering/contrast checks. These sources are meaningful but do not by themselves establish actual runtime success, full assistive-technology coverage or financial engine correctness.

Reviewed SHA-256:

```text
0152f594fc40b9205e87ca9b7dbd8bb81bf96d191bb0b060e094ee4c1480f621 packages/application/src/dashboard.ts
157c0287eb50465bc40e2f236739edcad3f8209a8bb1b74c9dada3376187e4da packages/contracts/src/dashboard.ts
78deaf613cba81582d6dacb85f89a587badcebc435f06c8279ad61667fac3a5b apps/api/src/dashboard.routes.ts
bf1f021582faf69297a3a1dc890b2fed6568ee8d9030de1c49fb72a7893e89a1 apps/api/test/dashboard.integration.test.ts
b2935a534f193b89bfde5ca8704b346e5d2d34ada2247b7276d080d16e114609 packages/contracts/src/list-query.ts
17c5209be8857f7782e21a3508cc69e1a3c80406acf0f9e1f4130bc2b26aca40 packages/application/src/analysis.ts
5bf94e1e2936d568e4c58053f84c6c7421098000a62f0122a6857ed606f830bc packages/application/src/agreements.ts
a411673a0f5417857112a467160311b5d0f1370f3162788fd650b23d5e564afc apps/api/test/list-query.integration.test.ts
1a38777be132ba11ed417f9a322a6630bd4b1fd0391a14b4970bccbe90c67704 apps/web/src/components/ui/data-table.tsx
3f51933b440374861153bb980550c524112e68c25305d62447796368c416f0c5 apps/web/src/app/workspace-entry.tsx
7f8f77e3eaaa7885d5a24d1a2bfff10b5eba094cf5ab086db23bbdb6bf0c2e01 apps/web/src/app/workspace-context.ts
bb55f4a1348968e2de4fdaf950168be9f418d11f91ebbd524c95494933fc2c76 apps/web/src/features/dashboard/api.ts
2362a6de60020c1818549013ec1249c8044cfaa9fe3a5f52f7488816ebf3fa94 apps/web/src/features/dashboard/dashboard.tsx
cfb78a7469c14761e83df5344bf0ac173e6b405145363da0eb205d935f1066e0 apps/web/src/features/organizations/organization-detail.tsx
9bb9aacd510ba8d33ec13b779704b08931957e1d937ec6808505262f39d1b696 apps/web/test/workspace.browser.mjs
```

Final source status: independent architecture/security/data review passed, no open critical/high findings in examined scope. Review commands were source reads/diff/search/hash inspection; full checks, actual PostgreSQL HTTP execution, browser runtime and deployed-server acceptance must be attributed to their own exact runs. No fake metric, saved-cost guarantee or financial-currentness claim is approved.

## Final bounded platform review and production-container evidence

Role explicitly added: platform-engineer, performed independently by `/root/analysis_architecture` after reading its canonical profile. Scope is the additive browser CI job, pinned dependency/font packaging and actual production-container acceptance; no platform/application code was authored by this reviewer.

The browser job retains existing quality/HTTP/smoke/gate jobs, installs with the frozen lockfile, installs official Playwright Chromium with system dependencies, builds workspace packages and the web bundle, runs declared synthetic-API acceptance scripts against a local preview process, captures screenshots and cleans up that process. It requests only contents:read and runs on an isolated hosted runner, with no production credentials, remote deployment or message delivery. Ten-minute job timing is bounded. Local Inter and TanStack Table versions are pinned in the workspace lockfile; production build uses the existing Docker targets and no secret build arguments were introduced.

WR-P1 medium font-packaging issue was identified and corrected before closure. The installed Inter license was present in node_modules but absent from the distributable web directory; inspection of a built WOFF showed copyright and a license URL rather than the full license text. Coordinator added the exact installed license at `apps/web/public/licenses/Inter-OFL.txt`, allowing normal Vite public-file copying to the web distribution. Independent `cmp` confirms byte-for-byte identity. File SHA-256 `3b0a5fca3d17942cde889069889dedbbbd075e9b599968c82a95f4d944e9b345`. This is a static attribution/packaging correction, not a UI behavior or financial rule change; final build/copied-dist assertion remains coordinator evidence.

Actual production CI independently retrieved through GitHub run/jobs/log tools: run38951638184, job117144205614, conclusion success. Logs show the tested merge `d674f997864e1eb43a6ae9140a95ddb327ae55bd`, successful three-target image builds, migrated startup, production cookie flags, same-origin proxy/private bucket checks, actual PDF larger than1MiB and worker processing, plus PostgreSQL/Redis/S3 persistence after container recreation. The API-only recreation retained nginx and passed, but logs explicitly state the same IP addresses were reused: changed-IP recovery is not claimed. Synthetic SMTP configuration only; no email was delivered.

Independent local git verification confirms source `480ee1b343e8d7899539eacd7010d3a1c5bd56f3` and tested merge both have tree `2a3ffdc70277b5579a10626b94f24aa769dd8208`. Subsequent examined changes before this entry are browser-test/document evidence adjustments and the static license asset; earlier production runtime success is not silently attributed to later files. Current browser QA/runtime evidence belongs to its separate run.

Latest browser test-only correction also inspected: the page-size label uses a matching accessible-label prefix while actual server limit/query assertions remain intact; focus return waits for observable Radix lifecycle completion then keeps the same active-trigger assertion (a persistent defect still times out). Mobile assertions were strengthened to full viewport bounds, with screenshots added. No production control was weakened to make these tests pass.

Additional reviewed hashes: CI workflow `9b433cc98d0b30f168160efdf547a08d2a99751ed7ab9a4f73bb797db56e4a2b`; web package manifest `3c67cb8d222c7740ac26e26f446ec58872a418554bac2dcf0c9cbeff880a2121`; lockfile `363125d299238a8cd9387ebcdf7741226da0d603e814c5ee8342c8b0fae5f2ac`.

Platform source review passed with WR-P1 resolved. The independently retrieved production-container acceptance passed for its exact source/tree. This does not certify the user's Coolify deployment, real TLS/browser authentication, real SMTP delivery, offsite backup restoration, confidentiality rollout or later browser-only changes.

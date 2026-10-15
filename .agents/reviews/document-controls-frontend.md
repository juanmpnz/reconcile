# Document controls frontend self-review

Date: 2026-10-15. Agent: `/root/analysis_frontend`, frontend-engineer/ui-engineer. Mode: sequential implementation self-review, not independent. Applied AGENTS/workflow, frontend/UI/accessibility profiles and the pre-implementation `docs/design/operation-document-controls.md` blueprint. Backend owns the shared document contracts and authorization.

## Scope and final behavior

- `apps/web/src/features/operations/operation-detail.tsx` groups secondary edit, ghost Recargar datos and primary analysis actions in one compact wrapping header. Existing analysis disable conditions have a visible explanation and a focusable wrapper with aria-describedby plus a complementary native title. Viewer retains the permission explanation without mutation controls. No extra financial blocking rule was introduced.
- `apps/web/src/features/documents/api.ts` uses shared metadata/query schemas, schema-validates new responses with safe errors, checks organization/document attribution and sends PATCH with the captured metadata version and required reason. Global search/sort/pagination parameters are transported to the server; existing callers can retain default options.
- `document-list.tsx`, `list-state.ts` and `operation-links.tsx` use server-global results rather than filtering the loaded page. URL state preserves query/sort/direction when paging and resets page for changed search/order. Column sort controls expose visible direction and aria-sort. Search scope is explicit; no-results differs from no-documents. Extracted reference and real operation links are distinct columns. Relationship lists state the server's bounded count when partial and never imply a missing extraction reference means no association.
- `metadata-dialog.tsx` exposes bounded filename/type/reason fields from authorized table rows and detail. It preserves drafts after errors, obtains current metadata after conflicts and requires explicit comparison/rebase before retry. A failed reload keeps conflict saving blocked. Cancel uses the existing Radix focus-return behavior; successful changes invalidate document, operation and review caches. Success notification occurs before invalidation so removing a renamed row from the search result does not silently discard the feedback callback.
- `document-detail.tsx` shows actual linked operations, the extracted reference separately, metadata edit access and the bounded before/after name/type history with reason/date. Historical analysis snapshots are not rewritten. User copy explains that original PDF/text are unchanged and type changes require review/reanalysis; no automatic re-extraction is promised.
- Appended styles in `apps/web/src/styles.css` keep header groups and search controls wrapping on narrow screens, preserve internal table overflow and provide mobile-size sort targets. No dependency, commit, schema or non-frontend code change was made by this agent.

## Checks actually run

- `pnpm exec vitest run apps/web/src/features/documents/api.test.ts apps/web/src/features/documents/list-state.test.ts`: **7 passed** (5 boundary/API cases and 2 URL-state cases). Added tests verify global query/order/offset transport, wrong-tenant metadata-response rejection and query/sort preservation/reset without arbitrary sort forwarding. Existing API fixtures were updated for required metadata and association fields without weakening response schemas.
- `pnpm --filter @reconcile/web typecheck`: **passed** after correcting a DOM document name shadow inside a table loop callback.
- `pnpm exec eslint apps/web/src/features/documents apps/web/src/features/operations/operation-detail.tsx`: **passed**.
- Prettier ran on the affected frontend files. The final bounded wording/search-focus/notification changes were formatted after that local check group; canonical QA is responsible for the exact final repository build/type/lint evidence.

## Independent review and limits

`/root/analysis_ux` reviewed the initial source independently and reported no blocker; its low-priority technical wording finding was corrected. Independent browser testing is owned by that agent and was requested against the final stable build with the required new DTO fields. This self-review does not claim that browser verification, real HTTP acceptance or final CI passed. No pixel fidelity, full assistive-technology certification, immutable PDF modification, arbitrary global operation-list API change or metadata-only financial validation is claimed.

Status: frontend stable for canonical QA/build and independent browser. No further source edits are planned unless reviewers identify an actual blocking defect.

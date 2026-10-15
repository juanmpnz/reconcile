# Document foundation — frontend implementation evidence

Date: 2026-10-15. Execution: /root/identity_frontend. Roles: frontend-engineer and ui-engineer. This is implementation/self-review, not independent approval. UX/visual/accessibility blueprint consulted first: docs/design/document-workspace.md and existing identity-interface.md. AGENTS/workflow and relevant specialist profiles read.

## Implemented scope

apps/web: reusable neutral Spinner/Loading with real text, optional initial skeleton rows, pending Button and reduced-motion CSS. Identity initial session/organization/member/invitation loading and main pending buttons reuse these components; background queries keep currently authorized rows. Loading status is outside aria-busy skeleton decoration so announcements are not deferred until unmount.

Organization documents section and deep document routes retain user/org scoped keys, URL paging and browser navigation. Shared @reconcile/contracts schemas validate list/detail/upload; document responses must match requested organization/document. Context requires server canWriteDocuments with no role inference fallback. Context rechecks hide protected document regions and suspend portal dialogs; data queries pause, controlled input/file/kind state survives successful revalidation. Denied context unmounts content; tenant change keys reset state.

Raw PDF upload follows actual API (application/pdf body, encoded filename and kind headers, 10MiB advisory limit). Accessible modal supports keyboard selection/removal/type/cancel, preserves failure data, prevents duplicate upload. Confirmed upload selects returned document only if request owner remains mounted; duplicated bytes select server-existing document rather than fabricating a new row.

Document list uses real server limit/offset/total and only searches returned current-page rows (clearly labeled). Processing rows poll; detail polls queued/processing state. Original downloads through authorized same-origin endpoint, creates no public S3 URL and does not trigger delayed download after component leaves. Detail shows six extracted source fields, evidence page/snippet and escaped original text per page, useful Spanish warning/error explanations and explicit extraction-vs-financial-validation boundary. No OCR/AI/universal extraction claim; browser visual PDF preview is not claimed.

Corrections use actual API and immutable extraction-run ID, value or null and mandatory reason. Latest correction consumes canonical ordered array last item; original extracted value/evidence remain displayed. History is real returned corrections. Errors preserve edits and offer document refresh. Retry only failed/blocked with current canWrite. No comparison/claim/payment controls.

## Source findings addressed

- Independent UX live-region busy suppression and empty-page invalid range fixed.
- Replaced temporary role fallback with required server document capability.
- Translated raw warning/error codes and removed extractor-engine implementation detail from product flow.
- Resumed upload fileinput uses required={!file} plus explicit !file submit guard so retained File remains usable after portal suspension.
- User/org/document response boundaries tested; all text is React-escaped, no arbitrary remote URLs/HTML injected.

## Validation run

- node_modules/.bin/eslint apps/web --max-warnings 0: passed on current candidate.
- node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit: passed on current candidate.
- node_modules/.bin/vitest run apps/web/src/features/documents/api.test.ts apps/web/src/features/organizations/queries.test.ts: 6 tests passed (3 document cross-tenant response boundaries plus 3 identity response tests).

Root owns aggregate build/check and real service integration runs. Independent UI/QA owns browser desktop/mobile, reduced-motion, permission/suspension/loader state interactions and actual service upload/extraction/correction verification. These are not established by frontend unit/compile checks. docs/user-guide.md was read and matches current labels and limitations.

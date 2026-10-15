# Independent document browser QA

Reviewer: `/root/documents_browser_qa`, independent execution; roles QA Engineer and accessibility reviewer. Date: 2026-10-15. Read AGENTS.md, .agents/WORKFLOW.md, .agents/roles/qa-engineer.md, .agents/roles/accessibility-reviewer.md, docs/design/document-workspace.md and affected frontend components/contracts. Production code was not authored or edited by this reviewer.

Status: passed, scoped to UI fixtures. Actual Chromium 153 headless and Playwright 1.62.1 ran against the actual Vite/React application. Requests were intercepted with synthetic contract-shaped responses; these are not real authentication, storage, PDF extraction or worker E2E results.

Command from repository root: `node /tmp/reconcile-document-qa/run-ui.mjs`. Final full run: **12/12 groups passed**, exit 0. Additional screenshot capture `node /tmp/reconcile-document-qa/capture-upload.mjs`: mobile 390/320 and zoom group passed. Driver and results are transient local QA evidence; final full results `/tmp/reconcile-document-qa/results/full-results.json`.

Covered:

- Session loading text and decorative spinner; document initial loading skeleton, exposed `role=group` with `aria-busy=true`, skeleton `aria-hidden=true`, no premature empty state; failed request and successful retry.
- Document table search/no matches/clear; full desktop screenshot.
- Keyboard dialog opening, eight Tab steps remain trapped; upload pending disables submit and prevents Escape dismissal; form busy; server error focused and file/type retained; retry succeeds and opens actual returned document route.
- Permission refresh while a file and quotation type are selected: portal suspends, protected document region is hidden, dialog resumes with file/type intact and can successfully submit.
- Detail displays original page text as text, including literal script-shaped content; page evidence and original value remain; original-download failure is visible; correction pending, conflict error preserving edits, successful correction and history; source 212.00 remains distinct from corrected 150.00.
- Viewer has no upload or correction actions.
- Queued and processing statuses, failed PDF state and successful retry-to-queue feedback.
- Background document polling keeps existing rows visible and does not replace them with skeletons.
- 390px and 320px list/upload/detail have no document-level horizontal overflow; tables scroll internally. Dialog Escape restores trigger focus. Desktop detail at CSS 200% zoom has no page overflow.
- Reduced-motion spinner computes `animation-name: none`.
- Delayed former-organization list response cannot populate the next organization's document table.

Finding BROWSER-01 (medium, resolved): pending state originally exposed `aria-busy` only on an aria-hidden skeleton. Frontend implementer added a separate exposed busy group while keeping the live status outside it. Final browser rerun asserts the exposed group's busy state and hidden decoration. No open high/critical findings.

Earlier driver failures were corrected test assumptions: StrictMode consumes an aborted fixture request, so the error fixture now remains failing until retry; selected-file exact text included nested size text, so retention is checked against the selected-file region and type value. Those failures did not require production fixes.

Screenshots: `/tmp/reconcile-document-qa/results/desktop-documents.png`, `desktop-document-detail.png`, `mobile390-documents.png`, `mobile320-documents.png`, `mobile390-detail.png`, `mobile320-detail.png`, `mobile390-upload.png`, `mobile320-upload.png`. Reviewer visually inspected desktop detail and 320px upload: monochrome compact layout, wrapping filename, usable dialog fields/actions, no clipping.

Examined final source SHA-256:

- `apps/web/src/components/ui/loading.tsx`: `f90b4f9cfce15c7a35c7b98e5c6aa52fef3fab6adf91b1c1b4576cbccbf9ac27`
- `apps/web/src/features/documents/correction-dialog.tsx`: `b4db45e40ceee9f48130d27fb2abe815b22bc9155be7b5ec31a7379cb4e7499c`
- `apps/web/src/features/documents/document-detail.tsx`: `602efa2408b0ad96134f86ca9cd11fe01cd85051f8b306cb832b0d51b463fe0a`
- `apps/web/src/features/documents/document-list.tsx`: `46e4f70e437abc1fab922cd32f60ad484ae69d8ea2d50a02980580eef85c04cb`
- `apps/web/src/features/documents/upload-dialog.tsx`: `63bf34b3fdab91996849d5224e1dc75ecebcedc66d45f5292566a27d6c428e26`
- `apps/web/src/features/organizations/organization-detail.tsx`: `5c4073d24fbc8a61585b9ddc7b3197af26d331445a2f4ea371c97e003f425838`

Limits: no screen-reader session, normative accessibility certification, Figma pixel-fidelity claim or real-auth browser E2E. Server authorization, durable outbox/idempotency, private storage/download, PDF extraction and multi-tenant HTTP integration belong to the separate service integration suite. This review does not extrapolate browser fixtures to those guarantees.

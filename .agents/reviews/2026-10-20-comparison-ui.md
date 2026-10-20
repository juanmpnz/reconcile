# Contract/invoice comparison UI — 2026-10-20

Execution `/root/commercial_ui`; UX/visual planning then frontend/UI implementation, with sequential accessibility source inspection. This is not independent approval of its own changes. Independent review is assigned separately by the coordinator.

Read AGENTS.md, WORKFLOW/manifest, UX, visual, frontend, UI and accessibility profiles, existing implementation/product/architecture documents and task planning. Before implementation sent the coordinator the ordered source → invoice → review → compare decision and atomic-attach dependency; coordinator accepted it.

## Implemented scope

- `operation-detail.tsx`: visible reference and invoice document groups, direct scoped PDF upload and assignment from existing files, extraction-status polling and refreshed comparison facts. Linked reference documents are proposed sources; the UI explicitly separates linkage from applicability. Fact review precedes results. Source documents remain separate from invoice economic rows.
- New comparison-candidate DS DataTable shows source/invoice concepts, each unit-price currency, equal/different/unknown price state separately from pending/difference/correct applicability outcome, comparable amounts and reasons. Expanded details preserve original invoice tariff price/currency, recorded billed amount, invoice-observed quantity (not proof of performed service), conditions and evidence. Proposals expose no financial review or claim action.
- `operation-agreements.tsx`: optional registration/selection/spot tools move under a collapsed DS accordion. Existing selection and audited binding flow remain available, along with management of supporting documents. No mandatory second publication step is presented for an attached reference.
- `upload-dialog.tsx`: configurable existing DS upload label and document-kind scope; awaited association callback. An uploaded PDF ID survives association failure, permitting retry without another upload. Kind is validated from controlled state, so disabled controls do not break retry. Closing after failure leaves the existing file available for later association.
- `link-dialog.tsx`: scoped existing-document choices preserve associations outside the current role filter; existing conflict recovery remains intact.
- Source pricing cadence/behavior is shown only when explicitly extracted; no monthly/annual schedule is inferred. Failed/blocked analysis exposes its recorded reason plus a document-review action.

## Verification

- Targeted Prettier write: passed.
- `pnpm --filter @reconcile/web typecheck`: passed after the additive result and attach contracts were built.
- Targeted ESLint across all five changed UI/browser files: passed.
- Extended `apps/web/test/agreements.browser.mjs`: direct upload → association conflict → retry, one-upload assertion, preserved links; collapsed optional advanced tools; equal-price-but-pending candidate, absent source, original versus billed currency, no candidate claim controls. Existing selection, spot, conflict, immutable-history, mobile, keyboard, viewer and source-evidence assertions are retained with updated navigation labels.
- Browser execution: **not run** locally. Playwright launch failed because Chromium is absent. `pnpm exec playwright install chromium` failed downloading a truncated/empty browser archive from the CDN. No dependency or CI configuration was changed to conceal this. Actual browser, mobile layout, keyboard/focus and screen-reader behavior require CI/independent execution.

No private source documents, source-derived identities/rates, or screenshots were added. Synthetic browser fixtures prove UI transport/presentation only, not backend authorization or extraction accuracy.

Status: implemented and static checks passed; pending independent review and browser execution. No commit, push or deploy performed by this execution.

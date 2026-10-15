# Phase 4 — independent UI browser acceptance

Reviewer: `/root/analysis_product_domain`; roles product-manager/logistics-domain for prior acceptance and qa-engineer/accessibility-reviewer for browser work. Independent of production UI implementation by `/root/analysis_frontend`: this reviewer did not author or edit production UI, backend or engine code in this phase. Earlier financial-engine authorship is disclosed; this report does not independently certify financial rules. Read AGENTS/workflow, relevant profiles, docs/product/reviewed-claims.md and the claims UX blueprint.

## Read findings and corrections

- RC-UI1, medium: clarification eligibility returned before validating invoice source, offering claims for a missing invoice or an operational/agreement document. Frontend moved the invoice guard before all eligibility branches. Browser negative scenarios with noninvoice and null source now pass.
- RC-UI2, low: one-claim-per-invoice limit was not explained. Visible copy now states that the MVP reuses one claim per invoice, from one finding without summing controls. Browser verifies a second finding opens the existing claim without another create request.
- RC-UI3, medium: resolving defaulted the result to withdrawn. Frontend now resets to an empty required choice and disables save/submission until explicit selection. The final browser run checks empty choice, disabled save, explicit corrected selection and resulting manual resolution. Rejection is independently mapped to rejected by frontend; actual server transition validation is separate.
- Clipboard copying is local presentation of readable saved text; architecture explicitly distinguished it from authorized/versioned export. It never marks exported or sent. Formal TXT/JSON exports remain server operations.

## Execution and evidence

Command: `node /tmp/reconcile-claims-qa/run-ui.mjs`, from repository root. Actual React production build served by Vite preview, Chromium 153 and Playwright 1.62.1. Final assets supplied by QA after aggregate checks plus the explicit-resolution-button delta: `index-DwBAVmrC.js`, `index-CXNIMy76.css`; no parallel rebuild by this reviewer.

**13/13 browser groups passed, exit 0.** Definitive structured results: `/tmp/reconcile-claims-qa/results/results.json`, thirteen passed=true records. HTTP responses are explicitly declared synthetic fixtures, not real financial/API/authentication E2E. They verify actual rendered behavior, request shape, labels and recovery; real persistence, permissions, dates, decision identity and export immutability belong to the other agent's integration tests/CI.

1. No automatic claim before explicit review. Required reason, pending state, conflict retention and explicit refresh/retry preserve the draft; requests identify run/finding and source fingerprint without supplying amount. Confirming does not make the analysis stale in this fixture contract.
2. Confirmed selected pickup displays server-supplied 62 USD. Claim creation carries only run/index/version/fingerprint, not client-calculated money. Recipient starts absent.
3. Clarification displays no requested amount; arithmetic control cannot prepare a demand or add a second amount.
4. Accept/dismiss append decision history and remove claim preparation. Prior confirmation and its reason remain visible.
5. Draft edit begins with empty recipient, preserves text/reason on conflict, requires explicit comparison/retry and creates a version without replacing the original draft.
6. TXT and JSON buttons trigger the authorized export endpoint and actual browser downloads. State remains Exportado · no enviado; no sent event occurs.
7. A stale claim blocks emission. Explicit update with reason reuses the same claim ID, adds a draft version and restores the current source. The fixture uses the same run/fingerprint with stale=true, also exercising recovery when backend staleness comes from changed confirmation identity. It does not prove the backend computes that identity correctly.
8. Manual sending requires a saved recipient plus explicit checkbox. Default current date/ISO is used; a hardcoded future date in an initial driver attempt was correctly rejected by native validation and removed from the driver. Response under review remains open; follow-up date and note are visible.
9. Viewer reads the claim/review but has no edit, event or new-export controls.
10. Multiple findings for the same invoice reuse its existing claim; no extra create request or aggregated demand.
11. Noninvoice and operation-only uncertainty offer no claim even after a confirmation fixture.
12. Sent draft remains read-only, new emission is disabled, and resolving requires explicitly selecting an outcome. Resolution does not alter the questioned amount or imply recovered money.
13. 320/390px and CSS zoom 200% have no body horizontal overflow; table overflow stays internal. Edit dialog traps keyboard focus, closes safely on Escape and returns focus. Reduced-motion animation behavior was not rechecked in this phase; existing loader verification is separate despite the scratch group's inherited name.

## Visual checks and boundaries

Examined `desktop-claim-draft.png`, `mobile320-claim.png` and `mobile320-draft-dialog.png` in `/tmp/reconcile-claims-qa/results/`. Additional captures include 390px variants and desktop-followup.png. Amount/type, absent recipient, private-original/JSON limitation copy, export versus send distinction and mobile form remain legible. No public PDF URLs or invented recipient appear in these fixtures. Browser captured a horizontally scrolled comparison-table region after focusing the last column; body overflow checks pass.

No critical/high UI finding remains open within this tested scope. No accessibility certification, complete screen-reader coverage, deployed-server readiness, actual SMTP delivery or independent financial-engine validation is claimed. Retained historical-export bytes and server-side decision/source staleness require the separate real-service suite; these fixtures do not certify them.

## Tested source SHA-256

Worktree based on `124b2b1caa84d968e98a3c34625c4ed26a0389f9`; phase-4 source changes were not yet published when tested.

```text
a00ad249a4a4add181f3fb738ec05dadff265abea16551efcb353b17cec5e776 apps/web/src/features/claims/api.ts
382eefef52b28765dc25664726960ec2d3d5fdc3a31a6b70f50091832cdee92b apps/web/src/features/claims/presentation.ts
873d6e4640581331e66f8e80fcfa0a97b20884e3824b97237e480cd9306434df apps/web/src/features/claims/review-workspace.tsx
59635dc3019e9b52a15a87b28c06c4a7ea90894cb7faeb7f9d95c6189878c687 apps/web/src/features/claims/rebase-dialog.tsx
965be0b89ca40d1dda576e1b5e644728f624615ce0428e105985e99f86446b90 apps/web/src/features/claims/claim-detail.tsx
fb049d374e0b6adce18ca64ab9523e74722b6e609c715e6358f743057022b946 apps/web/src/features/operations/operation-detail.tsx
9419b0c12ff1be0d6104a97b40de5a93c6200c6f81a9fb603bfc880447cb59b6 apps/web/src/styles.css
a6ac02747b925a51de8b5cf34e6c19597b30a8cf56ba456008ce5a92ee6aa84c packages/contracts/src/claims.ts
```

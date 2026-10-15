# Operation usability — independent browser QA

Reviewer: `/root/analysis_product_domain`, roles qa-engineer and accessibility-reviewer. Independent of `/root/analysis_frontend`: this reviewer did not implement or modify frontend production code. Earlier financial-engine authorship by this reviewer is disclosed; this report does not independently certify that engine. Read AGENTS/workflow, QA/accessibility profiles and docs/design/operation-usability.md before testing.

## Executed scope and limits

Ran `node /tmp/reconcile-usability-qa/run-ui.mjs` from the repository root against the production `apps/web/dist` supplied after QA's full check, without a parallel rebuild. Vite preview, Chromium 153 and Playwright 1.62.1 render actual React/CSS. HTTP responses are explicit synthetic UI fixtures. This is browser behavior evidence, separate from real HTTP/PostgreSQL/storage/queue validation by analysis_qa and CI; it does not prove backend security or financial accuracy.

Result: **10/10 groups passed, exit 0**. Definitive structured results: `/tmp/reconcile-usability-qa/results/results.json`. Subsequent targeted viewport-capture checks passed and write results-targeted.json without replacing the full result set. No page JavaScript exceptions observed. Intentional HTTP 409 responses exercise recovery.

1. Edit reference `test` to `OP-DEMO-062`: pending state blocks Escape; 409 retains name/reference draft, focuses error, shows current server values and disables save until explicit review/retry. Save preserves extracted facts and old run snapshot while marking it stale.
2. Viewer cannot edit, manage documents, review facts or analyze; active run disables operation editing.
3. Edit dialog traps keyboard focus, restores focus on Escape, and retains draft across fresh authorization suspension/resumption.
4. Reference preflight shows expected reference and found document reference separately; absent reference says Sin referencia identificada. Review action opens the facts accordion. No silent source rewrite. Mismatch is advisory and produces nonverifiable engine results, consistent with existing policy; it is not presented as a server execution block.
5. Latest analysis precedes support panels. Three native support accordions start closed and operate with Enter. Counts describe controls rather than recovered money.
6. Four status counts remain faithful to fixture findings, include text and decorative icons, and avoid financial-approval language. Actual computed foreground/background contrast ratios: red 6.05, amber 6.84, green 5.40; all exceed 4.5:1 for the tested text.
7. Exact duplicate citation removed; distinct page, extraction version and correction revision retained. Six source entries become five unique citations. Initial two summaries and Ver 3 evidencias más expose all five; each full literal fragment and original link remains available.
8. Unlink removes association only, sends optimistic fingerprint, preserves original document fixture and historical snapshot/result, displays stale warning.
9. Metadata edit marks earlier result stale; explicit Volver a analizar creates a queued run, disables editing, and retains historical snapshot.
10. At 320/390px and CSS zoom 200%, no body horizontal overflow; table scroll remains internal; edit dialog fits viewport. Result statuses and accordion summaries wrap legibly.

## Visual inspection

Examined actual screenshots in `/tmp/reconcile-usability-qa/results/`: desktop-compact-result.png, desktop-edit-conflict.png, desktop-evidence-expanded.png, mobile320-result.png, mobile320-result-controls.png and mobile320-edit.png. Additional captures include 390px variants and desktop-preflight.png. Compact result-first layout, status colors, complete expandable evidence, current-versus-draft conflict copy and mobile controls are legible. Viewport screenshots avoid Chromium full-page sticky offset artifacts.

No critical/high UI findings remain open in this examined scope. No pixel-perfect Figma, screen-reader certification, deployed-server or real-auth financial E2E claim is made.

## Tested source fingerprint

Production assets: `index-DTf3doRQ.css`, `index-f4qJtmNB.js`. Worktree based on `3eddfea099bdae07eeffa7d8206416ff324ca2d1`, usability source not yet published when tested. SHA-256:

```text
0244a5e7005acefbcd0d1d96bb4de96d28117e836b893e92595a882af9129413 apps/web/src/features/operations/api.ts
08d4d01fd90496fcf9a28adcc7a05e6af0e6cb081b5671b6147cb6695efb6902 apps/web/src/features/operations/edit-dialog.tsx
388d9a308044af6989c347c7ad5db5be01f89d2e494e4ec7c90efb6a41df3861 apps/web/src/features/operations/link-dialog.tsx
2bb1046aaf72f2d12e7d5456b53b21ae30bac98f26862cb6b90b0d2752828737 apps/web/src/features/operations/operation-detail.tsx
5674077ea0ebadc787797b5f801316319c0850b578e9e234ab4d6881cb3408a2 apps/web/src/features/operations/evidence.tsx
ce738f0ff38e5544ce7e920b6dd2f0c458b6130ff5aeb1e49d5549b0e1509c56 apps/web/src/features/operations/presentation.ts
e4263f4cee5767bc1c5c082d8493f42e05472acdb0fbfd9442de5d6808a6e005 apps/web/src/styles.css
a032e2757b1e6ebe761ead7369f6f34a06535033f4e87207442be930294549bf packages/contracts/src/analysis.ts
```

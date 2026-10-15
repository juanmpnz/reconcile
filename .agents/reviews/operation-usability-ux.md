# Operation usability — independent UX review

Date: 2026-10-15. Reviewer: /root/analysis_ux. Roles: product-manager, logistics-domain, ux-designer, visual-designer, ui-engineer and accessibility-reviewer. Mode: independent of production implementation by /root/analysis_frontend and backend implementer. This agent wrote docs/design/operation-usability.md before dependent UI implementation and reviewed production source without editing TSX/CSS.

## Scope and evidence

Read applicable profiles, AGENTS.md, workflow, existing pilot requirements and analysis blueprint. Examined operation-detail.tsx, edit-dialog.tsx, link-dialog.tsx, evidence.tsx, presentation.ts, api.ts and affected CSS using cat/sed/rg, including fixes communicated to the frontend implementer. Source scope includes current working-tree changes after their targeted type/lint checks; this review does not substitute for browser or actual API execution. QA records provide their own exact runtime attribution.

## Findings

- UX-B1 medium, resolved by source reinspection: preflight repeated the expected reference and explanatory text for each document, obscuring the concise result flow. It now displays the expected reference once, a compact filename/found-reference table and one access-appropriate action. Missing reference remains explicitly Sin referencia identificada. The reference check is advisory, consistent with existing backend behavior; mismatches are not silently rewritten or represented as an execution block.
- UX-B2 medium, resolved by source reinspection: summary claimed to count partidas while its reducer counts findings, including several checks on the same line and total arithmetic. Visible and accessible summary now says Controles del análisis. The count remains faithful to findings without misleading deduplication or amount aggregation.
- UX-B3 low, resolved by source reinspection: preflight anchor opened source facts without moving keyboard focus into that section. It now opens the containing native details and focuses its tabIndex=-1 heading. Browser focus verification is attributed to QA.
- UX-B4 low, resolved by source reinspection: remainder evidence disclosure said Ver todas despite containing only the remaining citations after the first two. It now says Ver N evidencias más with the actual remainder count. Exact evidence deduplication retains extraction and correction version identity, document, page and literal snippet, preserving distinct source versions.

## Source review result

Passed; no open high/critical or medium findings within reviewed UI scope. Computed result appears before expandable support documents, facts and history, with important source/preflight warnings outside closed panels. Red evidence-backed difference, green matching-price-only and amber probable/non-verifiable states combine explicit text and decorative icon. Scope does not imply payment, invoice approval or claim sending. Suggested foreground/background pairs are dark text on light surfaces; runtime visual evidence must confirm actual computed presentation. No universal accessibility certification is claimed.

Evidence is grouped by document, duplicate exact citations removed and full literal snippets remain accessible in keyboard-operable disclosures. First citations expose compact document/page summaries rather than huge initial text blocks; additional citations remain accessible. Arithmetic checks have a separate table from service/agreement checks. Observed missing-route copy uses the actual snapshot field and only the applicable agreement-missing scenario, preserving original engine explanation rather than inventing requirements.

Edit dialog records the source fingerprint on opening, preserves entered draft on conflict, refreshes current server values and requires explicit comparison/rebase before retry. It explains that editing operation reference does not rewrite extracted documents. Document management explicitly distinguishes association removal from deleting originals/extractions/historical analysis, retains selection across pagination and uses analogous conflict recovery. Writer actions are absent for viewer; active runs prevent conflicting operation/document mutations. Existing source-fact correction, required reason and history remain available separately from computed findings.

## Limits and follow-up evidence

This record is source review and pre-implementation planning evidence. Actual PATCH authorization, concurrency/fingerprint guarantees and unchanged original downloads require backend/QA evidence. Browser QA must verify 320/390px, zoom, dialog focus/return, status colors/text, accordion recovery, explicit conflict rebase and evidence disclosure. No production UI files were edited by this reviewer, and no independent approval is attributed to implementation self-checks.

References: docs/design/operation-usability.md; .agents/reviews/operation-usability-backend.md; .agents/reviews/operation-usability-architecture.md; .agents/reviews/operation-usability-qa.md. Coordinator records final CI/SHA; do not extrapolate a prior runtime result to later source edits.

## Subsequent visual inspection

Independently opened desktop-compact-result.png, mobile320-result-controls.png and desktop-preflight.png from /tmp/reconcile-usability-qa/results after the final usability browser run. Result-first hierarchy and compact support accordions are clear; color indicators retain explicit text/icons. The 320px view keeps controls and panels within the viewport while the wide result table scrolls inside its own region. Preflight shows expected reference once and document/found-reference rows without repeated paragraphs. These screenshots are synthetic UI fixtures, not live service evidence. The executing agent /root/analysis_product_domain reports 10/10 passing groups and measured contrast red 6.05, amber 6.84, green 5.40; exact checks and source fingerprints belong to .agents/reviews/operation-usability-browser.md. This reviewer inspected the images but did not execute that browser suite.

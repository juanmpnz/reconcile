# Workspace redesign — product/logistics preflight

Date: 2026-10-16. Agent: `/root/analysis_product_domain`; roles product-manager/logistics-domain. Planning before dependent implementation, no production code. Read AGENTS/workflow, profiles, implementation status, pilot requirements/plan and current analysis/claim contracts. Prior product/domain participation is disclosed; no independent financial validation is claimed.

## Navigation and scope

One selected organization owns the whole workspace. Sidebar: Resumen; Operativa with Operaciones, Documentos and Acuerdos/Tarifas as actual routes/tabs; Equipo with Integrantes and Invitaciones. Keep organization switching, personal identity and logout usable without repeating the organization name/description above every table. Selected section and breadcrumbs identify the current context; detail routes retain operation/document identity. The team section never borrows business permissions, and a viewer keeps real read-only behavior.

Correction after inspecting the actual base PR13 feature: **Tarifas y acuerdos is the existing immutable agreement library**, not a filtered document view. It preserves reusable versus operation-specific spot agreements, source PDF/extraction evidence, explicit commercial terms, and per-invoice selection. A replacement is another immutable record; selecting a document classification alone does not create or accept an agreement. The redesign must keep this real library and its reviewed selection flow, not reduce it to document filtering. Acceptance, validity and scope remain explicit in those agreement records. Extracted operation references and explicit operation links stay distinct. No financial rules, demo documents or record semantics change for the visual redesign.

## Four real dashboard cards

All aggregates are authorized server-side for the current organization across all pages. Zero is a genuine result; loading/failure never flashes a fabricated zero. Each card names its unit and scope; numbers are counts, not money.

1. **Operaciones**: total persisted operations, with a separately labeled subcount **sin análisis completado** (no completed run exists). A bounded pending-work list may additionally include operations whose latest run is queued/processing/failed/blocked; do not imply this list has the same definition as the no-completed-run subcount. Neither definition proves current source validity or globally recomputes fingerprints.
2. **Documentos por revisar**: needs_review count, plus a separately labeled **incidencias de extracción** count for failed/blocked. Do not combine the categories under an error label: the normal extractor deliberately returns human-review-required for otherwise successful documents. If the main card includes both categories in one total, it must say **requieren atención** and preserve the review-versus-error breakdown; never claim all are failed.
3. **Diferencias detectadas / confirmaciones registradas**: counts of controls in the latest completed analysis per operation. Detected means engine outcomes confirmed/probable; human confirmed is the latest review action confirm among those detected controls, never the engine enum confirmed by itself. Label controls, not invoices/charges/money: arithmetic/service flags may overlap. Unknown/not-verifiable controls are separate uncertainty, not confirmed debt. Repeated historical runs never multiply totals. If the implementation does not globally recompute current fingerprints, explicitly label these as documented in the last completed analysis, potentially needing reanalysis; do not claim present validity.
4. **Reclamos abiertos**: persisted claims excluding resolved/rejected, without multiplying draft versions, exports or follow-up events. Draft/exported/sent/in_review/follow_up are open workflow states; exported never means sent and resolved never proves recovered money.

The third card may display detected as its principal count and operator confirmations as a clearly labeled secondary count. Do not silently replace one with the other or include confirmed uncertainty outside the detected denominator.

## Real chart and dates/currencies

Principal selected **document status distribution**, not an activity time series. Count all organization documents by their actual persisted states, including genuine zero categories, and show the same labels used in lists. The distribution must reconcile to the total number of organization documents. Display a captured/as-of UTC timestamp and say the dashboard covers organization records without a date-range filter. Latest completed analysis counts describe their recorded snapshots and may require reanalysis; document/claim states describe current persisted records. No invented trend, prior-period comparison or seven-day implication.

No sum of questioned amounts, savings, recovered cash or currency conversion in this scope. Counts may cover documents in multiple currencies because they count records/controls; they do not aggregate financial value. If a future financial chart is added, separate currencies and non-overlapping claim identities using decimal amounts, with explicit period and validity—outside this redesign.

## Acceptance and negatives

- Populate two organizations with different operation/document/review/claim counts; every aggregate, pending row and chart point changes with the selected organization and never leaks another tenant.
- A queued or failed run appears as pending; latest-completed historical controls remain described as historical observations, not current approval. Reanalysis replaces the per-operation aggregate source rather than adding another historical run.
- Engine confirmed without a human decision increments detected only. Latest dismiss/accept removes that operator confirmation; confirming a not-verifiable clarification does not become detected monetary debt.
- Normal needs_review PDF is review work, not extraction failure. Failed/blocked/unsupported cases have their literal reasons/status and direct links to the affected document.
- Open claim count remains one through edit/export/rebase/follow-up versions and drops on resolved/rejected. No metric claims financial recovery.
- Empty state offers real actions/links, error offers retry, counts/chart have accessible labels or a numeric equivalent, and loading remains local and readable.
- Lists of outstanding work state a real bound/total (for example latest ten), not apparent completeness. Chart distribution reconciles with actual organization totals and the as-of UTC instant; mixed-currency records never produce one misleading monetary total.
- Existing compact tables, source evidence, review/corrections and team operations remain reachable. Changing sidebar/tab does not change data, bypass current permissions or create records.

## Principal-approved scope and verification

Principal explicitly approved the conservative SQL scope before dependent implementation: total operations with no-completed-run subcount; document review and failure categories distinguished; registered differences from each operation's latest completed persisted analysis, plus actual latest human confirmations when supported; open claims; current document-status distribution. No heavy global fingerprint recomputation or current-validity claim. The panel must disclose historical-analysis limitations and the as-of UTC instant. Backend and architecture received these definitions before implementing the dependent query.

QA/architecture/browser checks and final source review are separate; none executed or passed by this planning record.

## Final candidate product/source review

Read dashboard.tsx, dashboard contract, dashboard SQL, agreement-list/create/operation contracts and current implementation status. The actual base includes the PR13 immutable reusable agreement library; the preflight's filtered-document assumption above is corrected. No agreement/engine implementation change is requested or authored here.

Dashboard uses real server counts, latest-completed-per-operation historical warnings, separate engine differences versus latest human confirmations, bounded pending lists with actual statuses and real document-status distribution. Human confirmations are restricted to latest confirm decisions among detected confirmed/probable controls. Cards count records/controls, do not sum money or imply recovered savings. Loading/error paths do not invent zeros. The agreement library remains an actual organization resource, with spot scope and per-invoice explicit selection preserved.

Small presentation follow-ups requested before final closure: include failed+blocked incidents as a separate documents-card subcount alongside needs_review, and explicitly label the footer's existing localized timestamp as local time (or render UTC). No financial query change is needed for these. Independent QA/UX browser execution is owned by other agents; this report is product/domain source review only.

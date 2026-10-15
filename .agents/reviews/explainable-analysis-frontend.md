# Explainable analysis frontend self-review

Date: 2026-10-15. Reviewer: `/root/analysis_frontend`, acting as frontend-engineer and ui-engineer. Mode: sequential implementation self-review, **not independent**. Scope: phase 3 operation comparison interface and final UX-A4 warning presentation delta. Consulted AGENTS.md, .agents/WORKFLOW.md, frontend/UI profiles, pilot requirements, implementation plan, architecture overview, identity interface design, and the pre-implementation `docs/design/analysis-workspace.md` blueprint.

## Files and behavior examined

Implemented `apps/web/src/features/operations/{api.ts,operation-list.tsx,link-dialog.tsx,facts-editor.tsx,operation-detail.tsx,warnings.tsx}` and their API/warning tests; extended `apps/web/src/app/app.tsx`, `apps/web/src/components/app-shell.tsx`, `apps/web/src/features/organizations/organization-detail.tsx`, and `apps/web/src/styles.css`.

- Reuses compact monochrome components, accessible Radix dialogs, local loading primitives, semantic tables, and responsive horizontal table regions. Adds organization-level Operaciones navigation without replacing the accepted shell.
- Client operations use shared Zod contracts, decimal strings, friendly malformed-response errors, and explicit organization/operation/run attribution checks. Server authorization remains authoritative; viewer mutation controls are hidden.
- TanStack Query keys include user, organization, operation and relevant page/run/fingerprint. Reads receive AbortSignal. Late create, analysis and editor/link mutations check mounted state before navigation or global effects.
- Document selection is paginated, preserves selections across pages, and uses actual uploaded records. Fact editing preserves source identity, kind, line identity and literal evidence. Kind-specific fields avoid offering unsupported edits. Missing monetary values remain null and display as Sin dato; zero is explicit.
- Fact revisions require a reason and capture the fingerprint when the dialog opens. Background operation polling does not close the dialog or reset drafts. Changed inputs reach the server's optimistic conflict check rather than silently rewriting current facts.
- Analysis launch retains an idempotency key after uncertain failure, polls queued/processing runs locally, preserves previous results, and displays computed outcomes separately from financial approval. No payment, claim or finding-decision controls are advertised.
- Recent five full runs avoid excessive polling payloads. Full history uses bounded metadata pagination; selecting an older run fetches its immutable detail on demand. Historical staleness is visible, and source revision reasons/dates are shown in a bounded history.
- Final UX-A4 delta: `WarningsList` is rendered for both current operation warnings and historical input warnings. Four recognized source warning prefixes map to a human filename and Spanish explanation. Missing historical filenames use Documento de este análisis. Unknown/malformed warnings produce generic text without reflecting raw identifiers or codes. Lookup accepts only own known reason keys.

## Checks actually executed by this agent

- `pnpm exec vitest run apps/web/src/features/operations/api.test.ts`: **4 passed**, covering mixed-tenant list rejection, mismatched operation detail, cross-tenant create destination, and malformed-payload privacy.
- `pnpm exec vitest run apps/web/src/features/operations/warnings.test.ts`: **2 passed**, covering all four recognized warning reasons and safe unavailable/unknown-source messages.
- `pnpm --filter @reconcile/web typecheck`: **passed** after the final UX-A4 presentation change.
- `pnpm exec eslint apps/web/src/features/operations/warnings.tsx apps/web/src/features/operations/warnings.test.ts apps/web/src/features/operations/operation-detail.tsx`: **passed** after the final UX-A4 change. Earlier broader frontend scope lint also passed before that bounded delta.
- Prettier was run on the implementation and final modified warning files. Aggregate repository checks and CI belong to the principal's final evidence, not this self-review.

A transient history implementation type error (an accidental extra argument to parseResponse) was caught by typecheck, corrected, and subsequently passed typecheck. No failed check remains attributed as passed before its correction.

## Findings and independent evidence boundaries

Independent UX findings A1–A3 were supplied and reexamined by `/root/analysis_ux`: background polling closing editors, inaccessible read-only exclusion details, and viewer analysis controls. Those fixes are included. UX-A4 was supplied independently by the principal/UX reviewer and corrected in the final warning delta described above. Independent approval belongs to that reviewer's record, not this document.

`/root/analysis_product_domain` reported 15 production-preview browser groups passed before the final warnings-only delta and is responsible for the subsequent expanded browser review. This agent did not author or execute those browser checks and does not claim a final expanded browser result here. Actual HTTP/queue/database acceptance belongs to the backend/QA/CI records; this agent did not execute the reported 43 HTTP cases.

## Status and limitations

Frontend implementation and bounded local checks are complete; final task verification depends on the independent UX/browser and aggregate CI records. No claim of pixel fidelity to an inspected Figma node, full screen-reader certification, generic OCR/semantic invoice coverage, financial approval, production rollout readiness, or phase 4 claim workflow is made. Supported source facts can be corrected; unsupported formats do not gain fabricated line evidence. No new frontend dependencies were introduced.

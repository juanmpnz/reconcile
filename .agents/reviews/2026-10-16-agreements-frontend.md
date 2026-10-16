# Reusable agreements — frontend implementation review

Date: 2026-10-16. Execution identity: `/root/frontend` (delegated frontend/UI implementation). Mode: implementation with sequential self-check; this document does not claim independent review or browser verification.

## Scope and references

Read `AGENTS.md`, `.agents/WORKFLOW.md`, profiles frontend-engineer, ui-engineer, ux-designer, visual-designer and accessibility-reviewer, `README.md`, architecture overview and `docs/plans/reusable-agreements.md`. Consulted backend endpoint/schema owner and consumed shared Zod schemas. Planning UX/domain clarification from `/root/planning` limits one agreement to one service/route and preserves legacy direct-linked tariff behavior.

Owned files: `apps/web/src/features/agreements/*`, organization tab routing, operation agreement panel, upload dialog callback/default kind extension, narrow additional styles.

## Implemented behavior

- Organization navigation includes Tarifas y acuerdos, with paginated versions, provider, reusable/spot scope, dates, exact pricing labels, original PDF link and manually reviewed source evidence.
- Create dialog reuses an existing tariff/quotation PDF or the existing upload flow with correct default kind. Selection of extracted source page exposes original text, requires a literal source snippet and explicit human acceptance confirmation. No claim of arbitrary PDF table extraction.
- Review covers provider, date interval, route, currency, one service, fixed-trip/per-km/distance bands, per-band pricing basis, reason and literal evidence. Shared schema validation rejects invalid/overlapping bands. Intervals are explained lower-inclusive/upper-exclusive.
- Per-invoice operation panel exposes saved selection, new reusable agreement and operation-only spot creation; multiple providers do not overwrite each other. Newly created versions still require explicit selection.
- Mutation includes exact version ID, full binding set, context and optimistic fingerprint/reason. Concurrent conflict preserves draft, reloads current operation and requires explicit review before retry. Removal is audited and previous run staleness is shown by existing analysis UI.
- Viewers retain reads with no mutation controls. Busy fieldsets, active-analysis guards, native labels, Radix dialogs, status/error semantics and flexible actions retain established patterns.
- Compatibility notes show missing/incompatible inputs and nonaccepted estimates; no arithmetic is done with monetary Number values. Distance UI comparisons use guarded BigInt scaling to eight decimal places. Backend remains authoritative for all checks.

## Checks performed

- `pnpm --filter @reconcile/contracts build`: passed when compiling current shared DTOs.
- `pnpm --filter @reconcile/web typecheck`: passed.
- `pnpm exec eslint apps/web/src/features/agreements apps/web/src/features/documents/upload-dialog.tsx apps/web/src/features/operations/operation-detail.tsx apps/web/src/features/organizations/organization-detail.tsx apps/web/src/app/app.tsx --max-warnings 0`: passed.
- `pnpm exec vitest run apps/web/src/features/agreements`: 9 tests passed (2 files): exact decimal presentation, high precision distance boundaries, missing/invalid inputs, estimate pending, source response validation, optimistic conflict distinction and duplicate-binding pre-request rejection.
- Prettier written for owned frontend files.

## Findings and limits

- Root and independent QA source review identified Number distance precision and malformed-distance feedback: fixed with BigInt + regression cases; independent reviewer notified for reinspection.
- Planning and root identified false pending language for legacy direct tariff documents: fixed to distinguish absent explicit selection from legacy evidence availability.
- Browser QA was requested from `/root/qa`; reviewer reported Chromium unavailable and download failed. Browser/mobile/keyboard interaction verification is **not-run**, not claimed by this implementation record. Independent QA records its own scope/evidence separately.
- Each immutable UUID is displayed as a version identifier; grouping/ordinal and in-place agreement editor are deferred. A new reviewed version can reuse the same original PDF and be explicitly selected without altering historical bindings.
- API/database/worker integration and final repository gates belong to coordinating/backend/QA executions; not certified here.

# Shared Select frontend implementation review

Date: 2026-10-16. Agent `/root/analysis_frontend`, sequential frontend/UI implementation review, not independent. Applied existing AGENTS/workflow, UX preflight `.agents/reviews/select-polish-ux.md`, and architecture's inspected Radix 2.3.8 form-bridge guidance. Root owns dependency/lockfile changes and lighter main backgrounds.

## Implementation scope

Added `apps/web/src/components/ui/select.tsx` and `select.css`. Migrated all **19 native select JSX call sites across 11 consumer files**: workspace selector, shared table page size, invitation role, document upload/metadata, operation facts/history, claim review/follow-up/resolution, and agreement creation/association. No raw `<select>` remains in application source. Radix intentionally retains its hidden native form bridge; this is not a claim that native selects disappear from the DOM.

Existing option JSX is consumed as declarative option data; visible menus render Radix items. Handlers now receive explicit `onValueChange` strings, with numeric conversion at the actual page-size caller. No fabricated React ChangeEvent or unchecked event cast is used. Controlled values, default-first-option behavior for existing uncontrolled forms, disabled states, names, form associations and required flags pass through the shared wrapper. Multiple selection is not implemented or advertised; all current consumers are single-select.

Empty values remain actual empty strings on Root/state/form transport. Only the selectable clear item's internal Radix value uses a generated, collision-checked sentinel, translated before state or caller callbacks. Required native validation remains enabled. Invalid capture prevents invisible native focus, focuses the visible trigger and supplies aria-invalid plus a visible error message. Label IDs are preserved, including explicit page-size label association. No separate hidden input or duplicate named control was introduced.

The shared portal is above the existing panel, collision bounded and scrollable. Trigger/option styles preserve keyboard focus, disabled treatment and mobile target sizes. Existing financial status colors are unchanged. SidePanel Escape/focus integration relies on root-approved matching Radix shared context versions, not on suppressing dismissal in individual callers.

## Local verification

- `pnpm --filter @reconcile/web typecheck`: passed without diagnostics after all migrations.
- Scoped ESLint over the shared component and all 11 consumer files: passed without diagnostics.
- Prettier ran on changed source and select CSS.
- Final source inventory `rg '<select\b' apps/web/src` had zero matches; its exit status 1 is the expected empty search result, not a type/lint failure.

No shallow prop-only unit test is presented as proof of browser form validation, FormData or nested modal behavior. `/root/analysis_qa` owns actual browser adaptation and cases for raw values/clear, required native validity, dropdown Escape before panel dismissal, typeahead/page-size server request, mobile bounds and focus. Architecture/UX own independent source review. Those results and final CI are pending their records; this self-review does not claim them.

Status: source frozen for canonical build and independent browser checks. No package, lockfile or main stylesheet edits by this agent. No general native-control equivalence outside the currently used single-select patterns is claimed.

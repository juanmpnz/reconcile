# Architecture closure — UX, visual and accessibility

Reviewer: `/root/ux_ds_review`, independent execution from implementation.

## Preflight (2026-10-17)

Read `AGENTS.md`, `.agents/WORKFLOW.md`, the UX/visual/accessibility profiles, README, implementation plan, architecture overview and current shared primitives, Select, SidePanel and feature control inventory.

The user asks for a complete internal design system and consistent application architecture, preserving the approved white/orange/Inter interface. No redesign of financial decisions, document evidence or business semantics is authorized by this refactor.

### Required migration acceptance

- Feature screens consume one public DS entry point for Button, link actions, Input, Textarea, Checkbox, Select, Field/Label, feedback, loading, tables, layout and overlays. Raw browser controls belong inside DS internals.
- Input-like components forward native typing, name/id/form, reference, default/controlled values, required/disabled/readOnly and ARIA attributes. Existing optional fields stay optional; existing mandatory fields stay mandatory. Current `Field` unconditionally adds `required` and must support an explicit optional override.
- Labels remain associated after migration. Hints and errors have stable IDs and `aria-describedby`; invalid state is announced. Read-only exports remain selectable/copyable.
- Buttons preserve submit versus ordinary-action behavior. Pending actions expose busy/disabled state. Navigation remains an anchor and keyboard-accessible.
- Shared semantic table primitives are suitable for detailed financial evidence; do not force that structured evidence into a pageable generic list or remove provenance/row context. Lists retain TanStack controls and truthful global search/sort/pagination.
- White principal content, Inter, compact typography and orange accent remain consistent; financial statuses keep text in addition to color.
- SidePanel remains the only form overlay, with keyboard focus, Escape/discard protection and full-screen mobile behavior. Replacing a raw control must preserve form submission and dirty-change tracking.
- Enforce primitive consumption automatically to prevent regressions; the rule must inspect source structure, not only prohibit one spelling of JSX.

## Independent implementation review

Status: passed for the DS control/layout source migration examined independently after `/root/ds_frontend` freeze. Final CSS, route/session and MFA UI changes belong to the coordinator and remain outside this verdict until reviewed separately.

Examined `apps/web/src/design-system/{controls,primitives,layout,table,select,side-panel}.tsx`, the DS catalog/README, the SidePanel and control test sources, and migration diffs in upload/correction/metadata, facts editor, agreement creation, claim draft/events/read-only copy, operation financial findings, organizations and AppShell. Ran source inventories with `rg` and inspected diffs; no native input, textarea, button, label, select, table, details or summary remains in the feature/AppShell files at this freeze.

### Findings and resolution

- **Medium, resolved:** `Field` previously forced required after props and prevented explicit optional fields. The shared component now defaults to the existing mandatory semantics while respecting `required={false}`, supplied IDs, existing ARIA descriptions, hint and error IDs. Native props/ref pass through Input/Textarea/Checkbox/FileInput.
- **Medium, resolved:** SidePanel initially recognized fixed form actions solely by a consumer CSS class. It now recognizes the `FormActions` component identity, preserving a footer within the same form and the Cancel discard guard without a redundant caller class. The focused test source covers a classless DS action group.
- **Medium, resolved:** Raw labels remained after the initial control migration. All feature/AppShell labels now use DS Label, retaining `htmlFor`/nested checkbox associations.
- **Low, resolved:** Select did not accept a server/form-level invalid state. It now accepts external `aria-invalid` while retaining internal native-form validation and described-by IDs.

Financial findings retain caption, column scopes, exact decimal strings, status text, explanatory text, evidence links and human review cells through shared semantic table primitives. Claim copy remains read-only and select-on-focus. File upload preserves ref, type restriction, conditional required and hint association. Existing Button submit semantics are preserved; pending disables actions and exposes busy state.

No open critical/high UX finding in this examined source. The implementer reports seven focused DS tests, typecheck and ESLint passing; execution evidence is independently owned by QA/coordinator, not relabeled as my own execution. Source review does not establish rendered contrast, screen-reader behavior, browser runtime, mobile appearance or WCAG compliance. Existing browser suites must pass on the final rebuilt revision.

## Final root MFA, route and styling source review

Status: passed independently for the current source after the coordinator's label correction and the frontend implementer's CSS freeze.

Read `features/auth/security.tsx`, DS `qr-code.tsx`, `app/routes.tsx`, `app/router.ts`, `app/session-boundary.tsx`, the account mutation flow, CSS import manifest, DS tokens/base/theme, auth-security layout and ESLint boundary rules.

- MFA presents its reason before organization access, current-password enrollment, pending/error states, retry, logout, authenticator challenge and recovery-code alternative. The visible key is selectable; QR generation is local with a readable manual-key fallback. Recovery codes explicitly require safe storage and single use; acknowledgment is a labeled checkbox before activation. Copy failure offers manual storage instead of claiming success. Success clears enrollment state before entering the application.
- The initial unsupported `FormField label` uses were corrected. Confirmation now uses a real DS Label wrapping its checkbox. Authenticator and recovery inputs have associated labels, bounded input, appropriate autocomplete, and actual native form submission. MFA main content has `tabIndex=-1` for focus targeting.
- Declarative routes distinguish public authentication, second-factor challenge and authenticated workspace/security pages. Session and assurance failures render explanatory loading/retry states; the organization view stays hidden until assurance succeeds. Unverified-email users receive an explicit verification path. Safe internal return destinations preserve task context after authentication.
- Effective Inter/color/spacing/control/feedback/table/SidePanel CSS now belongs to the DS. `styles.css` is an ordered import manifest separating DS foundations/theme from application/workspace composition. Checkbox sizing is shared, preventing the MFA checkbox from inheriting full-width input geometry. Manual secrets wrap and recovery-code columns collapse on mobile.
- ESLint structurally rejects native interactive/table/disclosure elements outside the DS and rejects legacy component compatibility imports in feature/app files. It does not forbid semantic prose or navigation anchors.

No open critical/high UX/a11y source finding. This is not a security sign-off on MFA cryptography/session enforcement and does not claim a live authenticator trial. Browser execution, computed layout/contrast and assistive-technology review remain separate evidence; QA's final suites cover the implemented paths with explicitly synthetic responses.

## Bounded visual artifact review

Independently opened all ten PNG artifacts from browser job `117283603962`, artifact `12086322830`, extracted at `/tmp/architecture-closure-browser`. Candidate head: `26d7dda`; tested merge: `f8dc37451734af4bc62d03214be1ba8dcaffe679`. The QA execution reports all eighteen browser groups passed; I reviewed its captured images rather than claiming to have executed those browser interactions myself.

Examined overview, operational list, agreement detail, narrow list, 320px/390px operation panels, 320px/390px custom selectors, long mobile agreement form and mobile fixed footer. White principal surfaces, compact typography, orange actions, sidebar separation and shared field/button styling are visible. The overview distinguishes historical analysis scope in text, presents chart labels/counts and offers expanded tabular values. Operation status and immutable-history warnings use explanatory text alongside colors. Narrow layouts wrap tabs/text while keeping the table inside its own scroll region; the custom selector wraps a deliberately long organization label without escaping the viewport. The mobile panel viewport images show full-width content, readable labels, reachable close action and persistent Cancel/submit footer. The long agreement-form viewport capture retains fieldset legends, input labels and footer while the form body scrolls.

Visual verdict: passed for these captured states, with no new critical/high visual finding. No direct Figma node comparison, pixel-fidelity claim, measured contrast audit, live screen-reader trial, real mobile keyboard trial or MFA-secret screenshot review was performed. These bounded screenshots complement the independent source review and synthetic browser assertions; they do not certify all possible application states.

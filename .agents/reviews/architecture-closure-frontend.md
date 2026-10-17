# Architecture closure — frontend / UI implementation

- Identity: `/root/ds_frontend`, actual delegated frontend-engineer / ui-engineer execution.
- Mode: implementation and sequential self-check; independent approval belongs to the separate UX/architecture/QA reviewers.
- Scope: internal DS and global feature JSX migration, centralized query factory / mutation hook adoption. No financial rule, PDF content, API permission or money transport changes by this execution.

## Implemented

The existing Select, DataTable, SidePanel, feedback and primitives now have one implementation under `apps/web/src/design-system`. `components/ui` only re-exports compatibility entries. The public barrel and README document supported subpath imports and native form contracts.

Every feature control now consumes shared Input, Textarea, Checkbox, FileInput, Button, Select, Field/FormField/Label and semantic Table primitives. Existing field IDs, native names/form/ref/defaultValue/readOnly/required/disabled and decimal strings are preserved. Field supports explicit optional inputs and shared hint/error associations. Table sorting/resizing actions use the same Button implementation with an intentional unstyled variant. Native financial evidence remains a semantic contextual table with original evidence/review cells, rather than being forced into a pageable collection.

Repeated headers, field/action groups, account card and disclosures use PageHeader, FormField/FormActions, Card and Accordion. SidePanel recognizes FormActions directly, including callers without a CSS class, preserving its one-form fixed-footer structure and guarded cancel.

Feature reads use data-agent query-option factories; writes and user-triggered downloads use retry-disabled TanStack mutation hooks. SDK invitation/organization writes also use hooks. Metadata conflict reload uses QueryClient.fetchQuery with staleTime 0. Explicit conflict reload flows remain; duplicate direct successful invalidations were removed where the central mutation owns them. Auth/account, MFA, app/router and top-level session flow are root-owned, not certified by this report.

## Checks executed

- `pnpm --filter @reconcile/web typecheck`: passed after integration of DS, feature hooks and query factories (prior to root MFA additions). A later integrated invocation found root-owned MFA/auth WIP errors and notified root; a subsequent scoped web typecheck after their correction passed. Final full-workspace result belongs to the coordinator.
- `pnpm exec eslint apps/web/src/design-system 'apps/web/src/features/**/*.tsx' apps/web/src/components/app-shell.tsx`: passed.
- `pnpm exec vitest run apps/web/src/design-system/controls.test.ts apps/web/src/design-system/side-panel.test.ts`: 7 passed, 2 files. Covers exact decimal strings, native form attributes, optional/required/hint/error associations, file/checkbox validation, pending submits, semantic financial table, and fixed footer with DS FormActions.
- Source inventory: no native input/textarea/button/select/table/thead/tbody/tr/th/td/label JSX tags outside DS after migration. Root enforces the boundary in ESLint.

## Review fixes and limits

Independent UX preflight requested label adoption, optional semantics and direct FormActions recognition; implemented those corrections and notified reviewer for independent re-examination. Restored the claim refresh query key to the new canonical factory rather than retaining a stale old key. Historical analysis query freshness fingerprint is preserved through the central factory fifth argument, using the current operation fingerprint; the data owner added a regression test for key identity.

No browser validation is claimed by this implementer. Root/QA perform the final built-asset acceptance suite and complete workspace check. DS styles/tokens extraction, security/MFA, HTTP and server authorization are owned and reviewed by other executions.

## CSS ownership closure

Shared tokens, native/control and semantic-table styles, feedback, overlays and SidePanel styles now live in `design-system/{tokens,base,theme,styles}.css`, alongside Select/DataTable CSS. `src/styles.css` is an ordered import manifest; application-only composition remains in `src/styles/{application,workspace,auth-security}.css`. Approved effective Inter/light/orange tokens have one root definition. The extraction checked that all 973 original declaration entries were retained before consolidating superseded root token declarations; base/theme ordering and responsive groups remain explicit. No CSS layers or specificity changes were introduced. Checkbox has a shared compact class so new auth forms cannot inherit full-width text-input sizing. QR images, enrollment secrets and backup codes contain/wrap on narrow screens.

Scoped production Vite build passed following extraction (existing third-party annotation and bundle-size warnings only). Final browser acceptance remains the QA execution's responsibility.

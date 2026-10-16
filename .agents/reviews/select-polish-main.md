# Select polish — principal coordination

Root sequential principal review. Scoped user request: replace all native dropdown presentations through one component and lighten main content/background overlay. UX preflight preceded frontend implementation; independent architecture/a11y review examined value/form/portal/dependency behavior. No API, authorization, financial rules or persisted records changed.

All19 visible selectors now use shared Select with explicit string callbacks, while preserving native form bridge name/required/disabled/raw values including empty. Exact Radix Dialog1.2.0 and Select2.3.8 share the same installed dismissable/focus/portal modules. Read official Radix Select/Dialog documentation and installed source before pinning. Main/root/body are white and drawer overlay uses translucent white.

Local pnpm check passed114unit tests,8harness regressions, formatting, lint, strict types and builds. Independent source records are select-polish-architecture.md/select-polish-ux.md. QA adapted existing portable browser suites to visible custom controls and added required/FormData/clear/nestedEscape/typeahead/mobile/contrast checks; actual runtime acceptance pending CI. Existing local Chromium installation remains unavailable, no local browser pass claimed. No deployment or exact Figma matching claim.

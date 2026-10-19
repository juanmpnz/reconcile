# Commercial extraction: facts display

- Roles: frontend-engineer / ui-engineer implementation; sequential accessibility source inspection.
- Execution: `/root/commercial_ui`; scoped implementation, not independent review of its own changes.
- Scope: `apps/web/src/features/operations/operation-detail.tsx`, `FactSummary`.
- References read: AGENTS.md, expert workflow/manifest, relevant role profiles, README, architecture overview, implementation plan and pilot requirements; commercial extraction task.

## Changes and reasoning

- Use line currency (with document fallback) for the extracted amount and its unit price. Original tariff unit price/currency is labeled separately. Missing billed unit prices remain explicitly unknown; no displayed multiplication suggests a cross-currency equality.
- Recorded exchange rates have their own source-evidence section and explicit wording that extraction does not mean validated/applied conversion.
- Existing definition-list styles, source blockquotes and review controls are retained. No interactive control, request, provider inference, service mapping or financial computation is added.
- Semantic `dt`/`dd` associations and a heading expose the new metadata without relying on color. Existing mobile definition-list rules apply; browser/zoom inspection is pending independent QA.

## Verification

- Prettier initially reported formatting changes; targeted formatting applied.
- `pnpm --filter @reconcile/web typecheck` passed after the additive contracts became available.
- No mirror unit test added for static labels; financial extraction/rounding and integration behavior belong to parser/rules/contract tests.
- Browser acceptance, screen-reader behavior and final global checks are not certified by this implementation review.

Status: implemented; pending final checks and independent review.

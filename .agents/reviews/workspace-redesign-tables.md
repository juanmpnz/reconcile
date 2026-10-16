# Workspace tables — implementation and sequential self-review

- Execution: `/root/workspace_tables`, frontend-engineer / ui-engineer, 2026-10-16.
- Mode: implementation plus sequential self-review, **not independent**. Architecture and QA are separate executions coordinated by principal.
- Source: uncommitted workspace redesign diff; no git commit created by this execution.

## Delivered

Shared `components/ui/data-table.tsx` and its own CSS implement typed column configuration, standard string/number/currency/date/status/bar/link/actions renderers, accessible HTML table region/caption/column scopes/aria-sort, global client search on complete collections, controlled server search/sort/page navigation, 25/50/100 page sizes, count/range/page labels, empty and background loading states. Optional row selection, column visibility/resizing/pinning, expansion and custom toolbar exist but are not enabled where no useful business action backs them. Monetary renderer preserves decimal string values and currency; does not coerce to float or aggregate currencies.

Server props use a discriminated union requiring authoritative total, pagination and fetch callback. Server sort requires both callback and declared sortable column. Multi-sort is disabled to match one-column API contract. Server sort delegates page reset atomically to parent URL callback; no second stale navigation. Page-size changes reset to page zero.

Migrated organizations, operations, documents, agreement versions, members, invitations and operation claims to DSL. Root owns operations/agreements global search/sort/page APIs and document page size contracts; this execution consumes those changes. Documents preserve edit metadata and operation links; operation create form and permissions remain. Native organization auth list is complete and uses client search/pagination; members have server pagination with fixed 25 until parent supplies page-size callback, and no invented server search/name sort. Invitations have complete client collection and preserve valid cancel capabilities/pending guard.

Also migrated operation linked documents, reference diagnostics, analysis history, latest 100 human fact revisions, document latest 50 metadata changes and document corrections. Bounded audit collection labels state scope explicitly; search operates only inside that stated scope. Analysis history uses shared server pagination at existing 25, with no unsupported sorting/search.

## Intentional exception

The remaining native table in operation-detail is the financial findings/evidence composition: nested evidence, per-finding review controls and original engine amounts remain together. This is an operation-specific result presentation, not a globally paged catalog. It keeps existing semantic table, shared TableRegion, accessible controls and financial status styles. Blindly flattening it into a generic catalog would alter review interaction and evidence order; no such functional change was authorized by this presentation refactor.

## Evidence

- Read AGENTS.md, .agents/WORKFLOW.md, frontend-engineer/ui-engineer profiles, docs/design/workspace-redesign.md and affected APIs/components. Prior product/architecture/plan context was inspected via repo files.
- `pnpm --filter @reconcile/web typecheck`: passed after final detail table migrations.
- Targeted `pnpm exec eslint` across all owned TSX files: passed, zero warnings.
- Targeted Prettier write: completed successfully.
- No broad backend/unit suite or independent browser acceptance performed by this execution. QA owns browser scenarios; principal owns final gates.

## Findings corrected during self-review

1. Server TanStack render-only columns need an accessor for getCanSort to expose actual sort controls: supplied default accessor, while manual row models and explicit enableGlobalFilter prevent local-page pseudo sorting/filtering.
2. Server sort must not trigger a second URL write resetting old sorting: reset is client-only; server callback owns atomic URL change.
3. `exactOptionalPropertyTypes`: omitted client rowCount rather than passing undefined; guarded missing sort entry.
4. Type-only schema imports satisfy consistent-type-imports lint.

## Limits

No claim of pixel exact Figma fidelity or accessibility certification. Optional advanced controls require real consuming scenarios and browser acceptance before enabling them in a business list. Full data authorization remains backend-owned; client scope guards are preserved, not treated as authorization.

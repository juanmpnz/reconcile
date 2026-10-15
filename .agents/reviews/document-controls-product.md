# Document controls — product and logistics planning

Date: 2026-10-15. Agent: `/root/analysis_product_domain`; roles product-manager and logistics-domain. Mode: planning/read-only review of existing contracts and affected semantics. Owns this review file only; no production, engine, demo or browser implementation. Read AGENTS/workflow, both profiles, existing pilot requirements/plan, document kind contract, document table/API labels, Prisma document model and current source-fingerprint collection.

## Acceptance before implementation

- Compact organization/header layout preserves organization context, navigation and actual primary action. Do not introduce giant headings or hide essential review status to save height.
- Edit the visible document name and classification from its table row, with fresh organization permission, bounded validation, a required reason, append-only metadata history and optimistic concurrency. A viewer cannot mutate. Network/conflict errors retain the draft and require explicit comparison before retry.
- Principal clarified the accepted name policy: preserve original PDF bytes, SHA-256, extraction and historical snapshots. The editable display name also becomes the download filename; the original upload name remains in the first before/after audit event. No separate immutable filename field is promised. Renaming must not change the extracted invoice number, operation reference, original text, correction history or source evidence.
- User-requested changes to display name or type mark linked analysis/claim inputs stale through versioned source metadata. Preserve historical run snapshots, exported versions and recorded sent text; no silent recomputation or rewriting. Classification changes must not reuse a fact revision that applied to the prior type. Existing extraction content may be reused honestly; reclassification is not invented extraction.
- Actual transport classification is `tariff` (UI Tarifa), distinct from a normalized `agreement` fact. Selecting Tarifa never proves acceptance, dates, route/scope or supplier agreement, and never promotes an internal estimate to an agreed price.
- Show extracted operation reference and linked operations as separate concepts. The former is a sourced/correctable PDF field; the latter is an explicit tenant-scoped relationship. A matching string does not create an operation or attach the document automatically. Show real linked-operation labels and navigable authorized links, including multiple associations when applicable; an absent reference and an unlinked document are different states.
- Search/sort behavior must match its declared scope: server-wide filtering or clearly labeled current-page search, no implied global completeness. Preserve stable ordering, coherent counts/pagination and filters through refresh; empty results differ from no documents. Sorting names/dates/types must use the actual displayed/backend data and maintain a deterministic tie breaker.

## Required negatives and review scope

Verify viewer/revoked/foreign-tenant mutation rejection, stale-token conflict without overwrite, renaming without byte/identity change, type changes invalidating old normalized fact versions, and old analysis/export readability. Linked-operation navigation and search/sort must not disclose another tenant. Financial rules, fixture PDFs and invoice amounts remain unchanged.

## Candidate source review

Read the stable candidate based on main `1bc136d`: document metadata dialog, list/detail, operation links, compact operation header, source versioning, list SQL and public labels. Metadata editing requests filename/type/reason plus expected metadata version, preserves its draft on conflict, loads current values for explicit comparison and invalidates document/operation/review caches. The detail exposes before/after reason/actor/date history. Actual downloaded bytes and audit persistence require the other agent's real-service tests; this is source review only.

Reference extracted/corrected from PDF and actual linked operations have separate columns/labels, real links and absent-value messages. Classification uses tariff; selecting it does not set acceptance or normalize an estimate into an agreement. Type changes alter the normalized-fact source fingerprint; metadataVersion enters analysis sources to mark prior input snapshots stale without rewriting old results. The compact operation header groups edit/refresh/analyze and exposes an explanation for a disabled analysis action.

Finding DC-P1 (medium, resolved after targeted source re-review): global search advertised type/status but used raw technical strings in SQL while rendering Spanish labels. A user searching Tarifa or Requiere revisión would not find the corresponding visible type/status. Principal accepted the finding. Backend now projects kindLabel/statusLabel with CASE values matching all current Spanish UI labels, includes both visible labels and technical enums in search, and orders type/status by the visible label with stable ID tie break. Targeted re-read also verified actual HTTP test assertions for q=Tarifa (one matching tariff) and q=Requiere revisión (two matching documents). Those tests belong to execution by the service QA route/CI, not this reviewer; this review confirms the source and acceptance alignment, not runtime success. No production changes by this reviewer.

Status: **passed, product/logistics source flow review** after DC-P1 correction. No open critical/high or medium product findings remain in the examined candidate. QA/UX browser and real HTTP validation are separate. No browser, deployment or independent financial validation is claimed in this record.

## Targeted reviewed source fingerprints

```text
2bb0baa8dbe9fde9e2d82717a88732567be849d4306b673ddf43d02bedc09f43 packages/application/src/documents.ts
2dacaf732d3be5791728aef5583671acb190c73832f9082d82bc3c7a1baa6b5f apps/api/test/documents.integration.test.ts
4124dee40adac5904224d5dae67eb4e57122c830c0e36721928878db7981ae9c apps/web/src/features/documents/metadata-dialog.tsx
9d7ed3e1942dc35fa93c84f5fbf7e58aad0aa1115cc225acfac9b5e41d752ace apps/web/src/features/documents/document-list.tsx
117a2544689125cdb8fdc9e76dead2b3ca7b7f805d2c3081142c43260d2a7d32 apps/web/src/features/documents/document-detail.tsx
```

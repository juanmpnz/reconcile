# Operation usability frontend implementation review

Date: 2026-10-15. Agent: `/root/analysis_frontend`, frontend-engineer/ui-engineer. Mode: sequential implementation self-review, not independent. Scope follows the prior blueprint `docs/design/operation-usability.md`, the shared contracts and backend decisions, AGENTS.md and the expert workflow.

## Implementation examined

`apps/web/src/features/operations/operation-detail.tsx` now presents analysis before expandable supporting document/data/history panels. Outcome counts describe controls, without aggregating money or claiming unique invoice lines. Status uses the approved red/green/amber foreground/background pairs plus explicit text and decorative icons. Green remains limited to no price difference; arithmetic and total consistency controls are separated from service/agreement checks.

`evidence.tsx` groups by source document and deduplicates exact document/extraction-version/revision/page/snippet tuples. Identical text on different pages or versions remains available. Two initial citations use compact document/page labels with native expansion to the complete literal excerpt; additional unique citations remain expandable with a real count. Evidence ordering does not claim a ranking absent from the API.

`edit-dialog.tsx` performs real bounded PATCH name/reference edits using a captured fingerprint. `link-dialog.tsx` manages existing associations, including removal without deleting originals or historical analyses, and now sends the captured fingerprint. Both preserve drafts on conflict. STALE_OPERATION/CONCURRENT_UPDATE require explicit review/rebase; the edit dialog shows current name/reference before allowing that action, while association conflicts show the current count and current-link markers. ANALYSIS_ACTIVE and REFERENCE_EXISTS retain their own meanings instead of incorrectly becoming stale-input rebases. Active-run restrictions follow the backend; authorization refresh still suspends portals.

`api.ts` safely parses bounded error codes without reflecting raw server content, validates PATCH responses and tenant/operation attribution, and transports decimal values unchanged. Existing Query keys, AbortSignal reads, local loaders, mounted guards, historical immutable snapshots and correction audit history remain intact.

Preflight lists the expected operation reference once and found references by source document, distinguishing missing values. It is advisory because the server evaluates reference mismatch as a non-verifiable result rather than blocking analysis. The review link opens and focuses the facts panel. It does not modify PDF references or infer equivalence. Original extraction links remain accessible. The sole added diagnostic note reports a missing line route from the selected snapshot for AGREEMENT_MISSING, retaining the original motor explanation without inventing agreement applicability.

Styling changes are limited to the operation workspace in `apps/web/src/styles.css`; no new dependency, schema, financial rule, fixture or claim workflow was introduced by this agent.

## Checks executed

- `pnpm exec vitest run apps/web/src/features/operations/presentation.test.ts apps/web/src/features/operations/api.test.ts`: **8 passed** (6 API tests and 2 presentation tests). New coverage checks revision-aware exact citation deduplication, bounded outcome counts without monetary totals, total/arithmetic grouping, PATCH fingerprint transport/destination attribution and safe conflict codes.
- `pnpm --filter @reconcile/web typecheck`: **passed** after the implementation and contract changes.
- `pnpm exec eslint apps/web/src/features/operations`: **passed**.
- Prettier ran on affected source/test/CSS files. Subsequent final label/focus changes were formatted; aggregate principal checks cover the final repository revision.

## Independent findings and limitations

The principal and `/root/analysis_ux` supplied refinements for compact evidence, arithmetic/total grouping, conflict clarity, compact reference preflight, control-count terminology and focus transfer. This implementation includes those fixes; independent acceptance belongs to their actual review record. Browser checks are owned by `/root/analysis_product_domain`; this agent has not claimed or executed that production-preview run. Backend/queue/HTTP and aggregate CI evidence belong to the appropriate specialists and principal.

Status: implementation frozen for independent UX/browser and aggregate verification. No claim of financial approval, definitive invoice validity, claim sending, generic semantic extraction, pixel fidelity or full assistive-technology certification. No unresolved implementation finding is asserted closed solely by this self-review.

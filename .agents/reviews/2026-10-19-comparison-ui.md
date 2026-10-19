# Comparison expediente — frontend implementation evidence

Date: 2026-10-19. Execution identity: `/root/ui`. Mode: delegated implementation with sequential self-check; not independent review.

## Scope and consulted instructions

Read `AGENTS.md`, `.agents/WORKFLOW.md`, `.agents/manifest.json`, frontend-engineer, ux-designer and visual-designer profiles, README, architecture overview, implementation plan and pilot requirements. Consulted planning execution `/root/planning` for the explicit distinction between source conditions and invoice findings. No dependency additions or authorization changes.

Owned implementation: `apps/web/src/features/operations/{operation-detail,operation-list,edit-dialog,facts-editor,presentation,presentation.test}` and `apps/web/src/features/claims/review-workspace.tsx`. Browser acceptance additions: `apps/web/test/agreements.browser.mjs`.

## Implemented behavior

- Creation/editing label the operation reference as a free internal expediente identifier and explain it need not match invoice, contract or shipment numbers.
- Removed the UI preflight that compared every extracted `operationReference` against the internal operation reference and incorrectly promised exclusion.
- Linked document presentation explicitly separates reference documents, invoices to verify, and supporting documents. Reference extraction/revision remains accessible, with original preservation explained.
- Invoice result tables and outcome counts select only findings whose snapshot document kind is invoice. They preserve original object identity and indexes for existing review actions; persisted runs are not rewritten.
- Noninvoice findings from original results remain inspectable in a read-only evidence accordion, without financial amount columns or economic review controls. `FindingReviewCell` defensively rejects noninvoice documents.
- Undefined applicability detail and an explicitly empty decision list receive different neutral explanations; neither claims to prove that an analysis is historical.
- Reused DS components, current query/mutation flows and responsive layout. No speculative price computations added to frontend.

## Evidence and limits

- `vitest run apps/web/src/features/operations/presentation.test.ts`: passed, 4 tests, including invoice/source filtering with preserved finding indexes and undefined versus empty applicability presentation.
- Prettier written for touched source and browser test files; `git diff --check` passed before browser additions.
- Direct web tsc initially failed because checked-out package dist artifacts did not expose current contract schemas/fields (agreement exports and agreementDecisions). Also identified a local nullable ID check, corrected. Final typecheck after coordinator rebuild is required and belongs to coordinating verification.
- Browser fixture added for arbitrary internal reference, mismatched external identifiers, split document sections, invoice-only economic rows, retained source-only read-only evidence, and explicit empty applicability. Synthetic HTTP fixtures test UI presentation/interactions, not extraction accuracy or backend authorization.
- Browser execution, visual inspection and full service checks are not claimed by this implementation record; coordinator/QA records actual execution separately.

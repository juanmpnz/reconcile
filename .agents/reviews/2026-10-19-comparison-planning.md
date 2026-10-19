# Comparison case semantics — preimplementation consultation

- Date: 2026-10-19.
- Reviewer execution: `/root/planning`, independent consultation from the implementing engine/UI executions. One execution consulted the product-manager, logistics-domain, solution-architect, ux-designer and visual-designer profiles; these are not five independently executed reviewers.
- Scope: confirmed user brief, existing implementation and design acceptance before dependent changes. This is not final diff approval or runtime QA.
- Outcome: passed planning consultation, subject to the acceptance and verification below.

## Evidence consulted

Read AGENTS.md, .agents/WORKFLOW.md, .agents/manifest.json, the five named role profiles, README.md, docs/architecture/overview.md, docs/plans/implementation.md, docs/product/pilot-requirements.md and docs/adr/0008-agreement-applicability.md. Inspected logistics/applicability.ts (`operationContradiction`, `operationContext`, `decideAgreement`), logistics/evaluate.ts (`evaluateLogistics`), document-processing/analysis-facts.ts (explicit typed reference extraction), application/analysis.ts (append-only snapshot/source-fingerprint preparation), and operation-detail.tsx (`ResultTable`). Inspection used cat, rg and sed; no services or acceptance tests were run by this execution. Shared worktree implementation was already advancing, so these observations are consultation evidence rather than a fixed-SHA review.

## Confirmed acceptance

1. Operation reference is a free internal case label. It is not evidence of a shipment identifier and cannot exclude documents by differing from a document number.
2. Contract, quotation and tariff documents provide terms and conditions. Read and review their extraction, but do not create economic findings, invoiced differences or claim/review actions against them. Invoice documents alone receive financial comparison outcomes.
3. Distinguish invoice number, agreement identity and externally evidenced operation/booking/BL/shipment identities. Preserve real contradictions between same-type external identities; absence is not contradiction. Manual assignment establishes case membership, not commercial applicability.
4. One assigned agreement is not automatically valid. Verify documented conditions and relevant date basis; unknown, contradictory, unrestricted and verified remain distinct. Ambiguity cannot be silently resolved by document order.
5. Invoice findings retain prices, units, currency and exact source evidence. Independent arithmetic checks can complete while pricing stays pending. No absence of evidence becomes overcharge or recovered savings.
6. Correcting extraction corrects the reading, not the source contract. Keep originals, exact agreement versions, revisions and prior analysis results immutable. Recalculation creates a new run.

## UX and visual recommendations

Use explicit sections for source documents/extraction, invoices to verify, applicability and per-invoice financial results. Source warnings belong beside the reference document; monetary columns and economic review actions belong beside invoice findings. Use existing DS components and text labels, retaining accessible state communication beyond color. Label the operation field as a free internal reference with clear helper text.

An empty agreementDecisions array does not establish a historical run. Explain missing decisions neutrally or use explicit version/capability evidence. Historic source-only findings must remain inspectable as history without being presented as current invoice economics or enabling new commercial correction actions on source documents.

## Pitfalls and required verification

- High: eliminating all identity checks would permit evidence from unrelated shipments. Test a real evidenced same-type contradiction alongside the arbitrary internal-reference case.
- High: accepting a single candidate despite unknown applicability would fabricate confidence. Test compatible, incompatible, pending and ambiguous agreements.
- Medium: operational context must not flow merely from shared internal assignment when multiple shipments or BLs are present. Avoid treating multiple legitimate same-type identifiers as automatic contradiction without clear evidence of incompatible identity.
- Medium: parser still recognizes bounded explicit labels/rows, not arbitrary real tariff matrices. Report this extraction limit; do not use the source example number or invented prices as built-in data.
- Medium: a new result with no decisions must not claim it preserved an original historical result.

Require regression coverage for the minimal one-reference-document/one-invoice case; arbitrary internal label; distinct document numbers; source-only result semantics; genuine contradiction; missing data; stale/new analysis behavior; history preservation and tenant isolation. Final verification belongs to engine/UI review and QA, including service/browser checks where available. No implementation, migration or deployment was performed by this execution.

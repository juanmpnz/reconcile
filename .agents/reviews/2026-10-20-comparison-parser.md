# Evidence-bound comparison metadata implementation

- Role: document-ai-engineer; agent execution `/root/commercial_parser`.
- Mode: implementation and sequential self-check. This record does not claim independent approval.
- Scope: `commercial-tables.ts`, `analysis-facts.ts`, and commercial parser tests. Read AGENTS, WORKFLOW, document-AI/security profiles, product requirements, implementation plan and architecture.

Added provenance for explicit directional commercial routes so origin/destination conditions retain their source fragments. A via location remains intermediate rather than replacing the final destination. Existing explicit provider extraction remains unchanged; issuing-agent and corporate-footer text are not promoted to contractual supplier identity.

Billing periods require an explicit valid ISO start/end range; a month/year label or document validity does not establish a billing period. MONTH/YEAR invoice units are supported only under the existing verified column header and retain their original quantities. They establish cadence, not fixed prices.

Pricing behavior requires an explicit all-rates fixed/variable statement or a clearly scoped surcharge-at-shipment clause. Surcharge matrix rows alone receive the latter variable behavior and shipment date basis; base freight stays unknown. Explicit pricing date basis is distinct from document/invoice dates. Invalid dates, reversed ranges and conflicting statements remain unknown with review warnings. No semantic concept aliases, fixed-price inference from dates, OCR, network calls or supplier-name heuristics were added.

Checks:

- `pnpm --filter @reconcile/contracts build`: passed to refresh dependent schema output.
- `pnpm exec vitest run packages/document-processing/src/commercial-tables.test.ts packages/document-processing/src/analysis-facts.test.ts`: 26 passed (17 commercial, 9 existing).
- `pnpm --filter @reconcile/document-processing typecheck`: passed.

Tests use synthetic text and generic identities only. No private document extracts, identifiers, private sample metrics or financial values are included in this record. Unsupported terms remain reviewable unknowns. Append-only reviews and historical persisted runs are unchanged by this parser implementation; root owns parser-version changes and pipeline verification.

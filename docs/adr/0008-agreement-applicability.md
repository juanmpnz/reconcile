# ADR 0008 — Agreement identity and evidence-based applicability

Status: accepted; implementation and verification tracked in `.agents/tasks/2026-10-19-agreement-applicability.json`.

## Context

The logistics engine filtered agreements using the invoice operation reference before checking commercial conditions. This excluded reusable contracts and generic quotations. A single reference also conflated booking, BL, shipment and contract identifiers. Filtering candidates as booleans discarded the distinction between unknown evidence and explicit contradictions.

## Decision

Separate typed documentary identity, commercial applicability and economic findings. Agreement/quotation identifiers never establish equality with an operation reference. Explicit references of the same operational type can contradict; different types do not imply contradiction or equality. An absent reference is missing evidence.

Add bounded optional structured facts to the existing reviewed JSON and immutable snapshots. Conditions distinguish restricted, explicitly unrestricted and unknown. Applicability decisions retain candidate identities, conditions, reasons and source evidence. A unique sufficiently supported candidate can apply; multiple compatible candidates require selection. A pending competing candidate prevents certainty. Explicit citation strengthens documentary linkage but does not override conditions. No ranking or undocumented priority applies.

Manual selection remains per invoice, current tenant membership and role authorized, optimistic and audited. A selection records a choice; it cannot change contradictory conditions into verified conditions. Date/route context may remain unknown. Nullable additive selection provenance preserves historical rows without inventing actors or reasons.

Economic checks operate independently. Pricing requires the relevant date basis and directional route, applicable equipment and real operation quantities. BL, shipment and container units stay distinct. Per-line currencies remain separate without documented FX; signed amounts are retained. Included package components cannot be charged again as independent prices. Missing data or tariffs never imply an overcharge.

## Consequences

No domain dependency on database, HTTP or React is added. Existing document-fact revisions, source fingerprints, operation revisions and append-only analysis runs remain authoritative. Parser/rule version changes invalidate current fingerprints; prior stored results and snapshots remain readable. Recalculation creates a new run instead of rewriting history. Published agreement records remain immutable exact versions.

Extraction remains bounded to supported labels and explicit row associations. Arbitrary PDF tariff matrices, arbitrary additional legal restrictions and OCR are not silently interpreted. Review structured facts against the original source; unsupported values remain pending. The Q2603BCN00826 scenario is test identity and scope only, never a built-in tariff or source of prices.

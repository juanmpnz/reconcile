# ADR 0010 — Attached reference and invoice comparison

Status: accepted for implementation; verification belongs to the task record. Complements ADR 0008 without weakening its applicability requirements.

## Context

An operation is a comparison case with a free internal reference. The basic operator flow is to attach a contract/quotation/tariff and an invoice, review extraction and compare the invoice. Publishing a separate reusable agreement is an optional advanced capability, not a prerequisite. Document assignment establishes case membership, not commercial applicability.

Existing extraction facts preserve invoice tariff prices and currencies separately from booked amounts. Existing immutable snapshots, append-only fact corrections and version fingerprints provide the required persistence boundary. The current all-or-nothing evaluation can suppress useful source-price observations when applicability or billed-currency conversion remains unresolved.

## Decision

### Semantic concepts

Use a bounded, versioned bilingual concept dictionary. Normalize case, accents, punctuation and whitespace; explicit approved aliases map to a canonical concept. Preserve original description and evidence. Aliases must preserve origin/destination, charge scope and billing basis; a broad service category or similar number is never sufficient. Unknown or ambiguous descriptions remain unknown. Do not learn global aliases from private documents or match by equal prices.

### Comparison and applicability are separate

Generate invoice-line comparison observations from attached reference candidates even when final applicability is pending. Candidate selection uses canonical concept, equipment, billing basis and currency; applicable commercial conditions additionally require provider/party, route scope, date basis, period, restrictions and acceptance evidence. Multiple candidates remain ambiguous without undocumented ranking.

A candidate is not an applied agreement. Display source-price equality/difference as provisional when any necessary applicability condition is unknown. Explicit contradictory conditions prohibit an applied price finding; optional explanation of the rejected candidate must retain the contradiction and cannot become claimable money. Only verified applicability permits the existing definitive economic finding/review workflow. Missing evidence never becomes a surcharge.

### Original and billed currencies

Use invoice `tariffUnitPrice` and `tariffCurrency` for original-currency source-price observations, falling back to `unitPrice` and booked currency only when that field actually represents the original unit price. Compare with reference unit price only in the same currency and matching basis/equipment. Preserve actual quantity separately from quotation illustrative quantity. A unit-price observation can exist before independent shipment quantity is verified, but a definitive expected shipment amount requires evidence of its billing quantity.

Do not compare a foreign tariff price to a booked domestic amount. Billed FX validation is an independent pending/verified/contradictory dimension; no ratio-derived rate, inverse assumption, global FX lookup or inferred rounding policy. Source-price match does not validate conversion, tax, service performance or invoice total.

### Validity versus price period

Document commercial validity and individual price effectiveness are distinct. A reference valid for a broad interval does not prove each surcharge is fixed throughout it. Support an optional evidenced per-line price period/date basis; both document applicability and relevant line period must hold for a definitive result. Wording that rates vary at shipment remains a restriction or unknown price effectiveness until sufficient period evidence exists. Do not substitute invoice date for shipment/booking/service date.

### Minimal additive contracts

Keep existing line source-price fields. Add optional per-line evidenced price period only where extracted explicitly; historic facts without it remain readable. Add optional bounded result `lineComparisons` (or equivalent) independent of existing findings: invoice/line IDs, reference document/version/line IDs, canonical concept/match reason, original currency and unit prices, invoice quantity, signed unit-price delta, comparison state, applicability state, reasons and evidence. Amount comparisons must identify their currency and supported quantity; never overload existing booked-money finding fields.

Add optional informational offset groups only for compatible currency, billing basis, equipment and scope, referencing individual observations. A net zero does not erase individual discrepancies; never create a combined/net claim automatically. Exclude provisional/contradictory observations from claimable totals and dashboard recovered/confirmed money.

Use existing JSON fact revisions/snapshots/results rather than introducing another agreement table or mandatory publish/bind action. Bump parser/rule versions when behavior changes; include alias version in the rule version/fingerprint. Keep prior immutable snapshots/results untouched. Verify strict schema compatibility and payload budgets before adding repeated evidence.

### Operator flow

The primary operation page presents reference sources, invoices, then per-invoice comparisons with visible pending reasons and source evidence. A missing published agreement is not an error when a reference document is attached. Optional reusable-agreement selection remains available without overriding contradictions or acceptance evidence. Extraction corrections revise reading only, never the original contract.

## Verification and exclusions

Use invented synthetic fixtures, independently created from requirements; no private-derived identities, counts, financial values or copied layouts/data in committed evidence. Cover bilingual aliases and false friends, unknown concept, ambiguous candidates, foreign original currency with unresolved billing FX, price period distinct from validity, incompatible scope/provider/date, equipment/basis conflicts, equal-and-opposite differences, unchanged historical reads and tenant isolation. No OCR/external model/service, payment approval, automatic claims or universal matching is introduced by this decision.

## Vocabulary sources

Canonical shipping charge families can be checked against the carrier's public [local charge table](https://www.hapag-lloyd.com/360applications/local-charges/Q32026.html) and [Marine Fuel Recovery notice](https://www.hapag-lloyd.com/en/services-information/news/2026/03/marine-fuel-recovery-mfr-q22026.html). These support terminology, not a customer's applicable tariff or a particular bilingual equivalence. The curated alias dictionary remains versioned, bounded and reviewed; vague handling labels do not become equipment-transfer charges because their amounts happen to agree. Marine Fuel Recovery and other fuel-charge mechanisms remain separate concepts. Customer rates, identifiers, document contents and derived sample metrics do not enter this record.

## Bounded JSON budgets

Per-document extracted/reviewed facts allow 64 KiB, while aggregate analysis snapshots retain 128 KiB. Generated results have a separate 512 KiB bound because each invoice-line explanation includes its relevant conditions and evidence; this does not expand HTTP request bodies or PDF upload limits. Result size is checked before persistence and excess results fail without a partial result. Additive attachment rejects a newly associated oversized fact transactionally; read-only access to earlier unsupported sources retains warnings. Boundary regressions cover supported larger facts, review rejection and oversized generated results.

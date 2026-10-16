# Reusable agreements and explicit operation selection

Date: 2026-10-16. Status: implementation contract; delivery tracked in the task record and `docs/status.md`.

Planning execution: `/root/planning`, independently consulted by the coordinating implementation agent. Profiles read: product-manager, logistics-domain, solution-architect, ux-designer, visual-designer. This is preimplementation planning, not an implementation review or evidence of real-company validation.

## Confirmed scope

An operator uploads an annual agreement once, reviews its conditions and reuses its immutable version on multiple operations. Each invoice in an operation has an explicit choice of saved agreement or operation-specific spot quote. A provider can have both annual and spot business; provider identity alone never selects the contractual basis. Different invoices/providers in one operation can use different agreements.

Email ingestion, automatic supplier recognition, ERP connectors, OCR/LLM generalization, automatic payment approval and claim sending remain excluded. The existing extraction/review pipeline can populate candidate values; no claim is made that arbitrary kilometer tables are extracted automatically. Missing values require explicit review.

## Screens and behavior

1. **Tarifas y acuerdos** in the organization navigation. List name, provider, reusable/spot basis, validity, source PDF and version. Empty state offers creation. Creation chooses an existing private tariff/quotation PDF or uses the established upload flow; no duplicate upload is required. Review provider, service/route scope, validity, currency and pricing terms before saving. Required fields show inline labels/errors.
2. **Operation detail / Acuerdos por factura.** For each linked invoice, display supplier, current selected agreement/version or “Sin acuerdo seleccionado”. Writer actions: use saved agreement, create reusable agreement, or create spot quote. Saved choices show provider, scope and dates before confirmation; conflicting candidates remain separate. A spot quote belongs only to this operation. Selection never assumes every invoice from the supplier uses the same commercial basis.
3. **Applied basis and analysis.** Show selected source PDF/version, applicable date, route/service and distance when required. State what is missing or incompatible before and within analysis. Replacing/removing a selection requires an audited reason and makes older runs/claim sources stale; preserve historical results. Existing matches cannot imply verified service performance.

Use current panel, table, button, dialog, typography and spacing primitives; a compact section in the operation detail fits the current visual hierarchy. No visual redesign, decorative financial graphics or new dependency is needed. Text labels accompany statuses. All actions and dialog recovery operate by keyboard, mobile forms remain readable, and viewer state omits mutation controls while retaining evidence reads. A conflict preserves the draft and explains refresh/retry.

## Contracts and invariants

- Tenant-owned immutable agreement records, each identified by its own UUID and retaining original private document ID, reviewed source provenance, provider, applicable service/route scope, validity dates, currency and bounded typed pricing terms. Publication is an explicit review confirming accepted commercial conditions, not an internal estimate. Replacing terms creates another independent immutable agreement record; existing selections retain their exact UUID until explicitly reselected. Grouped contract identity, sequential version numbers and a version-lineage editor are outside v1; do not describe them as shipped.
- Selection is per organization/operation/invoice-document, referring to an exact agreement version. Store operation-specific service date, scope and optional decimal distance. Writes include current operation fingerprint and reason. The invoice must currently be linked to the operation; the source PDF and agreement must belong to the same tenant; a spot agreement must belong to that operation. Reject foreign resources without disclosure.
- Suggested endpoints: tenant-scoped agreement list/create/version creation; operation agreement selection set/remove. Reuse verified current membership, owner/admin/analyst write versus viewer read, Origin policy, body bounds, safe errors and no-store responses. Backend owns final shared Zod schemas and communicates names before frontend work.
- `collectAnalysisInputs` is the authoritative integration point. Include selected immutable version, contextual applicability and source document/checksum/extraction/review lineage in the fingerprint and queued snapshot. Embed immutable selected terms for replay. Add an optional binding list defaulting to empty for historical snapshot compatibility. No worker rereads mutable agreement terms.
- Reusable source facts may have no operation reference. Do not rewrite their original reference to the current operation or make the parser pretend the PDF names it. Explicit snapshot bindings connect invoice to agreement and carry operation applicability separately. Legacy directly linked tariff/quotation evidence remains supported; an explicit selection takes precedence for its invoice without silently adding competing references.
- Composite organization foreign keys and transaction-level resource checks protect cross-tenant relations. Agreement versions are never overwritten or deleted while referenced. Selection mutations advance operation revision; existing stale analysis/export guards continue to apply. Persist actor, time and reason atomically.

## Kilometer calculation contract

Pricing is explicitly one of fixed price, price per kilometer, or distance band. A band separately declares fixed total per trip or rate per kilometer; this cannot be guessed from a displayed number. Use bounded decimal strings at transport/persistence boundaries and Decimal calculations. Define finite bands as lower-inclusive/upper-exclusive; both bounds are required and the UI explains boundaries. Reject overlaps and invalid ranges; gaps and the final upper boundary produce a missing-tariff result unless another explicit band covers that distance. Distance is positive and reviewed, with no map or automatic route estimation in this scope. Missing distance, service date, provider, scope, expired terms or currency mismatch produces not-verifiable rather than a matched invoice. Comparison uses exact decimal arithmetic with no implicit currency rounding, FX, tax merging or tolerance. A per-kilometer band applies its rate to the entire reviewed distance, not marginal segments. Per-kilometer invoice lines must explicitly use unit `km` and quantity equal to the reviewed distance; fixed-trip pickup requires quantity one and unit `trip`, while base maritime service requires quantity one and unit `service`. Unsupported invoice units remain not verifiable. Evidence for reviewed terms identifies the original PDF/page and distinguishes manual review from extraction.

## Acceptance and negative cases

- Save one annual transport tariff once, select it for two operations without copying/uploading its PDF, and obtain deterministic expected prices for reviewed distances.
- One operation selects annual Traginers terms and spot Hapag terms for their respective invoices. Another Hapag invoice may use annual terms explicitly.
- A new annual version does not alter any old operation selection, queued snapshot, completed result or exported claim evidence. Explicit reselection creates stale state and a new analysis preserves history.
- Verify exact distance boundaries, fixed-trip versus per-km distinction, decimal precision, gaps/overlaps, missing distance/date, incompatible scope and currency, expired terms and unaccepted estimates.
- Viewer, revoked member, foreign tenant invoice/agreement/source, unlinked invoice and another operation's spot quote cannot mutate or leak resources. Optimistic conflict cannot overwrite a concurrent selection.
- Browser acceptance covers create/reuse/spot, missing-data feedback, source/version visibility, keyboard/dialog recovery, mobile layout and stale result notice. API/database acceptance covers tenant constraints, audit, immutable history and snapshot replay. Existing quality and service smoke gates remain required when infrastructure is available.

## Existing integration points consulted

`packages/contracts/src/analysis.ts` defines strict normalized facts, snapshots and operation fingerprints. `packages/application/src/analysis.ts::collectAnalysisInputs` assembles authoritative inputs. Prisma `Operation`, `OperationDocument` and composite tenant constraints establish association patterns. `apps/web/src/features/operations/operation-detail.tsx`, the organization tab routing and existing document upload/review flow provide UI integration. ADRs 0005 and 0006 govern immutable analyses and stale claim guards.

# Contract/invoice comparison planning — 2026-10-20

Execution: `/root/extract_plan`. Preimplementation product-manager, logistics-domain and solution-architect consultation; profiles applied sequentially within this distinct planning execution. This is not code-review approval.

Scope: attached reference plus invoice flow, multilingual concept identity, provisional versus definitive comparisons, original/billed currency and period semantics. Read AGENTS.md, WORKFLOW.md, relevant profiles, implementation plan, reusable-agreements plan, pilot requirements and ADR 0008. Inspected current contracts (`analysisLineSchema`, `analysisDocumentSchema`), `sameCharge`, `decideAgreement`, evaluation guards and application snapshot/fingerprint construction, plus existing JSON fact/result persistence.

## Decisions

See ADR 0010. Existing attached source/fact revisions suffice; no mandatory agreement publishing or new persistence entity. Add optional bounded result observations for source-price comparison independent from applied findings. Reuse source tariff price/currency, and add an optional evidenced line price period only when explicitly present. Candidate discovery and alias recognition do not verify applicability. Existing accepted/provider/scope/date requirements remain effective for definitive or claimable results.

## Risks to close during implementation

- High: current early FX guard can hide valid same-original-currency observations; split dimensions rather than weakening billed-currency checks.
- High: provisional unit-price differences must never enter confirmed financial totals or claims. Guard all result consumers.
- High: bilingual aliases must retain charge scope, billing basis and equipment semantics. Never equate concepts via price matching or broad service identity.
- High: document validity must not imply a dynamically varying surcharge was fixed on service date. Preserve explicit price period/restriction semantics.
- Medium: parallel new observations must not duplicate definitive invoice findings or repeated candidate rates.
- Medium: existing strict JSON schemas and 16 KiB document-fact budget require measured payload verification; repeated evidence cannot silently drop a source.

Acceptance: attached source+invoice yields per-invoice observations or specific pending reasons without requiring separate publication; invoice and reference IDs/versions and evidence survive; optional historical contracts remain readable. Informational offsets preserve each discrepancy and never yield automatic net claims. No private-derived values, counts or identities are included here or permitted in committed fixtures.

Status: planning passed for bounded implementation; implementation diff, UI/accessibility, security and QA review remain separate. No production code changed by this execution.

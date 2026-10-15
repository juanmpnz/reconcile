# Independent architecture, security, data and integration review — explainable analysis

Reviewer: `/root/analysis_architecture`, separate execution from production implementation by `/root/analysis_backend` and `/root/analysis_product_domain`. Scope: ADR 0005 planning and independent source review of pure financial rules, structured PDF facts, shared contracts, operation/fact/run schema and migration, application authorization/snapshots/jobs, worker recovery, HTTP routes and QA test source. This reviewer owns only the ADR and this record; no production implementation or acceptance tests were authored here.

Status: passed independent source review after the corrections below, against the working tree based on main `14813331075cbe7996de66e7a2ff26027bbc4c18`. Actual PostgreSQL/API/worker execution remains a separate CI acceptance requirement; this approval does not claim it ran here. Source fingerprints below delimit this review.

## Planning and inspected sources

Read AGENTS.md, expert workflow and architect/security/data/integration profiles; README, architecture overview, implementation plan, pilot requirements, ADR 0004, existing document application/worker/contracts/parser and new ADR 0005. Contracts were shared before dependent implementation: explicit tenant operation/document association, reviewable page-text facts and effective scalar corrections, immutable input/provenance snapshots, versioned pure rules, durable outbox and fenced leases, historical staleness and financial review boundaries.

Commands run so far: source inspection through `cat`, `sed`, `rg`; `pnpm exec vitest run packages/sector-rules/src/logistics/evaluate.test.ts` passed 21/21 at the intermediate engine source and 23/23 after the precision and tax cases were added. This unit execution is not proof of HTTP/PostgreSQL/BullMQ behavior. QA HTTP suite source inspected independently; actual infrastructure execution remains the coordinator/CI responsibility.

## Findings tracked

- AR-A1 high: ocean-handling tariff conditions originally ignored route and could select another scope. Corrected to require explicit route for every supported service and filter applicability before ambiguity selection; independently reread and 21 rule tests passed, including scope cases.
- AR-A2 medium: blank provider/service identities could match; invalid calendar dates were lexically compared. Corrected nonempty identity matching and calendar round-trip validation; shared contracts/parser require equivalent validation. Engine, shared-contract and parser fixes independently reread.
- AR-A3 high: immutable normalized snapshots originally omitted explicit captured checksum/extraction-version/correction-revision/fact-revision provenance, retaining only an opaque fingerprint. Resolved: immutable `sources` JSON records checksum, extraction ID/version, correction revision, fact revision and source fingerprint; independently reviewed schema, migration, request assembly and DTO.
- AR-A4 medium: fact review originally allowed changing document classification from invoice to agreement. Resolved: source extraction and kind must match the linked current fact; reviewed the guard and tenant/run checks.
- AR-A5 high, raised by coordinator: latest fact revision ordered by timestamp/random UUID could select an older revision for same-millisecond writes. Resolved: reserve ordinal through the serialized operation revision update, uniquely constrain organization/operation/ordinal and select descending ordinal. Reviewed application, schema and SQL migration.
- AR-A6 high: agreement line currency was parsed then discarded, allowing header EUR and explicit line USD to become one EUR condition. Resolved: adapter captures explicit agreement line currency and only creates a price condition when it matches the document currency, otherwise warning. Tax currency is independently checked too.
- AR-A7 high: conflicting scope/acceptance conditions used last-match-wins ordering. Resolved: conflicting scopes yield null plus warning; conflicting accepted/estimate bases yield unknown plus warning. Calendar dates normalize invalid inputs to null.
- AR-A8 medium: valid bounded PDFs with too many supported lines/evidence or oversized scalar values could make operation/history collection throw schema errors. Resolved: collector catches unsupported structured facts and returns document-scoped warnings; per-document 16 KiB limit rejects reviewed oversized facts and omits unsupported derived facts with warnings. Immutable run inputWarnings preserve that limitation historically. No financial lines are silently truncated.
- AR-A9 medium, raised by coordinator: operation detail embeds 20 full snapshots/results and can grow very large under polling. Resolved: latest five full runs plus paginated metadata history/single-run detail; each input/result limited to 128 KiB, facts limited to 16 KiB per document and at most 20 documents. Existing array/string counts and latest 100 review metadata records bound the remaining response. Reviewed no oversized failed result is persisted.
- AR-A10 medium, raised by coordinator: manual review actor/reason/time retained only in DB and unavailable to operators. Resolved: operation DTO exposes latest 100 structured review IDs, document IDs, actors, reasons, monotonic ordinals and timestamps. Complete review history remains in PostgreSQL; full review-history pagination is a documented future capability.

QA test source feedback: currency/expiry fixtures needed explicit valid route/service scope so tests isolate currency/expiry rather than pass for missing scope; queued run must be corrected before processing to prove immutable frozen inputs; add real stale-worker fencing and persisted retry-budget recovery. The final 12-group HTTP test source was independently reread: fixtures now isolate valid scope before currency/expiry assertions; the queued run is edited before execution; Prisma-boundary fault injection tests real stale-worker fencing and persistent attempt exhaustion. This source review passed. It does not assert runtime success.

- AR-A11 high: result size validation ran after assigning result; failure originally retained the oversized result for persistence. Resolved: every processing error clears result before terminal commit, and revoked access also clears result. Independently reread the final error and commit paths.

## Reviewed source fingerprints

SHA-256, captured before any subsequent coordinator formatting-only pass:

```text
de80d0c8d32f0a2833ca3f6ee8cf2f0a42823b49dc833770a3c79ef5b3858d2c packages/domain/src/analysis.ts
d80ea3ea33b5c32ded06409c916f8428d8dc8c519c1d9cf55684ae1b373e457c packages/sector-rules/src/logistics/evaluate.ts
2c6507d53824ebd1f581535d22aba5650fe90fbdde9911fdacda7c18b4ae92ee packages/sector-rules/src/logistics/evaluate.test.ts
93618faf99e8e50013f3bfad5ce78ae83e6f50854f4012fdd451e86bd76ff26b packages/contracts/src/analysis.ts
fe623a4ce35746700e58f542ae5df756d5aee361cecb3618c7e5bc6dac9c8341 packages/document-processing/src/analysis-facts.ts
d95f121cde372346eed81241fadb32cf410bdf9f2272126f83a49cc4e07c5903 packages/application/src/analysis.ts
6e66fc8bac4f6ea31c9ae6ac14fafaf7be854552f9eabd0406aba1497a8e08b5 apps/api/src/analysis.routes.ts
bc7c9704f90af14eeb2d46ef9a78be4a5744c5e785abcd6a4bbf0a643d74b3a2 apps/worker/src/analyses.ts
94c8c18dbceac6f03abb3d05fb46e357782a6d5e5b317f4600b9f87e05d865d7 packages/database/prisma/schema.prisma
40e8585d6e9ce8cbe0077f16f1bec9b8721c2db8ead644458a5ada3da364679c packages/database/prisma/migrations/20261015190000_analysis/migration.sql
4f2badaa1c8c82e9168594927fe32097248e53e39e17a642ba8fc874a56c371e apps/api/test/analysis.integration.test.ts
```

## Verification limits

No production/company documents, external ERP, OCR/LLM, financial approval or deployment readiness were tested or implied. Synthetic rule tests and reviewed test source do not replace actual service integration evidence. All findings listed above are resolved in reviewed source. No critical/high source findings remain open; service acceptance and the documented rollout limitations still apply.

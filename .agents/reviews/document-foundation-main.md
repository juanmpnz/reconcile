# Document foundation — coordinator/product/domain/platform

Reviewer `/root`, sequential (author/coordinator, not independent). Task 2026-10-15-document-foundation. Read AGENTS, workflow, manifest, principal/product/logistics/platform profiles, architecture, plan and product requirements before implementation.

## Before implementation

Product/domain acceptance fixed in docs/product/document-intake.md; new business rule/comparison decisions excluded until phase3. UX planning by /root/identity_ui_review and architecture/security/data/integration planning by /root/harness_architecture precede dependent implementations. Specialists /root/identity_frontend and /root/identity_backend own production areas; /root/harness_qa owns real HTTP test fixtures/suite and separate browser checks. Root owns fixture generation, dependency lock, task, docs and publication.

Public reference reviewed: Maersk export invoice template (two-page PDF) on 2026-10-15, URL in docs/product/demo-document-references.md. It supports the choice of invoice metadata/charge columns only. Fixture companies/references/conditions/prices are wholly synthetic; no copied branding or confidential data. Template retrieval and failed other source opens are honestly recorded.

Four original synthetic PDFs generated with reportlab using reproducible fixtures/logistics/generate.py; all four rendered with pdftoppm and inspected: no clipping or overlap. Text extraction of the actual four PDF byte files with the production built adapter succeeded: carrier212.00 USD, transport62.00, agreement150.00 and operational total null/missing, all expected labeled candidates with page1 snippets. Expected results are isolated under fixtures/logistics/expected-results and not supplied to the parser.

Primary dependency documentation consulted: PDF.js API getDocument/text controls; AWS SDK v3 S3 GetObject/PutObject examples; BullMQ job IDs and idempotent jobs (links in document-processing runbook). Pinned PDFJS selected by implementation after officialdocs/registry check; existing SDK/queue versions remain lock-controlled. No AI/OCR provider credential needed.

## Verification closure

Implementation and final CI/browser/security reviews pending. This record does not certify a completed phase or independent approval. Exact final source, commands and limitations will be added after review.

## Final local/source review

Full local pnpm check completed with26unit tests,8harness regressions, strict application/test types, lint, formatting and builds. After the final fenced-lease/backend compensation and loader busy-group corrections, targeted application/API/worker/web types/lint and actual parser probes passed. QA added10real-service document cases alongside21identity cases; their source uses actual PostgreSQL/storage/parser with explicitly scoped transport/commit-ack fault injection for recovery tests, not fabricated extraction.

Independent source review by /root/harness_architecture closes high stale-worker, retry-budget and uncertain-commit compensation findings. Independent browser execution /root/documents_browser_qa passed12/12groups, including final exposed busy group, reduced motion, retained selected file across fresh permissions, correction provenance, viewer controls,320/390px, keyboard and200%zoom. Root also viewed desktop document table/detail and320px detail screenshots: compact monochrome, no clipping or oversized typography. Browser fixtures do not prove real-service authorization.

Platform correction after clean-build inspection: API test types import the worker's public documents export. Root typecheck now builds worker after shared packages before noEmit workspace checks, so a clean CI checkout does not depend on stale dist artifacts. Targeted worker build and API/test typecheck passed. Executable source current072ec5af355129807053519ea1d651832b340620; initial evidence run superseded by38706903198. Final runtime and evidence gate remain pending.

Acceptance limits retained: no OCR/table understanding/AIprovider, no operationalJSON importer, no financial comparisons or claim actions. Application's direct Prisma/concrete-extractor dependency is an explicit bounded tradeoff in ADR0004; pure financial domain remains separate. Orphan storage cleanup is documented/manual, not atomic distributed storage/DB transaction. No real-auth browser E2E, full screen-reader audit or customer-format accuracy guarantee.

## Real-service evidence iteration

Run38706903198 on072ec5af passed frozen install/check/infra/migrations and all21identity cases, but7document cases failed (24/31total); smoke was skipped. This is not treated as a gate-only failure. Root and QA independently reproduced PDF extraction under Vitest: transformed import.meta.resolve was unsupported, whereas the built Node adapter worked. The adapter now resolves the fixed installed PDF.js module with Node createRequire plus pathToFileURL, with two real-byte regressions (valid carrier evidence and malformed PDF). Root and independent QA ran2/2 successfully. Wrong MIME now returns415 in the authorized onRequest guard before text-body parsing. No integration assertion was weakened. Corrected source requires another complete real-service run before verification.

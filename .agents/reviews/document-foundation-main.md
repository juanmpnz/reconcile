# Document foundation — coordinator/product/domain/platform

Reviewer `/root`, sequential (author/coordinator, not independent). Task 2026-10-15-document-foundation. Read AGENTS, workflow, manifest, principal/product/logistics/platform profiles, architecture, plan and product requirements before implementation.

## Before implementation

Product/domain acceptance fixed in docs/product/document-intake.md; new business rule/comparison decisions excluded until phase3. UX planning by /root/identity_ui_review and architecture/security/data/integration planning by /root/harness_architecture precede dependent implementations. Specialists /root/identity_frontend and /root/identity_backend own production areas; /root/harness_qa owns real HTTP test fixtures/suite and separate browser checks. Root owns fixture generation, dependency lock, task, docs and publication.

Public reference reviewed: Maersk export invoice template (two-page PDF) on 2026-10-15, URL in docs/product/demo-document-references.md. It supports the choice of invoice metadata/charge columns only. Fixture companies/references/conditions/prices are wholly synthetic; no copied branding or confidential data. Template retrieval and failed other source opens are honestly recorded.

Four original synthetic PDFs generated with reportlab using reproducible fixtures/logistics/generate.py; all four rendered with pdftoppm and inspected: no clipping or overlap. Text extraction of the actual four PDF byte files with the production built adapter succeeded: carrier212.00 USD, transport62.00, agreement150.00 and operational total null/missing, all expected labeled candidates with page1 snippets. Expected results are isolated under fixtures/logistics/expected-results and not supplied to the parser.

Primary dependency documentation consulted: PDF.js API getDocument/text controls; AWS SDK v3 S3 GetObject/PutObject examples; BullMQ job IDs and idempotent jobs (links in document-processing runbook). Pinned PDFJS selected by implementation after officialdocs/registry check; existing SDK/queue versions remain lock-controlled. No AI/OCR provider credential needed.

## Verification closure

Implementation and final CI/browser/security reviews pending. This record does not certify a completed phase or independent approval. Exact final source, commands and limitations will be added after review.

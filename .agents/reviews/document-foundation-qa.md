# Document foundation — bounded QA evidence

Reviewer: `/root/harness_qa`, separate execution from document implementation. Owns the test-only shared identity fixture, document integration cases and this record. This execution does not independently certify its own added test code; architecture has been asked to review that delta. Browser UI fixture verification is separately owned by `/root/documents_browser_qa`.

## Acceptance and test design

Read AGENTS.md, the QA profile, `docs/product/document-intake.md`, `docs/design/document-workspace.md`, the shared document contracts, API routes, storage/extraction service and actual document worker/outbox implementation.

The existing 21 identity HTTP cases retain their test bodies and use extracted common test support. Document tests reuse that real registration, captured-mail verification, cookie, organization and invitation flow. Separate synthetic client-IP prefixes avoid cross-suite login rate-limit collisions. No authentication, Prisma persistence or PDF parser is replaced with a mock.

The ten document integration cases use actual PostgreSQL, private S3-compatible storage and the production worker/service code:

1. Authenticated PDF upload persists document/run/outbox intent before dispatch; authorized original download is byte-identical and attachment/nosniff/sandbox protected; anonymous direct storage access is denied; actual PDF extraction persists page/snippet evidence. Corrections append ordered revisions without changing the original extraction or bytes. Redelivery does not duplicate effects.
2. A transaction wrapper waits for an actual PostgreSQL commit and then throws a synthetic lost-acknowledgement error. The production compensation path must retain the readable original and a single document/run/outbox.
3. Concurrent same-tenant duplicate uploads create one document/run/outbox; the same PDF in another tenant creates an independent document without a duplicate disclosure.
4. Non-PDF bytes, wrong content type, oversize, control-character/traversal/malformed-encoding filenames, unsupported kind and hostile Origin reject before document/outbox creation.
5. Every list/detail/download/upload/correction/retry boundary enforces tenant and current membership. Viewer reads are allowed but writes fail. Membership revocation invalidates access immediately.
6. Magic-valid malformed PDF becomes an explicit failed extraction with no fabricated fields; original remains downloadable. A valid textless PDF requires OCR, and a real operational fixture with no total preserves an explicit missing field.
7. Forged worker scope fails; a revoked queued actor is blocked; an authorized actor retries into a new immutable run; stale-run correction fails.
8. Removing a real synthetic original from S3 drives the persisted storage retry budget: two transient failures, third terminal failure/outbox completion, fourth delivery without a new attempt.
9. A controlled delayed storage-read wrapper holds an old worker after its real database lease claim. After expiry and another worker's actual S3/parse completion, releasing the stale worker with a synthetic transport failure must not reset the winning state/result or duplicate audit effects.
10. The production dispatcher publishes durable intent to actual BullMQ. Removing that published Redis job and aging its dispatch timestamp simulates loss; production recovery republishes and the actual consumer completes exactly one run.

The acknowledgement and delayed-read wrappers are explicit transport-fault injection. They are not presented as an observed real network outage. The winning parser/storage operations and persistence remain real. Supplied source PDFs come from `fixtures/logistics/source-documents/`; evaluation answers are not fed to the product. A small original ASCII PDF builder supplies only the textless negative case.

## Checks already executed

- API source/test strict TypeScript check: passed.
- ESLint for all changed integration/support files: passed.
- Prettier for changed test files: passed.
- `git diff --check` for changed test files: passed.

Independently fetched GitHub Actions run `38706903198`, job `116328446723`, source `072ec5af355129807053519ea1d651832b340620`. Full `pnpm check`, infrastructure startup and migrations passed. Actual integration execution reported **24 passed / 7 failed (31 total)**: all 21 existing identity cases passed, and 3 of 10 document cases passed. Smoke and the final evidence gate were skipped after the integration failure.

The seven failures remain blocking. Six exercise extraction-dependent paths: an isolated local Vitest probe with the actual carrier PDF reproduced `TypeError: __vite_ssr_import_meta__.resolve is not a function` at `packages/document-processing/src/extract.ts:34`, before the isolated parser worker starts. The temporary diagnostic was removed; no acceptance assertion was weakened. The invalid-intake case also observed a wrong-content-type request return generic 400 body-length rejection instead of the required early 415. Backend and coordinator have both been notified. Backend then replaced the unsupported resolution call with Node `createRequire` plus `pathToFileURL` and moved MIME rejection into upload `onRequest`. Independently ran the backend-authored actual PDF adapter regression: **2/2 passed**, covering carrier page evidence/total and malformed `PDF_INVALID`. The document integration assertions remain unchanged. New actual-service execution is still required.

This executor cannot run its local PostgreSQL distribution as root; no restriction bypass was attempted. The assertions above remain test design except for the explicitly observed run results.

## Verdict and limits

Status: changes required after actual-service execution; corrected runtime acceptance pending. Browser loaders and document UI will have a separate explicitly synthetic fixture report. No real-company documents, external OCR/AI provider, financial comparison, real CargoWise connection, production mail or payment flow is covered. Final acceptance must name the independently observed CI revision/run and retain the distinction between real-service and controlled-fault/browser evidence.

# ADR 0004 — private document ingestion and durable extraction

Status: accepted implementation contract; delivery and verification are tracked separately. Date: 2026-10-15. Architecture/security/data/integration planning: `/root/harness_architecture`, coordinated with `/root/identity_backend` and `/root/identity_frontend`. Product acceptance: `docs/product/document-intake.md`. ADR 0004 was unused when this decision was created.

## Scope and boundaries

Phase 2 accepts tenant-owned PDFs, preserves their original bytes, extracts actual embedded text and candidate fields, and records human corrections without overwriting extraction evidence. It does not compare charges, approve invoices, generate financial findings, send business emails, post accounting entries or make payments. Scanned PDFs require OCR that is not implemented in this delivery. No external AI service, mailbox or CargoWise connection is implied.

Keep the modular monolith: the API authorizes and stores requests; application services define document use cases and ports; PostgreSQL stores business state, extraction versions, corrections and durable work intent; a worker processes document jobs; private S3-compatible storage holds originals. PDF/parser and storage/queue SDKs stay outside pure domain rules. Create only the packages used by this flow.

Accepted bounded Phase 2 tradeoff: the initial `packages/application` document service uses Prisma directly and invokes the concrete PDF extraction adapter. Storage is injected through a port, and parsing remains isolated in its own module, but the application package is not yet fully independent of persistence/extraction adapters. The pure financial domain remains independent. Do not describe this implementation as complete ports-and-adapters isolation. Introduce an extraction port when a second extractor is required, and isolate persistence behind repositories when an actual replacement/testing need justifies it; avoid a late framework refactor to claim an unused abstraction. This tradeoff does not relax tenant, evidence, idempotency or recovery invariants.

`packages/contracts/src/documents.ts` is the shared transport source, owned by the backend implementation. Frontend consumers use those schemas instead of guessing a second DTO. The initial field names are `provider`, `documentNumber`, `operationReference`, `date`, `currency` and `total`. Monetary candidates remain text/decimal strings; extracted text does not become a trusted accounting amount.

## HTTP and authorization

Use `/api/v1/organizations/:organizationId/documents` for list and upload, `/:documentId` for detail, `/:documentId/download` for the original attachment, `/:documentId/retry` for a new extraction request and `/:documentId/corrections` for an appended correction. Upload/retry/correction return the shared full detail shape. Listing returns `{items,total,limit,offset}` with bounded pagination. No public object key or storage credential is part of a DTO.

Every route checks the current verified session and current membership in the existing organization UUID tenant. Owner, admin and analyst may upload, retry and correct; viewer may read only. Selecting an organization in the browser or session is never authorization. Queries for documents, runs and corrections include the organization boundary. Missing and foreign resources use a non-disclosing not-found response. Verify an uploader's access before storage side effects and, where possible, before buffering upload bytes.

All unsafe application routes enforce the same exact trusted-Origin/Fetch Metadata policy as auth writes. Better Auth's native organization hooks do not automatically protect these new routes. Validate payloads and headers; do not infer access from client capabilities, filename, document contents, queue payload or an S3 key. Private metadata/download responses use `Cache-Control: no-store`. UI queries include user and organization identifiers, and remain gated on a fresh successful context check.

## File handling and private originals

The first upload protocol is raw `application/pdf`, with validated filename and kind metadata, not multipart or browser-direct S3 upload. Maximum size is 10 MiB, enforced while receiving bytes, independent of Content-Length. Validate MIME and PDF signature; parsing determines whether a purported PDF can actually be processed. Reject invalid type/size without a document job. Treat filename as display metadata: bound and sanitize it, never use it as a storage path or reflect control characters into headers.

Generate storage keys from server-owned tenant/document identifiers. An original is immutable: new bytes create a new document/version identity; never overwrite an old original under the same key. Deduplicate identical checksums only within the same organization. A duplicate returns the existing record without duplicating jobs or silently changing its original metadata. An identical file in a different tenant remains independent and must not disclose cross-tenant existence.

S3 and PostgreSQL do not share a transaction. Write original bytes privately, then commit document metadata plus the first run/outbox intent in PostgreSQL. On persistence failure, delete only the newly created object on a best-effort basis. Concurrent checksum duplicates must retain the committed original and compensate only the losing upload's object. Track/document recovery for objects left without metadata after a crash; do not describe storage writes as atomically committed with the database.

Downloads authorize using the persisted document relationship and stream from its server-owned key. Return an attachment with a safely encoded filename, PDF content type and `X-Content-Type-Options: nosniff`. Do not inline active PDF/HTML in the application, accept arbitrary remote source URLs, or expose a public/persistent presigned link. The text/field review uses escaped text. This is not a malware-scanning or universally safe-PDF claim.

## Extraction limits and evidence

Use a pinned Node-compatible PDF.js adapter on actual uploaded bytes. Text extraction runs outside the HTTP process in a terminable parser worker/thread, with a 10-second deadline, 128 MiB managed-heap resource limit, at most 50 pages and at most 200,000 extracted characters across the entire document. Kill/terminate timed-out parsing; Promise.race alone around CPU work is insufficient. Use a separately bounded document concurrency, initially one, so parser work cannot starve queue leases or the platform ping worker.

Supply bytes rather than a URL to PDF.js, disable evaluation and unnecessary font/network loading, do not execute embedded actions or follow document URLs. An isolated Node thread is a resource control, not a claim of an OS security sandbox or a total native-memory bound. No parser subprocess/thread receives storage credentials or unrestricted document-specified locations. Use bounded inputs/outputs and fixed failure codes; logs exclude raw bytes, extracted text and secrets.

An immutable extraction run records its version, engine `pdfjs-text-v1`, bounded page text, six field candidates and warnings/failure code. Each candidate is extracted, missing or ambiguous. Retain a one-based page and bounded source snippet when evidence exists; absent data is null, never invented. Confidence is not fabricated as an unmeasured percentage. Encrypted, malformed, over-limit, timed-out and textless documents produce explicit outcomes; textless/scanned files identify the missing OCR capability. Valid text extraction initially ends in `needs_review`; `ready` must not imply financial correctness or be assigned automatically merely because parsing succeeded.

## Model and immutable review history

Keep the original `organizations` UUID table as the only tenant identity. Model document metadata, versioned extraction runs, append-only field corrections and outbox intent. Use composite organization/document/run constraints where relationships cross these models, in addition to application checks. Enforce uniqueness of `(organizationId,sha256)` for original deduplication and `(documentId,version)` for extraction history.

Separate mutable execution status/lease metadata from immutable terminal run content. A retry creates a new run version and durable intent; it does not rewrite a failed or previously reviewed extraction. A correction references the exact run and field, records actor, value and reason, and appends an event. Validate that the run belongs to the same document/organization. Derive effective values from the original plus ordered corrections, while retaining original evidence and older corrections. Null is an explicit correction value, not permission to invent missing evidence. Corrections do not mark a bill approved.

## Durable jobs, retries and recovery

Create the run and outbox intent in the same PostgreSQL transaction as the business-state change. The dispatcher publishes a stable UUID job identifier to BullMQ and persists publication state afterward. Queue payload contains identifiers only; the worker reloads the persisted outbox/run/document and verifies all tenant relationships. It rechecks that the initiating actor remains a current owner/admin/analyst before processing; a revoked/downgraded actor produces a blocked run, which another authorized actor may explicitly retry.

BullMQ/Redis are delivery mechanisms, not financial/business state. Duplicate delivery and retries must be harmless. Claim a run atomically with a bounded lease/fencing identity; commit a result only while owning the current claim. A completed run is not parsed or corrected again merely because a duplicate job arrives. A stale parser may not overwrite a result after a recovery worker takes over. Bound retry attempts/backoff and store safe failure state visibly.

Reconciliation must recover both failed publication and jobs lost after an outbox row was marked published. Inspect PostgreSQL nonterminal runs and stale leases; re-enqueue missing or incorrectly completed queue work using idempotent transitions. A stable queue job ID alone is insufficient after Redis data loss or job removal. Test duplicate workers/delivery, Redis interruption, repeated outbox dispatch and stale-run recovery before describing business processing as reliable.

## Verification and rollout limits

Required real-service acceptance covers authorized upload/list/detail/download, all cross-tenant/revoked/viewer failures, write Origin rejection, original-byte checksum, same-tenant duplicate races, private bucket denial, extraction over actual synthetic PDFs, malformed/oversize/scanned outcomes, append-only corrections with intact evidence, queue replay and Redis recovery. Keep expected fixture answers separate from parser input. Browser fixture tests demonstrate loaders/review interactions only; they do not prove real-auth or document extraction accuracy.

Keep the existing identity/platform gates. Real-data rollout still requires the previously documented MFA, trusted proxy, storage/retention/backup and security controls. This ADR is a bounded design decision, not evidence those controls or this pipeline have shipped.

Primary implementation references consulted: https://mozilla.github.io/pdf.js/api/draft/api.js.html, https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html, https://docs.bullmq.io/patterns/idempotent-jobs, https://docs.bullmq.io/guide/jobs/job-ids, https://docs.bullmq.io/guide/jobs/stalled and https://docs.bullmq.io/guide/retrying-failing-jobs. Recheck the pinned library interfaces during implementation.

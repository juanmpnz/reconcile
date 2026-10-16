# Reusable agreements — independent architecture, data and security review

Date: 2026-10-16. Reviewer: `/root/security_review`, a separate execution from the backend/domain/frontend implementers. Roles: security-engineer, data-engineer, solution-architect. Review mode: independent. Verdict: **passed for the source state examined**, with real-service acceptance still required before delivery is marked verified.

## Examined state and scope

Base commit: `4d15708fb7bcbf12aca83abf20212ad016dbf59c`; reviewed the uncommitted feature changes after backend's ready message and the subsequent decimal-validation/source-suppression corrections. This review does not approve unseen later changes.

Read AGENTS.md, .agents/WORKFLOW.md, the three role profiles, README.md, architecture overview, task brief, `docs/plans/reusable-agreements.md`, and ADRs 0005/0006. Examined agreement contracts, application create/select/list/detail, authoritative analysis collector and document-link update, API routes/registration, Prisma schema/migration, logistics evaluator, existing document authorization/metadata flow, and claim source/export freshness integration. Read the initial agreement API integration tests; those tests were not executed by this reviewer.

Examined source checksums (SHA-256):

- `packages/application/src/agreements.ts`: `e4656c7f7c9565d4e1936468b799df99e5a76d54e7d3e1af5a3fc898b0458332`
- `packages/application/src/analysis.ts`: `c41c33d79a24a27d0667cd4905a3761005504b5bfd505efbf085703e77a53ded`
- `packages/contracts/src/agreements.ts`: `97fac505a11171720e7bd2927adb1cc80f940c94377dd6a3ce40f40b7e893c63`
- `packages/database/prisma/schema.prisma`: `e25fa6aa49487d37d72682cda446dd5787c4d5837f4b3a99c17bf80cadfefcba`
- migration `20261016130000_agreements`: `cfb36437d0104903ba793b772f88e9bc846d2878ee0217abc5f9445145aa24df`
- `apps/api/src/agreements.routes.ts`: `264c9a5fbd0fcb5b9a0adbe1c5f65016bf64caafae1c93b66092605c4a311c8d`
- `packages/sector-rules/src/logistics/evaluate.ts`: `7c97efb42e51e4b4b852ab3971c5ba9b8b0618d9e0bd773d970b4e1c595c72ab`

## Findings and disposition

1. **High, resolved — missing database provenance/link constraints in initial draft.** The initial binding model had no invoice-link FK and source extraction ID had no source-document FK. The examined migration/schema now constrain organization/operation/invoice to OperationDocument and organization/source document/extraction run to ExtractionRun. Tenant-scoped agreement and operation FKs, scope CHECK, referenced-version restrictions and immutable UPDATE trigger protect the persistent model. Application checks additionally enforce invoice kind and spot-operation ownership. Runtime FK/migration execution remains QA's responsibility.
2. **High, resolved — implicit accepted basis.** Initial reviewed terms omitted accepted/internal-estimate/unknown, allowing estimates to establish prices. Examined contracts now require agreementBasis; evaluator rejects non-accepted terms before financial comparison. Human-reviewed evidence carries the immutable agreement UUID as revisionId, preserving the distinction from extracted facts.
3. **Medium, resolved — malformed decimal input could throw in validation.** Initial continuable Zod refinements called BigInt on arbitrary strings after a failed regex. The examined scaled helper first validates the bounded decimal format and returns safely for malformed text; the regex still rejects it. Transport validation no longer needs to throw to reject invalid amounts.
4. **Medium, resolved — mutable selected source metadata could re-enter facts.** Initial collector suppressed a selected source only while its current kind was not invoice. Examined collector suppresses the selected source by ID regardless of current metadata and appends pinned checksum, extraction, correction and metadata provenance. Re-extraction cannot silently reinterpret published reviewed terms.
5. **Low, accepted behavior — conservative shared-source handling.** Once a source PDF is explicitly selected anywhere in an operation, its mutable linked copy is omitted globally. Other invoices need their own explicit selection of that agreement rather than implicitly reusing its legacy facts. Backend confirmed this intentional conservative behavior; product documentation must describe it. Unrelated legacy linked tariffs remain supported.

No open critical/high findings in the examined state.

## Invariants checked

- API mutations require exact allowed Origin, reject cross-site fetches, obtain a fresh verified session and query current membership/role; viewer writes are denied. Service mutations repeat current authorization inside their transaction. Resources use tenant-qualified queries, generic safe errors, bounded requests/pagination and private no-store responses.
- Publication checks private tariff/quotation source, current completed extraction and actual page/snippet identity, then stores immutable reviewed terms plus actor/reason and pinned source lineage. No document content is executed or logged.
- Selection locks the operation, checks authoritative current fingerprint, validates current linked invoice and same-tenant exact version, forbids another operation's spot quote, uses decimal persistence, advances revision and audits full before/after contexts atomically. Equivalent selections preserve fingerprint and history. Differential document-link changes preserve retained selections and remove only unlinked bindings.
- Analysis fingerprints include complete immutable binding/version/context; queued snapshots embed reviewed terms and source lineage. Workers consume the snapshot and do not reread current terms. Old snapshots/results are not rewritten. Existing claim creation/export guards recompute collectAnalysisInputs, so explicit reselection makes old claim sources stale without altering historical exports.
- Independently confirmed coordinator scope: version replacement uses a new immutable UUID with explicit reselection; stable agreement groups/ordinals and unbounded distance bands are deferred. This is narrower than the original planning draft and must remain explicit in final docs.

## Evidence and limits

Executed `pnpm exec vitest run packages/sector-rules/src/logistics/evaluate.test.ts`: **passed, 43 tests**. Read integration cases for source/evidence/Origin isolation, immutable UPDATE rejection, spot reuse denial, stale edit, pinned snapshots and FK failure; requested additional viewer/revoked-member and extraction-FK cases from backend.

This reviewer did not execute PostgreSQL/Redis/S3, migrations, integration API tests, browser acceptance, deployment, restore or production access checks. Source review and pure tests do not establish real-service correctness. Full quality gates and CI/service acceptance remain required and must be attributed to their actual examined SHA.

## Independent platform scope extension

At coordinator request, also read the platform-engineer profile and inspected the added browser CI job, root dependency/lockfile diff and QA-authored `apps/web/test/agreements.browser.mjs`. Verdict: **passed source review**, execution pending CI. Existing quality, integration, migration, worker smoke and harness gates are preserved. The new job uses Node 24, frozen installation and exact Playwright 1.62.1 with matching playwright-core/integrity entries; upstream Node >=20 compatibility is consistent. Browser binaries are installed explicitly in CI. No new production dependency or credentials are introduced.

The job binds Vite preview to loopback, bounds runtime, cleans its process, retains failure diagnostics and uploads only synthetic QA screenshots. GitHub permissions remain contents-read. The browser script intercepts API requests with synthetic fixtures and explicitly does not claim backend authorization or extraction validation; it asserts actual DOM interactions and fails on runtime errors. Chromium `--no-sandbox` is confined to the ephemeral CI browser on synthetic fixtures, not an application deployment setting. `node --check apps/web/test/agreements.browser.mjs` passed in this reviewer execution. No browser execution is claimed.

Examined SHA-256: CI workflow `cf54ed0c4fa2ff771b0536b5e7c930376510e50a30e9aad68cf6fa934af1d30a`; root package `2b3d3a6a21836111d65f3f40c212cc336e9a02e2e3975cd6ec70cce58b96bfb0`; lockfile `377739957bd2b2a16b2b14244c2b3928b5c51e4593825d9a3b3a78080b57cf3c`; browser suite `6a271b734a079c096221c6d8f01a6e03b2646088632ded1922b139c0d3ab7de8`.

## Independent document-parser scope extension

Read document-ai-engineer profile and independently inspected the narrowly extended `analysis-facts.ts` table syntax and new parser tests. Verdict: **passed**. The change accepts explicit km/KM/Km alongside existing service/trip units and normalizes units only. It preserves raw decimal strings, original document/extraction/page/snippet provenance and missing-row warnings; it does not infer distance, service, money or contractual acceptance. Document text remains data and the bounded extractor has no connector/model execution. Source SHA-256: `3d9d48cf4651aeb254566269d845598bf582055010ab071ec03d27ed08135255`.

Independently executed `pnpm exec vitest run packages/document-processing/src/analysis-facts.test.ts packages/contracts/src/agreements.test.ts`: **6 tests passed** (4 parser, 2 contracts), including malformed decimal rejection without exceptions and high-precision overlap validation. These synthetic text cases do not establish arbitrary real-PDF/OCR coverage.

## Final backend incremental re-review

Re-examined backend's final source update, schema/migration and added integration assertions. Verdict remains **passed**. Composite source, spot operation and agreement-version references now use `NO ACTION` instead of `RESTRICT` consistently in Prisma and SQL. This keeps standalone referenced deletes forbidden while permitting statement-end checks for a simultaneous organization cascade. No tenant key was removed. Actual cascade behavior awaits CI database execution.

The added self-source guard prevents selecting a published source as its own invoice after a document-kind edit. Read newly added viewer write denial/revocation, unrelated extraction FK rejection, actual expected-price finding, linked-source provenance stability, replacement staleness, immutable old result and full contextual audit assertions. This reviewer did not execute those service tests.

Final examined SHA-256: agreements service `114aba228da604497b0a6bd97a98a50b94687c613e995ffdc3584aa0baa5e702`; collector `d35ec536afca994fad0629cddf05356c41fdda5b3b0dcfa63e8578cbd048d853`; schema `2f1115bb6de44f6724d040eed36210ca469f765599deccb0855a4e7f33f5c027`; migration `1a8cca1a8a8e6aa99fca57d52f1fc25177996c32ad48e335951f5ab1a8785c30`.

# Explainable analysis — QA execution record

Reviewer: `/root/analysis_qa`, canonical role qa-engineer. QA authored `apps/api/test/analysis.integration.test.ts`; test authorship is sequential implementation, not independent review of those tests. Backend, parser, domain engine and frontend implementation were authored by other executions. Architecture reviews the test source independently.

## Scope and acceptance

Read AGENTS.md, expert workflow, QA/logistics profiles, README, architecture overview, implementation plan, product pilot requirements and explainable-analysis acceptance. Existing private-document acceptance is retained.

The new suite uses real Better Auth/Fastify requests, actual uploaded PDF bytes, private S3 originals, PDF.js extraction, PostgreSQL facts/snapshots and the production comparison engine. It does not inject expected extraction or financial outputs. Test-only capture of identity emails is inherited from the existing identity fixture. Synthetic ASCII PDF construction supplies original source bytes, not parsed results.

Twelve HTTP/runtime groups cover:

1. Four existing demo PDFs automatically derive the excluded 62 USD pickup with evidence from all four documents; repeated job does not duplicate completion. Ocean handling in the old invoice has no explicit scope, so it deliberately receives no automatic matched-price conclusion.
2. Missing and expired agreements remain not verifiable. Expiry fixtures otherwise have explicit matching scope and accepted basis.
3. Currency mismatch has no implicit conversion; pickups in distinct trams have no possible-double-billing conclusion. The explicit carrier exclusion can still be shown separately.
4. Positive and negative line differences remain visible when their sum is zero; source invoice includes explicit scope.
5. A price-matching invoice produces only a scoped matched-price finding; it never asserts payment or service approval.
6. A run queued before a source correction retains its original snapshot when processed after the correction; old results remain immutable and stale after source/link changes.
7. Tenant, viewer, fresh membership, foreign resource and mismatched run/operation access rejection.
8. Stale fingerprint and forged extraction/evidence rejection; accepted human revision provenance persists in the analysis snapshot.
9. A revoked queued author is blocked; an authorized owner can create a distinct replacement run.
10. A controlled delay before a real Prisma commit allows a lease to expire and another real worker to win; the stale worker cannot overwrite its result or duplicate the audit.
11. Controlled commit transport failures persist attempt counts across delivery; the next recovered delivery terminates the exhausted budget without a result and further deliveries do nothing.
12. HTTP request idempotency, forged job scope rejection, actual Redis job deletion and durable outbox republishing followed by real BullMQ execution.

## Fault injection boundaries

Fencing uses a Prisma proxy only to delay the transaction boundary; the actual transaction executes after release. Retry-budget testing throws only at that commit boundary. Auth, extraction, snapshot, rule evaluation and persistence outside the declared boundary remain real. Lease/outbox timestamps are advanced directly in the isolated test database to avoid minute-long waits. These are controlled failure tests, not claims of physical network-loss testing.

## Checks so far

- `./node_modules/.bin/prettier --write apps/api/test/analysis.integration.test.ts` — passed.
- `./node_modules/.bin/tsc -p apps/worker/tsconfig.json` — passed at the initial complete backend source.
- `./node_modules/.bin/tsc -p apps/api/tsconfig.test.json --noEmit` — passed at the initial complete backend source.
- `./node_modules/.bin/eslint apps/api/test/analysis.integration.test.ts` — passed.
- Additional local direct actual-PDF extraction/derivation/engine smoke — first PDF hit the existing `PDF_TIMEOUT` during concurrent CPU-heavy work; no financial output was produced. No parser timeout was changed. Requires CI runtime evidence before closure.
- Real PostgreSQL/S3/Redis acceptance — pending CI execution; not certified by compilation.

## Limits

All business evidence is synthetic and does not establish document accuracy for real carriers or confidential data. No physical disaster recovery, corporate SSO/MFA, production deployment or full screen-reader certification is claimed. Browser interaction QA is a separately attributed execution; it must remain distinct from actual-service HTTP acceptance.

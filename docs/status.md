# Implementation status

## Phase 0 — historical baseline

Implemented: workspace, TypeScript and lint configuration, React foundation showing actual readiness, NestJS/Fastify health endpoints, PostgreSQL schema/migration, BullMQ platform ping worker, local infrastructure, Docker targets and CI with service smoke.

At phase0closure only the platform ping job existed; document processing and financial analysis were implemented in the later phases below. Claims remain unimplemented. Phase 1 identity is described below. No remote system is connected. Local verification passed: formatting, lint, strict TypeScript, five tests and production builds. API liveness returned 200; readiness correctly returned 503 with unavailable dependencies. Complete service smoke, dependency startup, migration and anonymous bucket denial passed in GitHub Actions for commit 63dcd20a0d2eee7501dc3137b31d334bb740982c: https://github.com/juanmpnz/reconcile/actions/runs/38614690917. Docker container targets themselves have not been built in this environment.

## Next

1. Close the operation usability verification described below before Phase4.
2. Phase4: human finding decisions, reviewed claim drafts and export; no automatic email/accounting writes.
3. Phase5: server deployment with HTTPS/private storage, backups, restore and deployed end-to-end verification.

## Expert harness

Implemented sixteen canonical roles, shared workflow, generated Codex/Claude adapters, task/review records and additive CI validation. Independent architecture and QA reviews completed; eight negative/positive harness regressions passed. See .agents/tasks/2026-10-14-expert-harness.json for evidence and scope. Native client discovery is not verified in this cloud runtime. The harness does not implement future business phases.

## Phase 1 — identity

Implemented verified email/password access, recovery, organizations/invitations, owner/admin/analyst/viewer ACL, fresh membership-scoped context and bounded session/context audit. Added local Mailpit and real PostgreSQL/Fastify integration tests. At d43d78571a36e709b487e969d6d81485f401c294, frozen install, pnpm check (8 harness regressions and 10 unit/config tests), migrations, all 18 identity integration cases and complete API/worker/private-bucket smoke passed in https://github.com/juanmpnz/reconcile/actions/runs/38621534018. That evidence-collection run intentionally remained blocked at the final harness gate until the task record was verified. The final metadata change closes that review; it does not change auth code. This stage is not production ready.

Obra Community is accepted as design reference. Initial responsive native-control auth screens are functional source implementations; exact Figma node/fidelity verification remains pending. Corporate SSO, MFA, ownership transfer and trusted proxy topology are not implemented. Real-data rollout stays gated on these security/deployment requirements as applicable. Document, invoice and business-job authorization will be implemented and tested with those endpoints; current isolation evidence covers identity, native organizations and workspace context.

## Development startup diagnostics

API startup now reports bounded stages, safe configuration field names and recognized listener/network errors; failed initialization closes resources with a deadline. This addresses missing diagnostic visibility, not an established fix for the user's Mac failure. An available-port tsx bootstrap was reproduced in the executor; the original local cause still requires the user's resulting diagnostic. Existing authentication behavior is unchanged.

## Development API port

Local pnpm dev defaults to API 3001 and Vite proxies to that same validated DEV_API_PORT. Existing .env PORT=3000 is preserved for direct start/deployment; no local source edit is required to avoid a competing application on3000. Frontend/auth origin remains localhost:5173. PostgreSQL host mapping is independent and remains an explicit local infrastructure setting.

## Identity interface redesign

Implemented compact monochrome identity UI, reusable controls/Radix dialogs, organization search/table, native paginated members and invitation state/invite/cancel views. Account/recovery/verification/invitation flows are preserved. The design specification is docs/design/identity-interface.md and the current-scope guide is docs/user-guide.md. Independent source/accessibility/security review and14/14 browser UI fixture groups passed; fixtures are not real-auth browser E2E. Real PostgreSQL HTTP acceptance21/21,23 unit tests,8 harness regressions, migrations and full service smoke passed for source999e4c76127beaecf95cdaa968987579849e8e73 in https://github.com/juanmpnz/reconcile/actions/runs/38700626741. That evidence-collection run remained blocked only by the unverified task gate; its final documentation closure does not change executable source. See .agents/tasks/2026-10-15-identity-interface.json for exact scope and limits. No invoice capability, pixel-fidelity or production-readiness claim.

## Phase 2 — document implementation and loading feedback

Implemented scoped accessible loading components in current identity/document flows, compact document table/upload/detail, private authorized PDF originals, real PDF.js text extraction, six labeled candidate fields with page/snippet evidence, explicit missing/OCR/error states and append-only corrections. PostgreSQL records versioned extraction runs and durable outbox intent; worker processing uses current actor authorization, fenced claims, bounded attempts and lost-job reconciliation. Architecture/limits: ADR0004 and docs/runbooks/document-processing.md. Four marked synthetic PDF inputs and isolated evaluation expectations live in fixtures/logistics; public structure references documented, no copied brands or confidential data.

This is a bounded text/label extractor, not universal invoice/table recognition. No OCR, external AI, JSON operational importer, CargoWise connection, comparison motor, claim or payment action is included. The application service currently couples to Prisma and the concrete extraction adapter; the pure domain remains separate. Source implementation, real-service acceptance and browser evidence are tracked independently in .agents/tasks/2026-10-15-document-foundation.json. For source b9d6881a018162598b8f9f1f753a31340f99605a, frozen install/fullcheck passed28unit+8harness, migrations and31/31realHTTPcases(21identity+10documents) passed, and full API/PostgreSQL/Redis/privatebucket/worker smoke passed in https://github.com/juanmpnz/reconcile/actions/runs/38707704961. Independent browser12/12groups passed with explicitAPIfixtures. That evidence-collection run stopped only at the pendingverifiedtaskgate; final documentation closure changes no executable source. The prior service-run failures and correction are retained in review history. This closes the bounded document intake/review step, with the stated scope limits; it does not claim OCR, complete invoice understanding, real ERP import or production readiness.

## Phase 3 — explainable comparison implementation

Implemented organization-owned operations, explicit document association, structured facts from existing actual PDF page text, review revisions/reasons/provenance, versioned deterministic logistics rules and immutable asynchronous analysis snapshots. UI exposes per-line expected/invoiced/difference/currency/reason/evidence, current versus historical runs and stale-input warning. Durable PostgreSQL outbox, current actor permissions, bounded attempts/fenced leases and lost-job reconciliation extend the document foundation. Details/capacity limits: ADR0005; current flow: docs/user-guide.md.

The original fourPDF demo supports pickup62 from explicit exclusion plus matching operation/service/date/route and transport invoice/performance. Missing ocean-handling scope remains no-verifiable until source review; no scope or exchange/tax condition is invented. There are no financial approval, finding decision, claim or send actions; those remain phase4. For source793afc70a715724f59882193bed764692e55d313, run38714946560 passed frozeninstall/fullcheck55unit+8harness, migration,43/43realHTTP(12analysis+31baseline) and completeAPI/PG/Redis/privatebucket/worker smoke. TestedPRmerge24d9827c72c4a03b79837dd16f55f51868070a05 has the identicaltree. Onlypendingverifiedtaskgate failed in that evidencecollection run. FinalUX-A4warningpresentation adds two targetedprivacytests(types/lintpassed); independentlyrebuiltReactbrowser17/17groups passed finalUIwith explicitAPIfixtures. Finalclosure changes presentation/task/docs, with API/domain/schema/jobs/tests unchanged since actualserviceacceptance. FinalCIchecks the completecandidate. Exactscope/limits in .agents/tasks/2026-10-15-explainable-analysis.json. No production, arbitraryPDF, ERP or realcustomer accuracy claim.

## Operation usability — before Phase 4

Source implementation adds operation name/reference editing on the same operation, explicit document association management, optimistic conflict protection and atomic before/after audit through an additive nullable JSONB migration. Originals and historical analysis snapshots/results remain unchanged. Material edits advance the existing operation revision, making prior results stale without changing fingerprints for untouched prior operations. Metadata/association edits wait while an analysis is queued or processing.

The operation screen puts results first, uses semantic status colors with icons/text and counts controls without summing money. Native accordions collapse documents, review data and history. Reference warnings show expected/found values before analysis; missing references remain unknown. Evidence is grouped and exactly deduplicated only within the same document/extraction/review/page/snippet, with compact expandable excerpts and access to all unique citations. Existing correction reasons/history and source extraction remain available. Financial rule, parser, queue and external integration behavior is unchanged.

Independent architecture/security/data source review is complete. Full checks, independent UX/browser checks and actual PostgreSQL/Redis/S3 HTTP/migration/smoke execution are being collected for this change; earlier-phase results do not verify it. See `.agents/tasks/2026-10-15-operation-usability.json` and `docs/design/operation-usability.md`. No server deployment or new environment variables are included.

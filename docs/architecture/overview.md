# Architecture

Modular monolith with separate web, API and worker processes. Phase 0 established operational health endpoints. Phase 1 adds Better Auth identity APIs and membership-scoped workspace context; Phase 2 adds private tenant-scoped PDF intake, extraction and append-only review; Phase3 adds tenant operations and immutable evidence-based comparisons.

Domain depends only on decimal arithmetic. Config validates environment without disclosing values. Contracts defines transport schemas. Database owns Prisma and migrations. API assembles adapters; worker owns BullMQ consumers. Web consumes HTTP contracts through TanStack Query.

Application/document-processing/auth packages now have executable responsibilities. Future connectors and logistics comparison rules are created when used; no placeholder connector claims compatibility with CargoWise.

Readiness checks PostgreSQL, Redis and the private S3 bucket; liveness confirms only the API process. Neither endpoint confirms functional correctness of billing or tenant security. Keep health endpoints private behind infrastructure routing in production.

The original organizations UUID table is now the tenant source for Better Auth. auth_members is the only membership/role source. The workspace context endpoint reads a current verified session and current database membership; activeOrganizationId is never authorization.

Redis queues are not financial state. Document jobs use PostgreSQL outbox intent, tenant checks, versioned runs and fenced leases; recovery checks must cover lost published jobs and repeated delivery. Analysis runs use separate durable intent, immutable snapshot/provenance, current actor checks and a versioned pure logistics engine. See ADR 0004 and the document-processing runbook for limits and verification evidence.

Phase3 specific limits and provenance: ADR0005. Page-text facts are candidates; reviewed values append revisions. Snapshot, result and source warnings are immutable per run. Older history is read on demand rather than included in each poll.

Phase4 review and claims: ADR0006. Human decisions append to a separate review counter, preserving the analysis input fingerprint. One stable claim per operation/invoice document keeps versioned source bindings, editable drafts, export evidence and manual follow-up. Financial source values come from the reviewed immutable result. Export and actual manual sending are separate events. Current source/review checks prevent issuing an obsolete draft; tenant authorization, optimistic concurrency and audit apply to each action. The export envelope omits storage credentials and public document links; originals retain their existing authorized download path. Server deployment, backups and restoration remain phase5.

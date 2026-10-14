# Architecture

Modular monolith with separate web, API and worker processes. Phase 0 exposes only operational health endpoints; it has no authenticated or business API.

Domain depends only on decimal arithmetic. Config validates environment without disclosing values. Contracts defines transport schemas. Database owns Prisma and migrations. API assembles adapters; worker owns BullMQ consumers. Web consumes HTTP contracts through TanStack Query.

Planned packages (application ports, document processing, auth, connectors and logistics rules) are created when used. No placeholder connector claims compatibility with CargoWise.

Readiness checks PostgreSQL, Redis and the private S3 bucket; liveness confirms only the API process. Neither endpoint confirms functional correctness of billing or tenant security. Keep health endpoints private behind infrastructure routing in production.

Initial organization table has no users or authorization. Phase 1 must map Better Auth organization records to this tenant identity, selecting one source of truth and migrating IDs if required. Do not add duplicated membership sources.

Redis queues are not financial state. Before business jobs, add transactional outbox, idempotency, tenant scoping and versioned analysis records. Recovery tests must cover Redis interruption and repeated jobs.

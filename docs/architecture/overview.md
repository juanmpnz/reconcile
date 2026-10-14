# Architecture

Modular monolith with separate web, API and worker processes. Phase 0 established operational health endpoints. Phase 1 adds Better Auth identity APIs and membership-scoped workspace context; invoice/business APIs remain unimplemented.

Domain depends only on decimal arithmetic. Config validates environment without disclosing values. Contracts defines transport schemas. Database owns Prisma and migrations. API assembles adapters; worker owns BullMQ consumers. Web consumes HTTP contracts through TanStack Query.

Planned packages (application ports, document processing, auth, connectors and logistics rules) are created when used. No placeholder connector claims compatibility with CargoWise.

Readiness checks PostgreSQL, Redis and the private S3 bucket; liveness confirms only the API process. Neither endpoint confirms functional correctness of billing or tenant security. Keep health endpoints private behind infrastructure routing in production.

The original organizations UUID table is now the tenant source for Better Auth. auth_members is the only membership/role source. The workspace context endpoint reads a current verified session and current database membership; activeOrganizationId is never authorization.

Redis queues are not financial state. Before business jobs, add transactional outbox, idempotency, tenant scoping and versioned analysis records. Recovery tests must cover Redis interruption and repeated jobs.

# ADR 0001 — Platform foundation

Status: accepted for implementation. Date: 2026-10-14.

Use pnpm, React/Vite, NestJS/Fastify, PostgreSQL/Prisma, Redis/BullMQ and private S3 storage. API and worker are separate processes in a modular monolith. Better Auth is selected for phase 1; it is not implemented in phase 0.

Use Node 24 across local development, CI and containers. Nest 11 and Prisma 6 are explicit baseline lines, pinned in package manifests and lockfile; choosing them does not claim they are the latest major releases.

MinIO is a local development S3-compatible test service, not a production vendor decision. Compose credentials and loopback bindings are exclusively for local synthetic data. Production requires rotated secrets, external backups and a storage provider decision.

Trade-offs: Redis is an additional service, selected for worker orchestration. A single Hetzner server does not provide high availability. Real CargoWise integration requires customer-provided technical access and capability validation.

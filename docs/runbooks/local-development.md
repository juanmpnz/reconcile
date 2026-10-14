# Local development

Requirements: Node 24, pnpm 11.25, Docker with Compose v2. Local ports 3000, 5173, 5432, 6379 and 9000 must be free.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The root migration command and app dev scripts explicitly load the root .env. Environment variables supplied by CI or deployment take precedence.

Web: http://localhost:5173. API liveness: http://localhost:3000/api/v1/health/live. Readiness: /api/v1/health/ready. Local S3 endpoint: http://localhost:9000. SeaweedFS mini creates the configured bucket and credentials on startup. Credentials in .env.example are only for local demo; no storage administration ports are exposed.

```bash
pnpm check
pnpm --filter @reconcile/worker smoke
pnpm infra:down
```

Smoke requires API and worker running and checks a real queued job, database, Redis and bucket. It does not test invoice comparison. `infra:down` preserves data; add `-v` only when intentionally deleting local volumes.

Docker builds from repository root: `docker build -f infra/docker/Dockerfile --target api .` (also worker, web). Deploy API/worker with environment variables and private dependencies. Containers set HOST=0.0.0.0; local development defaults to loopback. Web nginx expects API hostname `api:3000` on the same network. Production compose/Coolify wiring and TLS are pending; never expose the local dependency compose publicly.

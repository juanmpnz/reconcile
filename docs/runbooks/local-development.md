# Local development

Requirements: Node 24, pnpm 11.25, Docker with Compose v2. Local ports 1025, 3001, 5173, 5432, 6379, 8025 and 9000 must be free.

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm infra:up
pnpm db:generate
pnpm db:migrate
pnpm dev
```

The root migration command and app dev scripts explicitly load the root .env. Environment variables supplied by CI or deployment take precedence.

Web: http://localhost:5173. Development API liveness: http://127.0.0.1:3001/api/v1/health/live. Readiness: /api/v1/health/ready. Local S3 endpoint: http://localhost:9000. SeaweedFS mini creates the configured bucket and credentials on startup. Credentials in .env.example are only for local demo; no storage administration ports are exposed.

```bash
pnpm check
SMOKE_API_URL=http://127.0.0.1:3001 pnpm --filter @reconcile/worker smoke
pnpm infra:down
```

Smoke requires API and worker running and checks a real queued job, database, Redis and bucket. Its default URL remains localhost:3000 for direct/CI starts; the local command above selects the development API 3001 (adjust if overriding DEV_API_PORT). It does not test invoice comparison. `infra:down` preserves data; add `-v` only when intentionally deleting local volumes.

Docker builds from repository root: `docker build -f infra/docker/Dockerfile --target api .` (also worker, web). Deploy API/worker with environment variables and private dependencies. Containers set HOST=0.0.0.0; local development defaults to loopback. Web nginx expects API hostname `api:3000` on the same network. Production compose/Coolify wiring and TLS are pending; never expose the local dependency compose publicly.

## Accounts and organizations (phase 1)

After `pnpm infra:up`, open http://localhost:8025 for local verification/reset/invitation mail. Register at http://localhost:5173, verify through the local inbox and sign in. Mailpit uses synthetic development mail only. Never expose its SMTP/UI publicly. Keep AUTH_BASE_URL and WEB_ORIGIN equal to the public frontend origin; Vite/nginx proxy /api.

`pnpm test:integration` requires migrated isolated PostgreSQL and service environment variables. Use the CI environment as reference. Tests call real Better Auth through Fastify inject and capture only test mail in memory. NODE_ENV=test is set by vitest.integration.config.ts. The suite creates unique synthetic users/orgs and removes them afterward; never run it against a client database.

Production remains gated on privileged MFA, trusted proxy/rate-limit deployment configuration, transactional email delivery validation, backups/recovery and security review of real infrastructure. Current code does not enable corporate SSO or social login. Native controls/CSS provide functional auth screens; Obra is accepted as the design reference, but precise Figma nodes and visual fidelity still require verification.

## API startup diagnostics

A successful API boot prints `API listening on http://HOST:PORT`. A failure prints a bounded stage (`service-config`, `auth-config`, `identity`, `http-init` or `listen`), allowlisted network error code, and validated listener address when applicable. Configuration failures list invalid field names only. Raw error objects, stacks and environment values are not logged. Startup cleanup has a deadline and failure exits nonzero.

For `EADDRINUSE`, inspect the reported port with `lsof -nP -iTCP:3000 -sTCP:LISTEN` (substitute the reported port). Docker Desktop running is not proof that every Compose service started: run `pnpm infra:up` and `docker compose -f infra/docker/compose.yaml ps`.

If another project uses PostgreSQL port 5432, change only the host side of its Compose mapping (for example `127.0.0.1:5433:5432`) and the DATABASE_URL port to 5433. `pnpm dev` uses DEV_API_PORT (default 3001) for both the API and Vite proxy, independently of an existing PORT=3000 in .env. To select another development API port, change only DEV_API_PORT and restart dev processes; no source edit is needed. Direct production/start commands continue to use PORT (default 3000). AUTH_BASE_URL and WEB_ORIGIN remain the frontend origin (normally http://localhost:5173). Restart dev processes after editing .env. No existing external service needs to be stopped.

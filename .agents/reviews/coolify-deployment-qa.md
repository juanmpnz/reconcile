# Coolify deployment configuration — independent QA/platform review

Execution: `/root/analysis_qa`, roles qa-engineer and platform-engineer. Owns this review/evidence record only; production Compose, Docker/smoke and CI implementation belong to another execution. Read AGENTS.md, expert workflow, role profiles, architecture and implementation plan Phase 5. No React/application/business logic changes are authorized in this bounded task.

## Acceptance plan and boundaries

- Independently review production Compose environment interpolation, required secrets, private service network, persistent volumes, restart policies and resource/process boundaries. Public ingress should expose only web; PostgreSQL, Redis, storage and API must not publish public host ports.
- Build the actual Dockerfile api, worker and web targets, retaining strict Node/pnpm/lockfile and generated Prisma migration artifacts. A parsed Compose file does not establish a successful image build.
- Run one-off real migrations before application readiness, then verify web static content and same-origin `/api` proxy, API readiness, actual Redis worker ping and private-S3 access/anonymous rejection.
- If feasible, restart API/worker/stateful services using the same volumes/secrets and verify readiness and persisted state are retained. Distinguish container restart from host loss/disaster recovery.
- Keep existing 67 unit tests, 48 real-service HTTP groups and harness checks enabled. CI must exercise production-image smoke in addition to existing development-service acceptance, not replace stronger checks with liveness only.
- Use synthetic CI-only SMTP configuration; do not send real email or describe a configuration check as delivery validation. Stable auth/session and service credentials belong to deployment configuration, not disposable regenerated startup values.

Docker is unavailable in this local executor (`command -v docker` found no executable in the prior same-session infrastructure check). Local proportional checks can validate syntax/static contracts; actual image builds and stack smoke require CI and decoded logs attributed to the exact source/tested merge tree.

This bounded configuration check does not close all Phase 5: external backups, restoration rehearsal, deployed-domain TLS, operational alerts/metrics, full financial E2E on a real server and confidential-data controls remain separate. No high availability, real mail delivery or production deployment success is claimed at planning time.

Status: implementation/configuration review and runtime checks pending.

## Initial proxy finding

The existing Nginx configuration has no explicit `client_max_body_size`, while the API supports PDFs up to 10 MiB. Consulted the official [Nginx core directive documentation](https://nginx.org/en/docs/http/ngx_http_core_module.html#client_max_body_size), which defines the default as 1m and a 413 for larger bodies. A production deployment with that default would reject otherwise valid uploads before they reach application authorization/validation. Sent to the platform implementer: set a finite proxy body limit aligned with the application and include a >1 MiB proxy-path smoke check if feasible. No application limit should be relaxed to hide the mismatch.

Status: medium compatibility finding open pending configuration correction and actual image/proxy smoke.

## Independent candidate source review and proportional checks

Reviewed `infra/docker/compose.production.yaml`, `infra/docker/nginx.conf`, `infra/coolify/production-smoke.mjs`, the additive `production-smoke.yml` workflow and deployment runbook. Existing application/React/domain source and the original quality workflow remain unchanged. Consulted official Coolify Git Compose documentation for build strategy/path resolution, public domain internal-port routing, required interpolation, generated alphanumeric `SERVICE_USER_*` / `SERVICE_PASSWORD_64_*` values and preserving stored values on reload.

The proxy finding is corrected in source: finite `client_max_body_size 11m` permits the application to enforce its existing 10 MiB limit; operational health is blocked at public web ingress. The new smoke sends an actual valid PDF larger than 1 MiB through Nginx and waits for real worker extraction, then verifies downloaded original checksum. Runtime verification remains pending CI.

The Compose definition uses six bounded services with no host-published ports, only web exposed at 8080, a private data network, persistent PostgreSQL/Redis/S3 volumes and stable required secret references. API uses the existing production image target, runs real Prisma deploy before exec and gates web/worker on readiness. Redis is authenticated with AOF/noeviction and bounded memory below container allowance; API has application-network egress for SMTP, worker/stateful services remain on internal data network. CPU/memory/PID caps and rotating logs are explicit. These are pilot bounds, not measured production sizing.

Independent checks actually executed:

- `node --check infra/coolify/production-smoke.mjs` — passed.
- Scoped ESLint — passed.
- Scoped Prettier for Compose/workflow/smoke — passed.
- `git diff --check` — passed.
- PyYAML parse plus assertions for six services, no host ports, web 8080, internal data network, three volumes, all restart/resource limits, production build targets and common public auth origin — passed. This does not perform Docker variable interpolation.
- Invoked the smoke without its synthetic guard in a child Node process: actual module/dependency imports resolved, then it failed closed with the intended guard before Prisma/Redis/S3 clients connect. This is not a production-stack pass.

The smoke explicitly seeds a synthetic verified identity/credential in the isolated database, authenticates through real production HTTP and checks cookie attributes/Origin/private S3/upload/worker behavior; it does not test registration email delivery. Teardown/recreation preserves volumes and secrets, then checks persisted PostgreSQL, Redis, S3 sentinel and original PDF bytes. It cleans only its scoped synthetic fixtures. The production workflow is additive: existing unit/HTTP gates are retained independently.

Source review: passed with no remaining blocking config/smoke finding in the examined candidate. Real Docker target builds, Compose resolution, service startup, migrations, production smoke and recreation acceptance are pending CI; a user-server deployment/TLS/DNS/backup restoration is not claimed.

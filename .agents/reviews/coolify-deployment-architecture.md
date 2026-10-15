# Coolify deployment — architecture, security and data review

Reviewer: `/root/analysis_architecture`, independent from platform implementation by `/root/analysis_backend`. Owns this record only; no application/platform implementation authored. Read AGENTS/workflow, architect/security/data profiles, current Dockerfile, nginx, development Compose, config/auth validation, storage adapter, health paths and architecture status.

## Prior implementation decisions

Keep the application code unchanged. Use existing Dockerfile api/worker/web targets, with six long-lived services: web, API, worker, PostgreSQL, Redis and SeaweedFS. Only web receives a Coolify domain routed to its internal port 8080; API remains internally addressed as api:3000. Do not publish host ports or create domains for database/cache/storage/admin endpoints. Use the resource-specific network without enabling cross-resource predefined connectivity. API requires ordinary outbound DNS/SMTPS access, so an entirely internal Docker network is not appropriate for that process.

Prefer API start-command override running `prisma migrate deploy` through the existing database package before exec of the existing Node API entrypoint. Worker and web wait for API readiness, which means migrations succeeded before processing is usable. This avoids a seventh one-shot service and unsupported Coolify-specific health/exclusion keys. Ordinary Compose completion dependencies are documented by Docker, but no one-shot dashboard behavior is assumed for the user's Coolify instance. Migration failure must prevent serving/processing; do not ignore it or reset data.

Use NODE_ENV production, HOST0.0.0.0, PORT3000; auth base and web origin share the same user-supplied HTTPS APP_URL. The generated secret must be stable between redeployments. Coolify SERVICE_PASSWORD_64 identifiers generate alphanumeric passwords; use one-token identifiers without underscores inside the ID. Avoid hex secrets: the current auth validator requires at least 16 distinct characters, so a hex-only value can fail. Generated database/cache/storage credentials must be reused consistently, never baked as image build arguments or printed in diagnostics. APP_URL and real SMTP host/user/password/from are user-entered; port465 with secure TLS is the bounded supported deployment path, not Mailpit or test-capture mode.

Persist PostgreSQL, Redis AOF and Seaweed data in named volumes. Keep Redis noeviction and authenticated; S3 bucket private with authenticated app access. API and worker already run as node and web uses the unprivileged nginx image. Do not describe the inherited build-stage runtime as a minimized production image: it contains repository/development dependencies by existing design. Configure bounded CPU/memory/pids/log rotation and sufficient startup grace; check that parser worker limits and migrations fit the container memory. Never add privileged mode or host mounts merely to make startup work.

Health checks use installed tools: Node fetch for API readiness, wget for unprivileged nginx/Seaweed as appropriate, pg_isready for PostgreSQL and REDISCLI_AUTH for Redis without echoing passwords. API readiness checks database/Redis/private bucket, not just liveness. Prefer blocking public health routes in nginx while checking API directly internally. Nginx's default 1 MiB request body cap would reject supported PDFs; allow 10 MiB uploads in the API proxy location while retaining the application's existing receiving limit. No application change is needed.

## Official sources actually consulted

- https://coolify.io/docs/applications/builds/docker-compose — Git Compose resource, build/commands/dependencies, required variables, persistent generated values, single-token generated credential IDs and domain internal-port routing.
- https://coolify.io/docs/applications/configuration/health-checks — checks execute inside the container, required installed clients, startup grace and Compose-defined health checks.
- https://docs.docker.com/reference/compose-file/services/ — service_healthy/service_completed_successfully semantics and dependency ordering.

These are implementation guidance, not proof of the user's installed Coolify version or deployed stack. No undocumented labels or magic keys are accepted without an official source and concrete need.

## Required final source/runtime acceptance

Review resolved Compose with synthetic env without printing credentials, exact six-service ingress/dependency graph, persistent mounts, nonroot runtime, bounded resources/health commands, secret interpolation and build context exclusions. Build all three actual Dockerfile targets and smoke the production-like stack in CI: migrations before API/worker usability, same-origin /api proxy, PG/Redis/S3 readiness, unsigned bucket access denied, authenticated storage round trip, actual platform worker ping and container recreation preserving volumes. Startup/restart checks do not constitute an offsite backup restore.

Status: prior decisions shared before implementation; final independent config/script review pending. No user's server, real TLS certificate, SMTP delivery, deployed E2E, backup/restore or confidential-data readiness claimed. A single-server stack is not high availability; Phase5 operational acceptance remains explicit.

## Final independent source review

Passed against the working tree based on `38850fcf356b5b045caa8ed529b046b07ac7ba3e`. Independently inspected the production Compose, nginx change, production smoke script and additive CI workflow. Application sources, Dockerfile targets, financial rules and existing migrations remain unchanged.

The final topology has six services, no host-published ports, web-only exposure8080, internal data network for PostgreSQL/Redis/storage/worker and an additional egress/proxy-facing network for API. API migrates using the installed Prisma CLI then execs the existing entrypoint; worker/web require API readiness. Credentials interpolate only at runtime; generated alphanumeric values avoid URL escaping issues and auth hex-distinctness failure. Required SMTP credentials fail closed, while CI deliberately supplies synthetic non-delivery configuration. Nginx allows11MiB at the proxy while the unchanged API retains its10MiB receive limit and hides operational health publicly.

Resource limits now bound memory/CPU/PIDs: PostgreSQL512MiB/1CPU/128, Redis256MiB/0.5CPU/64 with96MiB noeviction/AOF headroom, storage1GiB/1CPU/256, API768MiB/1CPU/128, worker1GiB/1CPU/128, web128MiB/0.5CPU/64. These are pilot budgets, not measured capacity or throughput guarantees. Log rotation is bounded. Existing API/worker run as node and nginx is unprivileged; upstream database/storage entrypoint permissions remain their image behavior, not a claim that every infrastructure process is nonroot.

CDEP1 medium was found and corrected before closure: shell-based Redis command bypassed the upstream entrypoint's root-to-redis transition because its first argument was sh. The final Compose sets `user: redis` explicitly. Official upstream source inspected: https://github.com/redis/docker-library-redis/blob/master/docker-entrypoint.sh. The image/volume write permission must still pass the actual Docker smoke; source review does not claim that runtime result.

The additive smoke builds all actual application targets, validates migrations/readiness/proxy and production cookie flags, rejects hostile Origin, verifies anonymous bucket denial and authenticated storage, processes a real padded PDF larger than1MiB, checks original checksum, exercises the actual worker queue and recreates containers without deleting volumes before checking PostgreSQL/Redis/S3 persistence. Cleanup with volumes is restricted to the isolated synthetic CI stack. The script tests configured HTTPS auth semantics through internal HTTP, not a real TLS certificate/browser or SMTP delivery. No real customer data or external message is used.

Independent commands: `node --check infra/coolify/production-smoke.mjs` passed; Prettier check of Compose/script/workflow passed. An initial formatting invocation included nginx.conf, which has no installed Prettier parser; it was rerun on supported file types and no nginx formatting success is claimed. Docker builds/runtime, user's Coolify parsing/proxy, actual SMTP, server deployment and offsite backup restore remain pending external acceptance.

Reviewed SHA-256:

```text
5c8241012071d6d1e6d5a7ed802c797112eab882ca6942fc3cbbeb69b428d079 infra/docker/compose.production.yaml
afc33eb8b797255458401d44c8027042124f81b03a2fb267770693ed6914d1e9 infra/docker/nginx.conf
cd29d55ccfdf44d4e346726d8399f706c989a878207b1318f65d8dabbe2e3166 infra/coolify/production-smoke.mjs
590682f7e40836311874c0d5986d0d0163c72d98630fd58da0986b30ee9f9408 .github/workflows/production-smoke.yml
```

Final source status: passed independent architecture/security/data review with no open critical/high findings. This is deployment configuration readiness subject to actual Docker CI; it is not a deployed-server, delivery, backup/restore, high-availability or confidential-data certification.

## Reopened before Docker candidate — CDEP2 runtime DNS

Coordinator identified a blocking redeploy issue missed in the preceding source review: static nginx `proxy_pass http://api:3000` resolves the API address at startup. An API-only recreation may change its IP while an unchanged web image/container keeps running, leaving persistent proxy failure. Approval is reopened until the bounded nginx correction is reread.

Official Nginx upstream documentation confirms shared-zone `server ... resolve` is available without a commercial subscription from1.27.3, compatible with the pinned1.28 web image: https://nginx.org/en/docs/http/ngx_http_upstream_module.html. The proposed correction uses Docker DNS127.0.0.11 with a bounded valid period, shared upstream zone, API hostname resolve and unchanged URI-preserving proxy behavior. Add API-only recreation smoke while retaining the web container; assert proxy recovery. Do not claim the IP changed unless the smoke explicitly verifies it.

## CDEP2 correction reexamined

Incremental source approval reinstated. Final nginx uses Docker resolver127.0.0.11 valid5s/IPv6 disabled, shared64KiB upstream zone and `server api:3000 resolve`; proxy_pass retains the original request URI. This is supported by the pinned nginx1.28 image according to the official upstream reference.

The new CI step captures web container ID and start time, recreates only API with no dependencies, asserts web identity/start time unchanged and API container replaced, then polls the retained proxy for a valid get-session response. It reports when API addresses remain unchanged and explicitly declines IP-change recovery claims in that case. Actual execution remains pending; even a successful API recreation is not represented as a forced change of the web-facing API address unless that address is confirmed changed.

Corrective hashes: nginx `9b8e6fc087f7db48a2349dd26d298a47c612b90ce92c1bfda31f2eb033e72350`; CI workflow `2ac30bfc3786480dbe9c12f90c022eff61da0914a378039b7571d5a0476c2a34`. Compose/script hashes remain as captured above. Source review passed with CDEP1/CDEP2 resolved and no open critical/high findings; Docker CI and the previously stated server/SMTP/backup limits still apply.

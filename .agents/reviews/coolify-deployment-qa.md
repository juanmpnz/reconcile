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

## DNS/recreation delta review

Independently reexamined the final Nginx upstream shared-memory zone, `server api:3000 resolve`, and Docker resolver `127.0.0.11` with a five-second validity. Consulted the official [HTTP upstream documentation](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server): dynamic resolve is available in open-source Nginx from 1.27.3, compatible with the existing 1.28 image. No image/application dependency change was introduced for this correction.

The additive API-only recreation check requires a changed API container ID, unchanged web container ID and unchanged web start timestamp, then polls the actual web API proxy for recovery. It explicitly distinguishes a real address change from Docker reusing the same IP and does not claim changed-IP recovery if reuse occurred. Scoped workflow Prettier/YAML assertions passed. Runtime checks are still pending the production-image CI candidate `06ea1655d872a77b6f25ad14159d62660da594d5`.

## Actual production-image CI acceptance

Independently fetched decoded logs and job summaries for [Production containers run 38745992783](https://github.com/juanmpnz/reconcile/actions/runs/38745992783), job 116459663084. The production-smoke job completed with success. Source **`06ea1655d872a77b6f25ad14159d62660da594d5`** and tested PR merge **`dd5babe55c0e7f13cad55412b96048f2add4f3a7`** both have tree **`17927fd0d28a0112abfa1e2df1250df8a221cea9`**, independently verified through Git commit endpoints.

Actual Docker evidence on this pinned tree:

- Resolved Compose private topology validation passed.
- The actual Dockerfile **api, worker and web targets all built successfully**.
- Complete production stack started healthy after real migrations.
- Seed smoke passed: web/static HTML, same-origin API, private operational readiness, secure cookie attributes and hostile Origin rejection, required migration rows, authenticated S3 versus anonymous denial, actual valid PDF larger than 1 MiB through Nginx, worker extraction and original checksum download, Redis platform job and scoped synthetic identity.
- API-only force recreation passed while web container ID and StartedAt remained unchanged; API proxy recovered. **Docker reused the same network addresses** in this run, as explicitly logged. Changed-IP DNS recovery is therefore not claimed by this runtime result, although the dynamic DNS configuration was independently reviewed.
- Full container teardown/recreation without deleting volumes passed: persisted PostgreSQL organization/document, Redis sentinel, S3 object and original PDF checksum survived.
- Cleanup of the isolated synthetic stack passed. SMTP was configuration-only; no real verification message or email delivery was attempted.

The earlier proxy body-size compatibility finding is resolved by both the examined 11m configuration and this actual >1 MiB upload/extraction check. This is production-image/configuration acceptance in CI, not deployment to the user's Coolify server or external backup restoration.

The separate unchanged Quality workflow's 67-unit/48-HTTP/harness result is still pending final inspection; do not replace it with this production smoke.

## Retained Quality acceptance and independent closure

Independently fetched the complete job summary and decoded logs for [Quality run 38745992643](https://github.com/juanmpnz/reconcile/actions/runs/38745992643), job 116459664018, on the same source/tested merge above. Frozen install, full `pnpm check` (**67 unit tests**), existing real-service infrastructure and migrations, **48 HTTP groups**, and API/worker smoke all passed. The full Quality workflow conclusion is failure solely because the pre-closure task is not yet verified: `Task is not verified: 2026-10-15-coolify-deployment`. That collection run is not described as globally green.

Separately queried the production workflow resource: run 38745992783 is **completed/success**, not merely a successful intermediate step. No implementation changes were needed after its actual builds and acceptance.

Independent QA/platform source and runtime acceptance: **passed on source `06ea1655d872a77b6f25ad14159d62660da594d5` / tree `17927fd0d28a0112abfa1e2df1250df8a221cea9`**. No blocking finding remains in this bounded configuration scope. Final documentation/task-closure commit still requires its own final CI result. Preserve the same-IP runtime limitation and the separation from real-server TLS/DNS/SMTP delivery, external backups, restoration rehearsal and overall Phase-5 completion.

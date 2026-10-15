# Development API port architecture/platform review

Independent reviewer: `/root/harness_architecture`. Roles: solution-architect and platform-engineer. Implementer: `/root`. Verdict: **passed for the bounded development listener/proxy configuration change**.

Reviewed the working diff over `b0bd7d22e0769e9cc250e8dab663256bba0353e4`: `apps/api/src/dev.ts`, API development script, `apps/web/vite.config.ts`, shared development parser/export, web workspace dependency/lockfile change, example environment and local runbook/status. Production `main.ts`, service PORT defaults, Docker and CI listener behavior are unchanged. Authentication, UI and tenant/domain behavior are outside this change.

The shared parser defaults DEV_API_PORT to 3001 and validates an integer in 1–65535 without echoing invalid values. The dedicated development entrypoint overrides only its process PORT and rejects NODE_ENV=production before importing main. Existing .env PORT=3000 therefore remains usable for direct startup/deployment while pnpm dev uses the separate port. Vite reads the same root .env with Node parseEnv semantics and process-environment precedence; only the validated numeric development port enters its loopback proxy target. Environment contents are not returned as client defines. Using 127.0.0.1 avoids a localhost IPv6/default-bind mismatch. Vite production build configuration skips development-port parsing entirely.

The only lockfile addition is the existing workspace config dependency; no third-party dependency versions changed. Local smoke documentation selects the development API URL explicitly while retaining the direct-main/CI smoke default.

## Verification performed independently

- `pnpm --filter @reconcile/config build`: passed.
- `pnpm --filter @reconcile/api typecheck`: API source and tests passed.
- `pnpm --filter @reconcile/web typecheck`: passed.
- `pnpm --filter @reconcile/api build`: passed.
- Direct shared-parser probe: existing PORT=3000 yields development default 3001; explicit DEV_API_PORT overrides that value; zero, out-of-range, nonnumeric and synthetic secret input fail with fixed field-only text.
- Actual compiled development-entrypoint probe: NODE_ENV=production exits 1 with its fixed guard message before any API listener starts.
- Actual Vite resolveConfig probe: a process DEV_API_PORT override produces the matching 127.0.0.1 proxy; production build configuration accepts an invalid development-only value because it does not parse that setting.
- `git diff --check`: passed.

No unresolved architecture/platform findings in the reviewed source. QA/coordinator own actual default-port API/Vite runtime and broader checks; this record does not claim those runs were performed by this reviewer. The user's Mac and its occupied ports were not accessed. This change addresses the chosen local API port; it does not infer the cause of every prior startup failure, change PostgreSQL's independent host mapping, or stop another project.

# Development API port — independent QA review

Reviewer: `/root/harness_qa`, independent execution from implementer `/root`. Examined task `2026-10-15-development-api-port`, repository instructions, development launcher, shared configuration, Vite configuration, workspace dependencies and example environment. This execution changed only this review record.

## Examined revision

Bounded working-tree candidate, identified by SHA-256:

- `apps/api/src/dev.ts`: `35849b9c3e45171cdffd6abeb6bf25a6f865e65b46cd0056d79408ff78a9bde3`.
- `apps/web/vite.config.ts`: `6fff9a3ef3016858b51f13668d3fa57134fd75a2cca4207f36ce6b6e879eaeed`.
- `packages/config/src/development.ts`: `cae72d06786f8900dea62e9c0cf5ddfb1c33a3ea9d7942cb949c811197e01fb5`.

## Actual runtime probes

Spawned the real `apps/api/src/dev.ts` entrypoint with `node --import tsx src/dev.ts` from `apps/api`. Used example-environment values with `PORT=3000` and held a real loopback TCP listener on port 3000 throughout both probes. No application/auth factory or shared configuration was mocked.

1. Removed `DEV_API_PORT` from the child environment: API started on **3001**, logged the correct listening address, and `/api/v1/health/live` returned **200** with `status=alive`, despite occupied port 3000. Independently resolved the actual Vite config through Vite's `resolveConfig(..., 'serve')`; `/api` targeted **http://127.0.0.1:3001**.
2. Set `DEV_API_PORT=3002`: API started on **3002** and returned the same real liveness response. Vite's actual resolved proxy targeted **http://127.0.0.1:3002**.
3. Both children shut down on SIGTERM without watchdog SIGKILL; the held port 3000 and child listeners were released afterward.
4. Set invalid `DEV_API_PORT`: actual Vite serve configuration rejected it with the fixed field-name error. Resolving the build configuration with that same invalid variable succeeded, confirming the development listener setting does not block production builds.
5. Spawned `dev.ts` with `NODE_ENV=production`: child exited **1** with the explicit development-launcher guard, before any listening message.

The `node --import tsx` loader exercises the actual TypeScript entrypoint without this executor's standalone tsx CLI temporary-IPC restriction. It does not verify CLI watch-mode behavior on the user's Mac.

## Additional checks

- `./node_modules/.bin/tsc -p apps/api/tsconfig.test.json --noEmit`: passed.
- Source review confirms the same validated development setting drives both launcher and proxy. Vite reads the root environment with Node `parseEnv` and gives explicit process-environment values priority, matching the API script's Node env-file contract.
- Production `main.ts`, deployment start command and infrastructure listener configuration remain outside the development launcher; no production port change or authentication change is introduced.

## Verdict and limits

**Passed** for the scoped development-port acceptance. No unresolved finding in this review. No implementation or unit-test files were changed by this QA execution.

The user's Mac and its existing port-3000 process were not accessed. These probes do not claim database readiness, SMTP delivery, browser end-to-end proxy traffic, hot-reload/watch behavior or a deployed production smoke test. The Vite target was verified through actual configuration resolution; API listeners were verified through actual HTTP liveness requests.

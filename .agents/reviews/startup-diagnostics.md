# Startup diagnostics architecture/security review

Independent reviewer: `/root/harness_architecture`. Roles: solution-architect and security-engineer. Implementer: `/root`. Verdict: **passed for the bounded reviewed startup diagnostic change**.

Reviewed the working diff over `4b9b2fa2b624e6984c0b47348d00b1ba3a59d8cc`: `apps/api/src/main.ts`, `startup-diagnostics.ts`, `application.ts` and `test/startup-diagnostics.test.ts`. The change does not establish the cause of the user's Mac startup failure or alter authentication/tenant policy.

## Findings and resolution

- **START-SEC-01, medium, resolved:** initial diagnostic inspection could itself throw when an unknown error exposed a throwing `code` or `message` getter. That could escape startup error handling and allow raw unhandled-error output. The formatter now catches inspection failures and emits fixed text; regression cases verify both getters without reflecting their thrown secrets.
- **START-ARCH-01, medium, resolved:** initially unbounded `app.close()` / Prisma disconnect could prevent intended failed-startup termination. Cleanup is now bounded with a three-second deadline per helper invocation and clears the deadline timer. Main starts app/Prisma cleanup together; application initialization also bounds its local cleanup before propagating the original failure. Hung and failed cleanup tests passed. Nested initialization/main cleanup can consume successive deadlines, rather than one global three-second deadline.

Reviewed allowlisted system error descriptions and configuration field names. No arbitrary error message, stack, code or environment value is logged. The only listener address printed comes from already validated HOST/PORT. `abortOnError: false` allows Nest initialization errors to reach the controlled diagnostic path instead of silently exiting with disabled Nest logging. Auth request handling, authorization and cookie policies are unchanged.

## Verification performed independently

- `pnpm exec vitest run apps/api/test/startup-diagnostics.test.ts`: ten tests passed on the corrected candidate.
- `pnpm --filter @reconcile/api typecheck`: API source and test types passed.
- `pnpm --filter @reconcile/api build`: passed.
- `git diff --check`: passed before adding this evidence file.
- Built-process probe: occupied a loopback ephemeral port and spawned the actual compiled `main.js` using `.env.example` and that PORT. It exited with code 1, reported `stage=listen` / `EADDRINUSE`, and did not reflect the fixture database credential.
- Built-process probe: supplied a synthetic invalid AUTH_SECRET to the actual compiled `main.js`. It exited with code 1 and reported only `stage=auth-config` / `AUTH_SECRET`, without the supplied value.

Examined candidate SHA-256 fingerprints: main `bab53c522f62fac73f61caec52b8a803e93a238c2ec1d72a2429e6e156a9cd49`; diagnostics `6cfa707c7913ec111fe51830068e5cb9a2cef7ad52e8bff4963b55d45509ef46`; application `2a684e6d8ca72f3d504d75871463b210dc4a666b359a34e1265d027866aeb236`; tests `729268f649d29fec734694f6b693ce691e8a689d10573bf7b1e96399f9d88129`.

No unresolved critical/high finding in this scope. No Mac reproduction, new full identity/database regression, deployment verification or current CI success is claimed. Prior identity CI results belong to their previously recorded revisions. The user's actual stage/code remains to be observed with these diagnostics.

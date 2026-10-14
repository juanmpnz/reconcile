# Startup diagnostics — independent QA review

Reviewer: `/root/harness_qa`, separate execution from implementer `/root`. Mode: independent. Scope: startup failure reporting, safe formatting, cleanup deadline and the actual API entrypoint. This execution changed only this review record.

## Examined candidate

Read the scoped task, AGENTS.md, QA profile, `main.ts`, `startup-diagnostics.ts`, its unit tests and the initialization/cleanup changes in `application.ts`.

Final examined SHA-256 values:

- `apps/api/src/startup-diagnostics.ts`: `6cfa707c7913ec111fe51830068e5cb9a2cef7ad52e8bff4963b55d45509ef46`.
- `apps/api/src/main.ts`: `bab53c522f62fac73f61caec52b8a803e93a238c2ec1d72a2429e6e156a9cd49`.
- `apps/api/src/application.ts`: `2a684e6d8ca72f3d504d75871463b210dc4a666b359a34e1265d027866aeb236`.

The final candidate includes the architecture review's corrections: diagnostic getter failures are caught without reflecting their values, and cleanup is bounded by a three-second deadline. Main attempts both application and Prisma cleanup; the initialization failure path also uses bounded cleanup. No authentication-handler or tenant-authorization behavior was changed by the reviewed delta.

## Executed checks

- `./node_modules/.bin/vitest run apps/api/test/startup-diagnostics.test.ts`: **10 passed**. Cases include occupied listener diagnosis, allowlisted field names, unknown error/code redaction, throwing code/message getters, cleanup timeout and cleanup rejection without leaked timers.
- `./node_modules/.bin/tsc -p apps/api/tsconfig.test.json --noEmit`: passed.
- `git diff --check`: passed.

Independently spawned the real `apps/api/src/main.ts` entrypoint from `apps/api` using `node --import tsx src/main.ts`, with `.env.example` configuration and synthetic credential markers. These probes used the actual compiled/runtime module graph; no application/auth/database factory was mocked.

1. Held a real loopback TCP port open, then started the API on that occupied port. Child exited **1** in about **1.33 seconds**, reported `stage=listen` and `EADDRINUSE` with the correct listener, and did not print the injected database/mail/auth secret markers or the database URI. It did not require the ten-second watchdog to terminate.
2. Supplied invalid `PORT` and `DATABASE_URL`. Child exited **1** in about **1.11 seconds**, reported `stage=service-config` with the known field names, and did not reflect supplied invalid values.
3. Supplied invalid `AUTH_SECRET` and `MAIL_FROM`. Child exited **1** in about **1.23 seconds**, reported `stage=auth-config` with those names, and did not reflect the short secret or mail marker.
4. Started on a free loopback port. `/api/v1/health/live` returned **200** with `status=alive`; the expected listening message contained only the listener. SIGTERM stopped the child without forced SIGKILL. No injected credential marker appeared in output.

The initial attempt to spawn the standalone `tsx` CLI was blocked before application execution by this executor's EPERM on its temporary IPC pipe. The successful probes used Node's supported `--import tsx` loader for the same TypeScript entrypoint and did not bypass filesystem or process permissions.

## Verdict and limits

**Passed** for the bounded startup-diagnostics acceptance above; no new unresolved finding. Failure probes prove nonzero prompt termination and redaction, while the helper tests verify the cleanup deadline. They do not prove every resource completed cleanup before a forced startup exit.

The user's Mac was not accessed and its original startup cause remains unconfirmed. Database readiness, successful SMTP delivery, invoice behavior, and the full identity integration suite were not rerun in this review. Liveness is not evidence that PostgreSQL, Redis or object storage are available. Existing identity CI evidence applies to its recorded revision only; future executable corrections require applicable fresh checks.

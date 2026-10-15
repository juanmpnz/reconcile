# Development API port coordinator review

Reviewer/implementer /root; principal-engineer, backend-engineer, frontend-engineer and platform-engineer, sequential (not independent). Scope: development entrypoint, shared development port config, Vite proxy, workspace dependency linkage and docs. No domain, auth, UI, external dependency version or infrastructure mapping change.

User-supplied diagnostic proves API3000 occupied. Development now uses validated DEV_API_PORT(default 3001), with API's dev.ts overriding deployment PORT only in development. Existing PORT=3000 in the user's.env needs no edit. Direct main/start/production still use existing PORT, and dev launcher refuses NODE_ENVproduction. Vite reads the same root.env and process-environment priority, targets127.0.0.1 and skips development-port parsing for build. Shared frontend/auth origin remains5173.

Installed existing workspace link using pnpm; lock diff is exactly3 importer lines for @reconcile/config, with no resolved version changes. Runbook describes separate development/production ports. Applicable independent architecture and QA evidence is in sibling review files. Full checks and actual default/override runtime probes are recorded in the task record after execution. The coordinator cannot terminate or inspect services on the user's Mac.

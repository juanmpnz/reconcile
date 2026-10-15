# Reviewed claims — coordination and platform verification

Execution: `/root`, principal-engineer and sequential platform review. Product/domain, architecture/security/data, UX/accessibility, backend, frontend and independent QA were delegated to actual named executions under the mandatory repository harness. This coordinator does not label its own checks independent.

Read AGENTS.md, `.agents/WORKFLOW.md`, principal/platform profiles, current plan and status, product requirements and ADRs 0005/0006. Planning decisions and design preceded dependent production implementation. Backend owns contracts, schema/migration, use cases, routes and real HTTP acceptance; frontend owns React/API presentation and its targeted tests. Independent reviewers did not author the production source they review.

## Scope and decisions

One stable claim per organization/operation/invoice, initialized from one reviewed finding, avoids duplicate demands across runs without treating mutable parser line IDs as permanent service identity. No financial aggregation or rule/parser change. Corrections copy eligible positive supported decimal differences from server evidence; clarification amounts remain null. Human decisions use a separate review counter so confirmation does not stale its own analysis.

Reviewed source includes the shared input collector export, separate claims routes, current membership/role/Origin checks, safe conflict mapping, additive tenant-scoped migration and versioned decision/source/draft/event/export records. Claims preserve exact exported bytes and their checksum privately in PostgreSQL. The existing CI workflow discovers the new real HTTP file without weakening existing assertions. No dependency, lockfile, Docker image, SMTP transport or environment variable change.

Independent architecture and QA caught missing export provenance, concurrent claim writes, history/resource bounds, business chronology and clarification eligibility; implementation corrections and final rereads are tracked in their reports. Independent UX/domain review covers the compact workflow and coherent manual state/outcome labels. No email is sent by this phase.

## Verification

Independent QA observed full local `pnpm check` exit 0: 67 unit tests, eight harness regressions, format, ESLint, strict TypeScript and production builds. The final explicit-resolution-button delta passed scoped format/lint and strict web build; the browser artifact is `index-DwBAVmrC.js`. Independent browser execution passed 13/13 actual Chromium fixture groups, with exact source hashes and limitations in its report. `git diff --check` and `pnpm harness:check` also passed.

Coordinator directly fetched and filtered decoded initial CI job 116431016858 logs, run 38737672379: 67 unit tests, claims migration, 48/48 actual HTTP groups and API/PostgreSQL/Redis/private-bucket/worker smoke passed. The only workflow failure was the deliberately pending task-verified evidence gate. Independent QA confirmed tested merge/source tree parity. This initial source predates RC-R1 and does not certify that later recovery fix.

During final source review the coordinator found RC-R1: a changed decision identity did not mark the claim stale, hiding same-run explicit rebase despite emission being blocked. Backend corrected detail and bounded summary queries and added real recovery assertions. Independent architecture and QA reopened approval, reread the correction and approved its source; coordinator directly read corrected CI job 116433953122 decoded logs and tested-merge metadata: 67 unit tests, migration, all 48 real HTTP groups and full service smoke passed. RC-R1 recovery is therefore tested on source `ddd93dbd818d05300174f325cde23301dc84a3c6`, tested merge `2adfa467729f26f8b55faf1cbb88863b65257981`, identical tree `681bbaa358860b56a1d769186fbe2c9f70c7860a`. Independent QA separately checked this parity and acceptance. Only the pending task-verified gate failed before closure; this is not presented as a green collection workflow. Final metadata closure changes no executable source and the final CI must pass the complete gate before integration.

No production deployment, TLS, backup/restore or deployed real-auth browser E2E is claimed. Docker is unavailable locally; actual service tests and smoke run in CI. No private server is changed by this phase.

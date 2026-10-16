# Workspace dashboard — backend self-review

Execution `/root/analysis_backend`, backend implementation; sequential self-review, not independent. Followed product/architecture definitions before aggregate implementation.

Scope: new dashboard transport schema, application aggregation, GET route and application registration, package exports, and dedicated dashboard HTTP integration tests. No database/schema, financial engine, document workflow or frontend changes.

GET `/api/v1/organizations/:organizationId/dashboard` validates UUID, current verified session and current database membership including viewer; anonymous/foreign/revoked access is denied. Private no-store and nosniff headers are returned. Service independently checks verified membership inside a Repeatable Read transaction. Responses contain bounded counts and up to five action references in each pending group; no amounts, PDF text, credentials or cross-organization data.

Operations totals and never-completed count cover all organization records, independent of list pagination. Latest-analysis status distribution uses one latest persisted run per operation. Pending operations instead show latest run not completed (including previously completed operations with a newer failed/queued run); these are deliberately different definitions. Document counts group actual current statuses, separating needs_review from failed/blocked. Claims open excludes resolved/rejected.

Findings count only the latest completed persisted result per operation, and explicitly advertise historical scope: `latest_completed_per_operation`, `includesHistorical: true`. These are not current-validity guarantees or payment approvals. Human confirmations count the latest decision action confirm for confirmed/probable findings in those same completed results; later dismiss/accept removes the count. No whole-organization fingerprint reconstruction or PDF/snapshot loading occurs. Distribution charts consume real status counts rather than fabricated trends.

SQL lateral aggregates correlate organization/operation/run keys and project only status/result findings. Pending lists use bounded queries with deterministic ID tie-breaks. The service validates all returned data with dashboardSchema.

Validation: strict contracts/application builds and API integration-test typecheck passed; changed-file ESLint passed. Two actual HTTP integration groups arrange explicit persisted metric fixtures (not financial-engine E2E) to verify 56 operations vs a one-item page, seven document/claim states, latest-completed historical de-duplication, latest human decisions, empty other tenant, bounds and viewer/foreign/anonymous/revoked access. Real infrastructure execution awaits coordinator CI; no runtime pass is asserted here.

## Follow-up: global operation/agreement table queries

Coordinator additionally assigned only read-only list cases and GET query validation. Added strict q/sort/direction schemas with 200-character query bound, fixed column allowlists and previous pagination limits/defaults. Operation search uses tenant-scoped case-insensitive Prisma contains with SQL wildcard characters escaped, and orders/counts inside Repeatable Read before pagination. Agreement provider/service/validity are JSON terms, not columns; a parameterized SQL projection filters and orders globally by an allowlisted alias, counts the same filtered scope, returns page IDs, then fetches only those tenant rows for DTO validation. Title maps to persisted agreement name. Stable ID ascending tie-breaks prevent page overlap for equal sort keys. No mutations, financial rules or schema changed.

Two dedicated real HTTP integration groups arrange explicit list fixtures: 60 operations/agreements, unique matches beyond a first 25-row page, literal percent/underscore searching, reverse/name/date sorts, global counts, no page overlap, tenant isolation and rejected sort/direction. Strict API test typecheck and changed-file ESLint passed. Runtime acceptance remains pending canonical CI.

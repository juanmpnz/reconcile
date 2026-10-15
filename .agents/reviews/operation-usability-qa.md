# Operation usability — independent QA

Execution: `/root/analysis_qa`, canonical qa-engineer; platform feasibility also checked against the platform-engineer profile. Owns this review record only. Backend production and new test code belong to `/root/analysis_backend`; frontend belongs to `/root/analysis_frontend`. Reviewing these separately authored tests is independent; previous analysis acceptance test authorship is disclosed in the earlier phase record and is not relabeled here.

Read AGENTS.md, expert workflow, QA/platform profiles, implementation plan, pilot requirements, current application/contracts/routes and operation-usability architecture decision.

## Required acceptance

- Edit the existing operation's name/reference from a placeholder to `OP-DEMO-062` without changing its ID, documents or immutable analysis history. The old completed analysis becomes stale and a new explicit run uses the corrected reference.
- Name-only edits also mark prior analysis stale; identical submissions are no-ops. Actual edits append atomic bounded before/after audit with actor and operation ID.
- Duplicate same-organization reference returns a safe conflict; another organization can independently use the same reference.
- Metadata and document-link writes compare the submitted fingerprint inside a serialized transaction. An older screen cannot overwrite a newer metadata, association or fact revision. Conflict drafts remain reviewable in UI.
- Queued/processing analysis blocks metadata/link edits atomically; it retains its captured source snapshot. Completed historical snapshots/results remain unchanged after edits.
- Linking/unlinking changes only association records, preserves original downloadable bytes and extraction/correction history, and marks prior runs stale.
- Verified current owner/admin/analyst can mutate; viewer/foreign/revoked accounts and hostile/missing Origin cannot. Cross-tenant document IDs and mismatched operation/run resources remain rejected.
- UI is compact and keeps source limitations available without permanent oversized explanatory blocks. Browser fixtures, when used, are reported separately from real-service acceptance.

## Infrastructure feasibility and pending checks

`command -v docker` found no Docker executable in this executor. Local real-service acceptance cannot be claimed; use actual GitHub Actions PostgreSQL/Redis/private-S3 services and inspect its decoded logs. Do not start PostgreSQL as root, bypass its runtime restrictions or replace services with mocks to present an integration pass.

Final `pnpm check`, independent new backend-test source review and real-service CI are pending implementation. No success claimed yet. Browser execution is coordinated separately with `/root/analysis_product_domain` and must name its actual source and fixture boundary.

# Identity administration redesign — QA plan and evidence

Reviewer: `/root/harness_qa`, independent execution from the frontend/backend implementers. Owns additions to the existing HTTP integration test and this review. Test authorship is not an independent review of that same test code.

## Plan agreed before implementation

- Real Better Auth/Fastify/Prisma HTTP tests: native member and invitation list shapes, pagination metadata, current-member read access, foreign-organization denial, immediate revocation, owner/admin cancellation and viewer/analyst/foreign-owner cancellation denial. Preserve the existing authentication policy.
- Browser UI contract tests with explicitly synthetic HTTP fixtures: desktop and 390/320px organization search/empty/loading/error/retry states; member/invitation detail; create/invite/cancel pending/success/error behavior; role-conditioned controls; switching organizations with delayed responses; logout; keyboard dialog focus containment, Escape and focus return; page overflow and 200% layout inspection.
- Keep browser fixture evidence separate from actual authentication integration evidence. Do not claim exact Figma fidelity without inspecting the nodes.

## Current evidence

Read repository instructions, the QA profile, `docs/design/identity-interface.md`, the existing identity acceptance brief and pinned Better Auth 1.7.8 route source. Native list-members and list-invitations permit any current organization member; cancellation requires the configured invitation.cancel permission (owner/admin). No backend policy change was needed or authored by this QA execution.

The real HTTP integration suite now contains 21 cases. Three added cases cover the scoped native listings, cross-organization and revoked-membership failures, viewer/analyst/foreign-owner cancellation denial and owner cancellation reflected in list state. The existing admin case also verifies successful admin cancellation. Existing authentication acceptance remains in the same suite.

Executed after those additions:

- API source/test strict TypeScript check: passed.
- ESLint on the integration test: passed.
- Prettier on the integration test: passed.

Real PostgreSQL execution of the added cases is pending CI. Browser execution of the redesign is pending an implementation candidate.

Browser tooling prepared outside the repository: installed runtime Playwright 1.62.1 and scratch-only Chromium 153.0.8010.0. An actual headless launch succeeded. No repository browser dependency or lockfile was changed for these UI probes.

## Status and limits

Status: planned browser QA; HTTP test implementation ready, runtime acceptance pending. No pixel-perfect Figma, real-company-data, real mail delivery, production SSO or deployed reverse-proxy claim. This record must be updated with actual browser and real-service results before marking the redesign verified.

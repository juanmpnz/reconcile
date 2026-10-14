# Phase 1 — identity and organization acceptance

Status: implementation brief, 2026-10-14. Product scope approved by existing implementation plan. Obra Community is the accepted component reference; exact Figma node inspection remains pending and pixel identity is not claimed.

A person registers with name, email and password, verifies email and signs in. Password recovery and sign-out revoke appropriate access. Email domains do not automatically grant membership. Organization creation gives the verified creator owner membership. A personal workspace is also an organization. Users can list/switch only their memberships.

Owner/admin can invite an email into an organization with analyst/viewer permissions; owner/admin administration follows explicit ACL with owner protected. Invitations require verified matching email, pending state and non-expiry. Roles: owner, admin, analyst, viewer. Better Auth is the single source of memberships. Corporate SSO/social login are planned, not enabled.

First protected application endpoint: GET /api/v1/organizations/:organizationId/context -> organization { id, name, slug }, membership { role }, capabilities for that role. It must require a current verified session and current membership. This is real workspace context, not invoice data. Members cannot query another organization's context, even by changing URL or activeOrganizationId. No business endpoints, worker jobs, documents or payment actions in this phase.

Use Better Auth standard /api/auth routes and organization plugin APIs for account/org operations. Expose local email capture for demo/tests, never tokens in API responses or logs. Production email must use an explicit real provider and secrets; fail closed if absent. Keep dev infrastructure loopback-only.

Acceptance: register/verify/login/reset/signout; unauthenticated request denied; two organizations and users isolated; shared user can switch authorized contexts; viewer cannot invite/escalate roles; forged organization id fails; revoked membership/session immediately stops access; mismatched/expired invitation fails; original health/worker smoke stays passing. Tests use actual Better Auth/Fastify/Prisma HTTP flow in PostgreSQL, not mocked auth.

UI: login/register/forgot/reset/verify/invitation states and a signed-in organization selector with create/invite controls. No fabricated invoice metrics. UX states include loading, error, verification pending, no memberships and denied access. Accessible forms/focus/errors, no tokens in localStorage, TanStack Query keys scoped by org and cleared on logout. Design is an initial component implementation; no uninspected Figma fidelity claim.

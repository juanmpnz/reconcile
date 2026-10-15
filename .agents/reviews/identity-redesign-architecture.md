# Identity interface architecture/security review

Independent reviewer: `/root/harness_architecture`. Roles: solution-architect and security-engineer. Implementers: `/root/identity_frontend` for UI and `/root/harness_qa` for HTTP test additions. Scope: current working diff over `409f7dfdf9382cd96200d9cdd84485a0cb6fae81`. Verdict: **source review passed**; new browser and real PostgreSQL execution remain separate pending evidence.

Final examined source fingerprint: `fa7d37d15f3c7bd26c2600f3c28d76e9701ae1785579573be8857233c9942ead`, SHA-256 over the 20 sorted `.ts`/`.tsx` files under `apps/web/src` plus `apps/api/test/identity.integration.test.ts`, concatenating each repository-relative path, NUL, bytes, NUL. This supersedes the earlier fingerprint after the Account/history-notice corrections and bounds the reviewed executable/test snapshot; evidence-only edits do not change it.

## Contract reviewed before implementation

Inspected installed Better Auth 1.7.8 organization route/adapter source. Organization listing returns the current user's organizations. Member listing requires current membership and returns `{members,total}` with explicit organization ID, limit and offset. Invitation listing requires current membership and returns an array without a native pagination/total contract. Both reads permit viewer/analyst members under existing policy; cancellation resolves the invitation's organization and checks the configured invitation.cancel permission, granted only to owner/admin. Existing global organization middleware additionally requires a verified current session. No backend policy change was necessary or made.

Sent these contracts and scoped query/cache requirements to coordinator, frontend and QA before dependent UI work. Product rows must originate in actual responses; no invoice fields, inferred roles/member counts, global invitation totals or invented backend capabilities belong in this scope.

## Findings and final source corrections

- **UI-ARCH-01, medium, resolved in reviewed source:** cached successful context remained readable while membership revalidation was fetching, allowing cached tables to render before the new check finished. `OrganizationDetail` now enables list queries and renders their contents only when context is successful and not fetching. Context errors hide tenant tables/actions. The disabled dialog can remain mounted during a permission refresh to preserve user input; submission stays disabled.
- **UI-ARCH-02, medium, resolved in reviewed source:** delayed organization creation or invitation acceptance could call global navigation after its originating screen unmounted. Both mutations now check a mounted ref after the server request and again after query invalidation, before navigation. Organization list is keyed by user, invitation by user+invitation ID, and detail by user+organization ID, so identity/context changes discard their local state. Reviewed the effect/ref implementation under React mount/cleanup semantics. These guards prevent stale navigation; they do not cancel an already accepted server mutation.
- **UI-ARCH-03, medium, resolved in final reviewed source:** the added Account mounted guard initially could not prevent Better Auth's default client redirect plugin from navigating before `signIn.email()` resolved when callbackURL was supplied. Inspected pinned `client/fetch-plugins.mjs` and the native email sign-in response. The frontend now omits callbackURL only for password sign-in, and the application navigates to its preserved destination after the mounted check. Signup/verification emailed callbacks remain intact. This is a client-routing correction; no backend authentication policy changed.

Also reviewed the final history-state notice delta: only the fixed `organization-created` / `invitation-accepted` enum values map to fixed display strings at the destination. No token, arbitrary message, capability or authorization result is accepted from history state. Notices do not bypass the current organization context check. Account asynchronous completion now has the mounted guard; the password sign-in automatic redirect issue above is explicitly addressed rather than relying only on that guard.

Reviewed remaining data boundaries: query keys include user and explicit organization ID, member pages are distinct, responses validate organization attribution, and dates are parsed/validated before display. No previous-organization placeholder data is configured. Tab/page URLs retain the selected organization, browser history is observed, and explicit logout clears QueryClient data. Session absence/error hides the protected shell. Native requests still use HttpOnly session cookies; no auth token is written to localStorage. Text uses React escaping, and invitation mutation roles remain analyst/viewer only. Cancel controls use current context capability and pending/nonexpired rows; the existing server remains authoritative.

No changes found in API implementation, auth policy or database source for this redesign. Client-side hiding is not presented as an authorization boundary. Unauthorized native reads/writes continue to be tested at the server.

## Independent verification

- `pnpm --filter @reconcile/web typecheck`: passed, including a rerun after the final Account/history-state delta.
- `pnpm --filter @reconcile/api typecheck`: API source and HTTP test types passed.
- `pnpm --filter @reconcile/web build`: passed, including a rerun after the final Account/history-state delta; third-party Zod annotation warnings were nonfatal.
- `git diff --check`: passed before this review file was added.
- Independently inspected the new 21-case real HTTP suite source: actual Better Auth/Fastify/Prisma flow remains intact, with no mocked auth/database. Added assertions cover member pagination metadata, scoped invitation arrays, foreign-organization and revoked-member denial, forbidden cancellation leaving the DB row pending, and owner/admin cancellation preventing acceptance. Test authorship belongs to QA; this is a separate review of those additions.

No open critical/high findings in this bounded source review. Browser stale-context/late-request regressions and real PostgreSQL execution of the added cases are not certified here yet. Figma nodes were not available; this review does not claim pixel fidelity, UI visual QA, production SMTP/SSO/MFA, deployed reverse-proxy correctness or any invoice-processing capability.

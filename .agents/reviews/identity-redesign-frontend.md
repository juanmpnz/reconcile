# Identity interface — frontend implementation evidence

Date: 2026-10-15. Identity: /root/identity_frontend. Roles: frontend-engineer, ui-engineer; UX/visual implementation follows the independent identity_ui_review blueprint in docs/design/identity-interface.md. This record is implementation self-review, not independent approval.

## Scope

apps/web only: extract the former main.tsx into app routing/query provider, reusable UI primitives/AppShell/Radix Dialog, account/invitation features and organization list/detail features. Actual @radix-ui/react-dialog 1.1.15 is installed by root; local CSS uses the monochrome semantic tokens in the blueprint. No Tailwind or installed shadcn component claim; Obra Figma nodes remain uninspected.

Organization list uses Better Auth authorized list with local name/slug search and actual create response. Detail first obtains /context then reads native members/invitations with explicit organizationId. Members use server limit25/offset pagination and total. Invitations have no invented server total/pagination. Owner/admin controls use current returned canInviteMembers; backend authorization remains authoritative. Cancel only pending, unexpired invitations, with fresh-context disabled states.

## Boundaries and findings resolved during implementation

- Query keys include userId, organizationId and member page. Detail and invitation components keyed by tenant/user. No previous-tenant placeholder data. Context errors/refetch hide table contents and disable privileged actions until server check settles.
- Zod validates external table/context payloads, rejects invalid dates and cross-organization context/list rows. Unit tests protect these boundaries.
- Late create/accept responses cannot navigate after the owning component unmounts. Logout clears QueryClient and uses native Better Auth sign-out.
- Password min12, invitation destinations, verification resend, recovery and reset links retained. Verification callback now shows a UI-only processed-link notice at login; it provides no authentication proof.
- Route pathname navigation focuses main; tab/page query changes preserve keyboard navigation. Dialog uses Radix focus trapping/Escape/focus restore, unique field IDs and error focus. Native navigation tabs avoid unsupported ARIA tab behavior.
- Auth single compact form, desktop sidebar200/topbar52/content24; narrow responsive navigation; semantic table regions scroll internally. No marketing hero/eyebrows/green/invoice data.

## Validation actually run

- node_modules/.bin/eslint apps/web --max-warnings 0: passed.
- node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit: passed.
- node_modules/.bin/vitest run apps/web/src/features/organizations/queries.test.ts: passed 3 tests (cross-org context, service-vs-denial, invalid expiry).
- ../../node_modules/.bin/vite build from apps/web: passed; JS441.44kB/136.31kB gzip, CSS8.09kB/2.28kB gzip. Zod dependency PURE-annotation warnings are upstream comments; build successful.

Browser screenshots, keyboard/dialog interactions, fixture loading/error/permission behavior and real HTTP identity regression are delegated to independent QA/UI agents. Their evidence must not be inferred from these compile/unit checks. No real customer documents or systems used.

# Identity redesign — independent UX/UI/accessibility review

Reviewer: identity_ui_review (separate agent execution from frontend implementer). Roles: ux-designer, visual-designer, ui-engineer, accessibility-reviewer. Date: 2026-10-15.

## Scope and evidence

Read AGENTS.md, role profiles, workflow, docs/design/reference.md, docs/product/phase-1-identity.md, docs/design/identity-interface.md; reviewed apps/web/src/app, components, features/auth, features/organizations, styles.css. Planning blueprint was written before frontend implementation; implementation review is independent from its author.

Initial source review: compact 200px sidebar/52px topbar, fluid remaining width, Arial14/heading22, neutral grayscale, real organization/member/invitation tables, search/empty/loading/error states and single authentication form match the accepted direction. No decorative hero, green or financial placeholder data found. Table captions, scoped headers, labeled keyboard-focusable horizontal scroll regions, unique input IDs and status/error semantics exist. Dialog uses Radix Dialog, explicit accessible title/description and busy dismissal prevention. No claim of installed shadcn/Tailwind or Figma pixel fidelity.

## Findings

- Medium — SPA route focus: apps/web/src/app/router.ts navigate changes history only. Opening an organization removes the focused Open control without placing focus at the new page heading/main. Requested pathname-change focus management, while avoiding disruptive focus during tab/page query changes or dialogs.
- Low — detail breadcrumb: AppShell accepts organizationName but App never supplies it. Detail hierarchy remains only Organizations; requested actual current name or an explicit breadcrumb in detail.

Status: changes-requested pending implementation recheck. No high/critical findings from bounded source inspection. Browser screenshots, keyboard/zoom/overflow/focus checks not executed by this reviewer; QA evidence must be attributed separately when available. Figma Community exact nodes remain uninspected.

## Final independent recheck

Both initial findings closed against current source: App performs pathname-only requestAnimationFrame focus to focusable main; AppShell OrganizationBreadcrumb observes the correctly user/organization-scoped context cache without a duplicate fetch. Query-only tabs/page changes preserve focus. Current detail hides member/invitation tables while authorization is being refreshed; late create/accept responses have component-lifetime guards.

Reviewer visually inspected QA-generated desktop-organizations-ui-fixture.png and desktop-invitations-ui-fixture.png from /tmp/reconcile-ui-qa/results using view_image. Both show the compact monochrome full-width shell and real-data-shaped table fixtures with no visual finding. Screenshots were captured by harness_qa with mocked HTTP UI fixtures, not by this reviewer and not proof of real authentication. No browser interactions were executed by this reviewer. QA separately reports keyboard Radix create focus/trap/Escape/restore and desktop organization/detail flows passed; remaining browser evidence belongs to QA's record.

Independent web typecheck passed during this review: pnpm --filter @reconcile/web typecheck. Frontend implementer separately records lint/type/build/unit successes; those are not attributed to this reviewer.

Final bounded source/desktop screenshot review status: passed. No open critical/high/medium findings. Nonblocking touch-density note: narrow table action min-height36 is smaller than blueprint40; owner notified to align. Mobile/zoom/screen-reader checks remain outside this review, pending/attributed to QA. Exact Obra Figma node fidelity remains unverified.

Final small-delta recheck: narrow table actions now use 40px minimum height (touch note closed). navigate carries only fixed typed success notice values in history state; navigationNotice validates unknown state and maps to fixed UI text. OrganizationDetail initializes success Feedback from this UI-only notice after create/accept. These notices do not assert authorization. Source recheck passed; no new finding.

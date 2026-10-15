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

Real PostgreSQL execution of the added cases passed in the independently observed CI run below. Browser checks ran against the final frontend candidate, with the reviewed mobile containing-block and sign-in callback corrections applied. A final git diff against source revision `999e4c76127beaecf95cdaa968987579849e8e73` confirmed no difference in the browser-tested frontend source or integration test.

Browser tooling prepared outside the repository: installed runtime Playwright 1.62.1 and scratch-only Chromium 153.0.8010.0. An actual headless launch succeeded. No repository browser dependency or lockfile was changed for these UI probes.

## Actual browser UI evidence

Ran `/tmp/reconcile-ui-qa/run-ui.mjs` using Playwright 1.62.1 and Chromium 153.0.8010.0 against an actual Vite server and the real React component tree. The driver starts and stops Vite in the same execution environment, intercepts `/api/**` with explicitly synthetic session/organization/member/invitation responses, and records actual requests. This is UI contract evidence, not a real-authentication end-to-end test.

Final result: **14/14 scenario groups passed**:

1. Desktop organization table, case-insensitive search, no-results/clear, create-dialog initial field focus, repeated Tab containment, Escape, trigger focus restoration and cleared draft on reopen.
2. Native-shaped member/invitation data, member pagination with offset 25, detail navigation and invitations tab.
3. Create pending/duplicate prevention, error focus and retained form values, then successful response-driven navigation.
4. Invite pending/error/retained values, Escape blocked while pending, organization/role payload, server-refreshed invitation state, cancellation error and successful cancellation.
5. Visible list loading, request error, retry and distinct empty-organization state.
6. Viewer invitation read access without invite/cancel controls.
7. Delayed tenant-A response cannot replace tenant-B data.
8. Reopening a cached organization hides old members during fresh permission verification; denied refresh removes privileged actions.
9. Delayed create completion after browser Back does not hijack the current route.
10. Logout errors remain visible on detail; successful logout removes protected content and Back does not restore it.
11. Organization list, create modal and invitation detail at 390px and 320px have no document-level horizontal overflow; horizontal table scrolling remains confined to the labeled region. A separate CSS 200% zoom probe also passed; this is not a claim of testing an operating-system/browser zoom setting.
12. Compact mobile login, invitation destination preserved through registration and recovery links.
13. Keyboard Open moves focus to main. Successful login uses guarded navigation and omits native sign-in callbackURL.
14. A delayed native-shaped sign-in response after an SPA route change cannot redirect away from the new registration route. Fixture responses model Better Auth's callback-dependent redirect flag.

The first broad run found a real mobile overflow: the absolute visually hidden Actions heading escaped its table scroll region and increased the 390px page width to 511px. Frontend added `position: relative` to the table region; retest measured exactly 390px/390px and 320px/320px document/viewport widths. Body overflow was not hidden. This finding is resolved in the final run.

Final screenshots were inspected by this QA execution; compact monochrome layout, labels, focus rings and modal controls fit the tested viewports. Internal evidence files under `/tmp/reconcile-ui-qa/results/` include `desktop-organizations-ui-fixture.png`, `desktop-invitations-ui-fixture.png`, `desktop-login-ui-fixture.png`, `mobile390-organizations-ui-fixture.png`, `mobile390-create-dialog-ui-fixture.png`, `mobile390-login-ui-fixture.png`, `mobile320-invitations-ui-fixture.png` and `desktop-css200zoom-organizations-ui-fixture.png`. These are transient internal QA fixtures, not client-data screenshots.

Final candidate SHA-256 identifiers:

- Styles: `9591875028aa9161c2010b1a00a1de4ef5449fb5cdfb41f88ea0dedcc5e6528b`.
- Account: `ffb2b6239de929a0e5217704bfc618588b2206a2f9b048919b2101f23df0f5b0`.
- Organization detail: `8201e2e90e6c1268e8ac3cb66d5d4d5003d27e00cdb4c0cded1433baf76ca2c3`.
- Create dialog: `837089dbea077b1b38e4d41281db25b454ca8890ed53ce58dfec233fefd97f24`.
- App: `5c4cdbc0985560b2915d3308bcc4fd7e97c09c3fecc8020d9292bb1dc773229a`.
- Integration test: `51e466bf202ff64b5e4751a080db65d61fcf2cfc04adffcb66989ffcdc5b694f`.
- Scratch browser driver: `7819fd251da844b8fa27d651440d70fc96877ab3e3021010c60075ed4a4e7672`.

## Independently observed real-service CI

This QA execution independently fetched the completed job steps and decoded logs for [run 38700626741, job 116307661210](https://github.com/juanmpnz/reconcile/actions/runs/38700626741/job/116307661210). Source head: `999e4c76127beaecf95cdaa968987579849e8e73`. Checkout logs identify the actual tested PR merge revision as `1b809584314acc066cfe820b9bf9a0e552666cbe`.

Observed:

- Frozen installation and `pnpm check`: passed; logs show **23 unit tests passed**, with formatting, lint, types and build successful.
- Infrastructure startup and both migrations: passed.
- Actual PostgreSQL/Fastify/Better Auth integration suite: **21/21 passed**, approximately 9.4 seconds. Logs name the new scoped member/invitation read and cancellation-permission cases; the admin case also passed.
- API/PostgreSQL/Redis/private-bucket/worker smoke: passed, with the explicit smoke success message and ready service checks.
- Cleanup: passed.
- The final evidence gate fails with `Task is not verified: 2026-10-15-identity-interface`, as expected while this independently observed evidence is being recorded. This is not an integration/runtime failure, and this review does not claim the whole workflow is green. The coordinator owns final task certification and the gate rerun.

## Status and limits

Bounded QA verdict: **passed**, with no unresolved finding in the tested UI scenarios and independently observed **21/21 real-service HTTP cases** at the recorded revision. UI fixtures and real-service integration remain distinct evidence; they are not presented as a real-auth browser end-to-end test. This execution's own added test code is not self-certified as independently reviewed. No pixel-perfect Figma, real-company-data, real mail delivery, production SSO, full assistive-technology audit or deployed reverse-proxy claim. Final task certification remains coordinator-owned.

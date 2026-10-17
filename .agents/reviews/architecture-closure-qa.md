# Architecture closure — independent QA

Reviewer: `/root/closure_qa`, independent of production implementers. Scope: frontend acceptance, protected navigation/session boundary, design-system migration and preservation of the existing business UI request contracts. Test changes authored here require separate review; they are not self-certified as independently reviewed.

## Preflight

Read `AGENTS.md`, `.agents/WORKFLOW.md`, `.agents/roles/qa-engineer.md`, the implementation plan, architecture overview, existing two portable browser suites, and current shared transport/router source. Existing browser fixtures explicitly remain synthetic HTTP fixtures: they prove browser behavior and requests, never real backend tenant authorization or extraction correctness.

The existing twelve browser groups already cover global pagination/search/sort, exact invoice-specific agreement binding, immutable historical display, optimistic-conflict draft retention and explicit retry, pending mutation close guards, mobile containment, keyboard focus, custom select validation/FormData, white content surface and local Inter loading. Preserve those assertions while replacing their underlying UI/data abstractions.

Additional bounded acceptance will target an expired session on a private deep URL, immediate removal of cached organization content and forbidden navigation. Real current-membership and cross-tenant enforcement remain service-backed backend tests, not mocked browser claims. Transport tests are owned by the data-hook specialist; route/DS boundary unit tests by the coordinator.

No Chromium executable was found under `/tmp`, `/opt`, `/root/.cache` or the workspace. Existing CI installs the pinned Playwright browser and runs both suites against built production assets. Local runtime/browser execution is therefore not yet claimed; static checks and final CI will be attributed separately to their actual revision.

Status: preflight complete; source and browser runtime verification pending implementation freeze.

## Bounded browser acceptance source

Both runners now explicitly answer the session-assurance endpoint with `required:false,enrolled:false`, preserving the existing twelve business/UI groups without pretending to exercise MFA. Two additional workspace groups trigger an actual dashboard refresh returning 401, require login and removal of loaded private content/navigation, and then open a private operation deep URL anonymously while asserting no tenant API requests occur.

Scoped ESLint and `node --check` passed for the modified runners. `/root/security_architecture` independently reviewed these test changes and returned passed: assertions test observable browser behavior and retain synthetic-versus-backend limits. They do not prove an old-user to new-user in-flight cache race; that requires the session boundary's separate tests. MFA required/enrolled challenge acceptance and actual runtime execution remain pending.

The explicit assurance fixture now includes `verified:false`, matching the final three-field contract. A fifteenth browser group covers two mandatory-MFA gate states: unenrolled account, and enrolled account with an unverified session. Both open a private operation URL, require `/security`, and assert no tenant requests or workspace navigation render. This is gate acceptance only; successful OTP enrollment, challenge and backup recovery are separate backend/UI acceptance, not inferred here. Scoped lint passed after this addition; runtime remains pending.

Two further groups exercise the implemented MFA controls using clearly synthetic server responses: password enrollment, QR/backup display, acknowledgment before activation, exact TOTP code with `trustDevice:false`, no enrollment seed or backup in local/session storage, secret removal after continuing, and exact backup-code challenge submission followed by authorized workspace navigation. No enrollment-secret screenshots are taken. These bring the portable suites to seventeen groups. They do not validate the cryptography, single-use recovery semantics, backend policy or real authenticator interoperability; service-backed MFA tests must supply that evidence. Scoped ESLint and Node syntax checks passed after these additions. Independent source review and browser execution remain pending for this final MFA delta.

Final bounded delta adds one identity-race group, bringing the suites to eighteen groups. It holds user A's actual dashboard HTTP request, changes the server session fixture to user B through the application's shared authentication transition event, and holds B's fresh membership response. Assertions require the old request's browser `requestfailed` cancellation, no cached A count while B membership is pending, no restoration after releasing A, then B's distinct count after releasing membership. The existing dirty-form group also holds a real visibility-triggered context refresh and checks the same draft remains mounted before and after that refresh. Request gates use observable arrival/release and bounded ten-second arrival deadlines. Scoped lint and Node syntax passed for this final test source. Browser runtime and independent review of this last delta remain pending.

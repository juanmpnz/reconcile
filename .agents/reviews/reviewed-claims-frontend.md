# Reviewed claims frontend implementation review

Date: 2026-10-16. Agent `/root/analysis_frontend`, frontend-engineer/ui-engineer. Mode: sequential implementation self-review, not independent. Consulted AGENTS.md/workflow and role profiles, phase 4 implementation plan, prior operation usability design, and pre-implementation `docs/design/reviewed-claims.md` plus `docs/product/reviewed-claims.md`. Shared contracts and backend retain authority for authorization, eligibility, amounts, concurrency and state transitions.

## Scope examined

Implemented `apps/web/src/features/claims/{api.ts,review-workspace.tsx,claim-detail.tsx,rebase-dialog.tsx,presentation.ts}` and API/presentation tests. Integrated a neutral review column/provider into `apps/web/src/features/operations/operation-detail.tsx`; appended bounded claim workspace styles to `apps/web/src/styles.css`. No dependency, schema, domain rule, email sending or fixture authored by this agent.

- Existing colored engine results remain unchanged. Human confirm/accept/dismiss uses a required reason, captured review version/fingerprint and append-only readable history. Decision errors retain drafts; conflict comparison/rebase is explicit. Review dialogs provide literal evidence/page context and authorized original links in another tab.
- Preparing a claim is an explicit action on one eligible confirmed finding. Eligibility presentation requires an invoice source, excludes arithmetic/total/tax/matched controls, distinguishes clarification without a requested amount, and leaves definitive validation to the server. Existing claims are reused by invoice, with the one-claim-per-invoice MVP limit visible; no arbitrary sum is performed.
- Persistent drafts use the highest saved version rather than array position. Recipient starts empty; subject/body edits require a reason and preserve prior versions. Stale sources block new emission and require explicit source rebasing, retaining source and draft history. Rebase dialog captures claim/review versions and fingerprint rather than silently replacing sent material.
- Copy uses the saved text and has a selectable fallback on clipboard denial. Text/JSON export uses authenticated server bytes and refreshes version/state afterward; it never claims an email was sent. Retained exports have individual read-only authorized download actions, available to readers without creating new export events. The JSON help explains that PDF originals are separate/private.
- Manual events collect date, note, optional/required next date and recipient confirmation for external sending. Initial datetime retains the exact ISO milliseconds until edited, while the local input supports seconds; this avoids truncating a just-created claim to an earlier instant. Rejection records a fixed rejected outcome; resolution has explicit outcome selection. Closed states hide further event actions, and stale unsent claims explain why sending registration is disabled.
- Overdue/next-follow-up indicators use browser-local calendar dates, remain outside collapsed history, exclude closed claims and assert no recovered-money totals. Histories expose reasons, versions, dates and private original access without showing internal IDs as interface labels.
- Query keys include user/organization/operation/claim; reads support AbortSignal and external data is schema checked and attributed before display. Mounted guards prevent late mutations from opening another operation. Authorization suspension hides portals/actions; viewer has read-only controls, including retained export reads, without business mutations.

## Local checks actually executed

- `pnpm exec vitest run apps/web/src/features/claims/api.test.ts apps/web/src/features/claims/presentation.test.ts`: **6 passed**. Four boundary cases cover foreign review organization, foreign claim snapshot, wrong operation after claim creation and forbidden export. Two presentation cases cover greatest draft version selection and local-date overdue/today behavior.
- An initial API test run caught an outdated fixture missing the newly required exports array; the fixture was corrected without relaxing schema validation and the full six passed afterward.
- `pnpm --filter @reconcile/web typecheck`: **passed**, including after final UX C1/C3 and evidence changes.
- `pnpm exec eslint apps/web/src/features/claims apps/web/src/features/operations/operation-detail.tsx`: **passed** before the final bounded UX fixes; scoped ESLint for changed claim detail/review workspace passed again after those fixes.
- Prettier ran on affected files. Repository-wide canonical checks/build and actual service CI are owned by QA/principal, not claimed here.

## Independent findings and evidence boundaries

`/root/analysis_product_domain` identified RC-UI1 (uncertain non-invoice source offered preparation) and RC-UI2 (one-invoice limit unclear). Both were corrected in eligibility presentation and visible copy. `/root/analysis_ux` identified UX-C1 (rejected action could carry withdrawn outcome) and UX-C3 (stale unsent tracking was confusing); rejection is now fixed to rejected and the stale trigger has a visible requirement. Optional UX-C2 evidence access in the review dialog was also added. Independent reexamination/approval belongs to those agents' records.

Status: frontend frozen for independent browser and canonical QA. This agent has not executed the new production-preview browser run, real database/queue HTTP acceptance or final CI, and makes no claim that those passed. No production deployment, external sending, payment approval, arbitrary multi-line claim totals, screen-reader certification or universal invoice interpretation is claimed.

## Final explicit-resolution correction

After the initial freeze, independent product/UX review identified RC-UI3: the resolution outcome defaulted to withdrawn instead of requiring an intentional choice. The principal authorized the bounded correction. `claim-detail.tsx` now initializes/resets outcome to an empty value, shows a required placeholder, and prevents resolved submission before an explicit choice. Rejection remains hard-fixed to rejected. The file was formatted and QA was notified while its canonical web build was starting. Local type/lint results above predate this final delta; QA's scoped/canonical final-source check and browser record must supply the final evidence. No passing result is extrapolated to a build that did not include the correction.

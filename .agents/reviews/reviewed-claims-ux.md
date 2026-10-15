# Reviewed claims — independent UX review

Date: 2026-10-15. Reviewer: /root/analysis_ux. Roles: ux-designer, visual-designer, ui-engineer, accessibility-reviewer; product/domain consultation before implementation. Mode: independent of production frontend implementation by /root/analysis_frontend. This agent authored docs/design/reviewed-claims.md before dependent UI code and edited only design/review documentation.

## Examined scope

Read governing workflow/role profiles, existing pilot and operation design, current product reviewed-claims guidance and agreed single-invoice claim policy. Inspected features/claims/review-workspace.tsx, claim-detail.tsx, rebase-dialog.tsx, presentation.ts, api.ts and operation-detail integration using cat/rg. Review covers actual source in the shared working tree after the implementer's C1/C3 fixes; exact CI/SHA and browser execution belong to coordinator/QA records.

## Findings and corrections

- UX-C1 medium, resolved by source reinspection: Registrar rechazo originally displayed arbitrary resolution outcomes with default Retirado, allowing contradictory user intent. Rejected status now shows a fixed Rechazado explanation and submits outcome rejected; resolution selector is displayed only for Resolver. No automatic recovery claim is introduced.
- UX-C2 low, resolved by source reinspection: reviewer modal initially showed concept/explanation without evidence accessible while focus was trapped. It now includes an evidence disclosure with page/literal fragment and authorized original links opening separately, so the decision can be checked without losing the reason draft.
- UX-C3 medium, resolved by source reinspection: stale unsent claim could open a send-registration dialog whose save was disabled without actionable recovery. Its trigger now disables for stale unsent draft/exported and visible instructions identify the current-analysis source update action. Already-sent source immutability is deliberate product policy; manual follow-up remains available after source changes, while a second claim/rebase is unavailable.

## Source review result

Passed within examined scope; no open medium/high/critical UX findings. Human decision badges remain neutral and separate from engine red/green/amber status. Review captures a required reason, original finding index/run, actor/date history and current revision/fingerprint. Conflict refresh preserves entered reason and requires explicit comparison before retry. Eligible per-row preparation is one explicit finding, one economic request per invoice; non-verifiable/probable clarification uses no requested amount. Source eligibility and current confirmation remain server responsibilities, separately reviewed.

Claim detail presents editable saved subject/body/recipient with recipient empty unless user provides it; no email is inferred. Copy denial gives a selectable text fallback. Copy/download do not register sending; JSON export copy explicitly states originals remain separate/private. Retained export versions remain downloadable without claiming a new emission. Draft/source/export histories preserve previous wording and source versions. Stale current emission is blocked with a clear explanation, with explicit source update offered only for unsent drafts under product policy. No automatic email, posting, payment or recovered-money metric is represented.

Follow-up summary is outside collapsed panels and uses local calendar date strings rather than interpreting a due date as a UTC timestamp. Closed/rejected claims are excluded from upcoming/overdue counts. Manual send registration requires entered recipient and explicit external-send confirmation; response, follow-up and resolution capture note/time and relevant due date/outcome. Resolved/rejected states do not imply money recovered.

Existing loaders, semantic dialogs, named fields, textarea fallbacks, native disclosures and table regions are reused. Claim arrival focuses the detail heading; returning focuses claims heading. Fresh authorization is inherited from the organization guard, with query keys scoped to user/organization/operation. Source review does not certify runtime keyboard behavior or membership isolation.

## Required runtime evidence and limits

QA/browser executing agents must attribute actual tests and screenshots: reviewer dialog keyboard/focus, draft conflict preservation, denied copy fallback, stale emission/rebase, viewer and mobile/zoom. Backend tests must cover authorization, decision eligibility, immutable snapshots, manual transition validation and export traceability. This record does not claim those tests were executed by this reviewer. No pixel-fidelity or accessibility certification is claimed. See docs/design/reviewed-claims.md and .agents/reviews/reviewed-claims-product.md, reviewed-claims-architecture.md and reviewed-claims-qa.md for separately owned evidence.

## Final resolution-choice correction

UX-C4 / product RCUI3, medium, resolved by source reinspection: Resolver initially selected Retirado by default, so the recorded outcome could be saved without deliberate selection. The resolved-only outcome now starts empty, resets on dialog opening, exposes a required placeholder and has a submit guard with an explicit choose-result message. Rejected remains the fixed rejected outcome. This agent examined the final claim-detail.tsx correction; the later browser test for missing outcome belongs to its actual executing agent.

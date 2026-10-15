# Reviewed claims — architecture/security/data/integration review

Reviewer: `/root/analysis_architecture`, independent execution from production/backend and product/domain authors. Owns ADR 0006 and this review only. Read AGENTS.md, workflow, relevant profiles, current analysis/review schema/application/routes and ADR 0005; consulted product/logistics and backend/frontend before dependent implementation.

Prior contract: `docs/adr/0006-reviewed-claims.md`. Coordinator accepted one claim per operation/invoice document, started from one selected finding without aggregation; correction requires current confirmed monetary support, clarification is explicitly unpriced. Decisions increment a separate reviewVersion, never the operation input revision. Typed optimistic versions, current fingerprints and serialized operation/claim transactions protect actions; append-only decisions, source versions, drafts and events preserve evidence. Export is authorized plain TXT plus JSON dossier, not email transmission. Manual sent/responded/follow-up/resolution require explicit event dates/reasons and valid transitions. Only draft/exported sources may explicitly rebase to a new current finding of the same document; sent claims cannot silently change or duplicate.

Planning status: decision completed and shared before implementation. Final independent backend/schema/contracts/export/test-source review pending. No source approval or runtime success claimed at this stage.

## Incremental findings before final approval

The candidate production source was independently read; review remains open while fixes land.

- C1 high: the first dossier/source schema stripped captured document filenames/checksums and omitted explicit parser/rule/run provenance, input warnings and actual draft identity/version. Backend notified to retain typed immutable source metadata and export version lineage.
- C2 high: locking only the operation row without updating it during claim edit/event/export can leave a RepeatableRead contender with an old claim snapshot and produce a unique-history P2002/503. Require a claim row lock/CAS with safe conflict handling and a real `[200,409]` concurrent mutation test.
- C3 medium: readClaim loaded 100 full source snapshots plus all drafts/events even for every summary in an operation review; large source histories/polling could consume excessive DB/response resources. Require current-only summary reads and explicitly bounded/paginated history, preserving actionable sent-event lookup independently of any truncated display window.
- C4 high: event chronology checked only the first sent date, not claim creation/last business event, and a 100-event display window could lose the original sent event. Require business chronology and permanent sent evidence lookup rather than accidental history-window dependence.
- C5 high: clarification eligibility used a denylist that could allow operation mismatch or fiscal review findings. Require an explicit permitted clarification scope, invoice source and no monetary assertion.
- C6 medium: export needs exact version/time/content-hash audit so its bytes and source/draft version can be traced without retaining sensitive attachment bytes in logs. Exported must never overwrite sent state; candidate code already rejects post-sent export.
- C7 medium: initial draft omitted invoice reference although Phase 2 extraction may contain it. Preserve a version-correct invoice reference where available or use an explicitly labeled document filename/ID fallback, without inventing a number.

These are implementation review findings, not runtime test claims. Final review must reread corrections and record real-service CI separately.

## Final independent source review

Passed after rereading the completed backend/contracts/schema/migration/route and acceptance-test diff against base `a66134e824696af204621a3257d9b17773134c95`. No production code or tests were authored by this reviewer. Verification here was source inspection (`cat`, `sed`, `rg`, `sha256sum`); actual service execution remains CI acceptance, not a claim made by this record.

All C1–C7 findings are resolved in the reviewed source:

- C1: typed source data preserves document metadata, captured invoice reference, rule/parser/run versions, input warnings, selected decision, source provenance and snapshot. Dossier records actual draft ID/version and source version, plus bounded draft/event/source-history lineage.
- C2: every claim mutation takes both tenant-scoped operation and claim row locks before version checking; route error handling preserves P2034 and raw SQLSTATE40001 safe 409 responses. Independent test-source review confirms concurrent edit/edit and edit/export require exactly `[200,409]`.
- C3: review summaries fetch scalar claim rows plus source fingerprints through a bounded tenant-scoped query, without loading each full history. Claim versions cap at 100 and source versions at 10; corresponding bounded detail windows therefore cover all permitted entries. Export limit is 512 KiB before commit, and historical artifacts remain downloadable separately. These are pilot limits, not measured scalability guarantees.
- C4: sent evidence is queried permanently rather than from the display window. Events require nonfuture dates at/after claim creation and the latest business event; exported technical events are excluded from that chronology. Terminal states reject further events; rejected/resolved outcome combinations are validated. Manual send requires confirmed recipient and current source; no mail adapter is called.
- C5: explicit clarification allowlist excludes fiscal/arithmetic/operation-mismatch flags; invoice source with real document ID is required. Correction amounts come only from eligible positive immutable differences with known provider/currency, without Number arithmetic or summing flags. Clarification retains null amount.
- C6: exports persist exact private bytes, SHA-256, export/source/draft versions, actor and time atomically with the export event/audit. Historical GET is separately authorized, checks integrity, and does not reset sent state. Creating a fresh export is blocked after sent/terminal state or source/decision changes.
- C7: invoice reference is reconstructed from the exact captured extraction plus correction revision boundary, preserved in the source and used in the draft; filename/explicit pending reference is the fallback, not an invented invoice number.

Schema review confirms composite tenant foreign keys for operation/run/document claim relationships and child claim records; unique organization/operation/document prevents reanalysis duplication. Rebase only updates an unsent claim explicitly, requires current confirmed input/review versions and the same invoice, appends immutable source/draft versions and resets the draft for human review. Decisions use separate reviewVersion and do not invalidate their source analysis by incrementing operation input revision.

The four expanded real-service test groups were independently read: 62 USD flow with append-only review, exact persisted export bytes/hash/provenance and manual lifecycle; stale source/decision rejection plus explicit rebase with retained source; clarification and tenant/role/Origin/revocation protection; concurrent decisions and denied client monetary/fiscal/mismatch/arithmetic cases. Source coverage is meaningful; runtime success is pending CI.

Reviewed SHA-256:

```text
d57a8a0259b1a3b9c4dd61cd4992430c31b1006366cb0144577414b3cfbce201 packages/application/src/claims.ts
a6ac02747b925a51de8b5cf34e6c19597b30a8cf56ba456008ce5a92ee6aa84c packages/contracts/src/claims.ts
6ccd7d2f53039f529475bb514292a5d97f83cb1d1d679bd07f2d3347f2329ffc packages/database/prisma/schema.prisma
caa47aae7fb00c02368df6d76fc12d36424e252621acc2383d525fe84f0628ba packages/database/prisma/migrations/20261016120000_claims/migration.sql
7442d676f3a0062a535fa81a61acff72d42d648c6bf0d9c747142d52a6ee7aec apps/api/src/claims.routes.ts
6bae34bd485c826fde70483d170051123487fad586c3c5382c2210d1f6000e06 apps/api/test/claims.integration.test.ts
```

No critical/high source findings remain open in this scope. Existing real-data/deployment prerequisites, one-claim-per-invoice limit, manual follow-up, lack of automatic email and lack of recovered-money validation remain explicit. This is independent source approval, not production readiness certification.

## Reopened review — RC-R1 decision obsolescence

Coordinator review found a blocking behavior missed in the preceding source approval: summary/detail `stale` compared only analysis input fingerprints. A later decision can change with identical source inputs, so `assertCurrent` rejects export/edit with REVIEW_CHANGED while the UI still considers the draft current and does not offer explicit rebase. Confirm → dismiss → confirm can therefore trap an unsent draft despite an otherwise valid current analysis.

Prior final approval is reopened for this scope until correction is independently reread. Required fix: stale if source fingerprint differs **or** the latest exact organization/operation/run/finding decision identity differs from the captured source decision, including repeated confirm with a new decision ID. Detail and summary queries must remain bounded. Historical reads stay allowed; a reconfirmed same-run finding must support explicit unsent rebase with immutable prior source/draft versions and no duplicate claim. Add actual HTTP coverage for reversal, reconfirmation, stale DTOs and same-run rebase recovery. Backend owns implementation/tests; this reviewer remains independent.

## RC-R1 correction independently reexamined

Incremental source approval reinstated after reading the complete correction and new HTTP assertions. Detail now queries the latest exact organization/operation/run/finding decision by descending ordinal and marks stale when its ID differs from the captured source decision or its action is not confirm, in addition to fingerprint changes. Summary uses a tenant-scoped lateral latest-decision query with scalar IDs/action and the same condition, retaining bounded reads instead of loading histories. Missing latest decisions fail closed as stale. Source snapshots and original decisions remain immutable.

The expanded real-service test source exercises dismiss reversal in both summary/detail, reconfirmation that remains stale until explicit same-run rebase, successful rebase restoring current state and export, unchanged prior source/draft, and a later new-run rebase preserving all three source versions. This closes the formerly trapped-draft path without weakening current export checks or duplicating a claim.

Reviewed corrective SHA-256: application `3a13c13a681e160d3f73d4b2c2637e23b9614b7e11ae27a6feeadf650d3b8443`; HTTP tests `f011fa0787bde3cb60bb6bceb9c262fc7c2e7920ebb58f8ee43dd3efda493459`. No production code or tests were authored by this reviewer. RC-R1 is resolved in source; actual CI execution of this correction remains required and is not inferred from earlier runs. No critical/high source findings remain open in the reviewed scope.

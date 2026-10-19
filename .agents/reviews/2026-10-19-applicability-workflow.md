# Applicability workflow implementation evidence

Role: frontend-engineer with scoped application/backend implementation. Execution: `/root/workflow`. Mode: implementer checks, not independent review. Applicable profiles read: frontend, backend, security, UX and visual; planning consultation supplied by `/root/planning` before dependent implementation.

## Scope

- Application preserves authorization, tenant-scoped source access, optimistic concurrency, immutable agreement versions and historical analysis snapshots.
- Authorized selection accepts missing and incompatible business context without treating the choice as verified applicability. Nullable binding fields and nullable historical confirmation provenance use an additive migration. Unchanged invoice confirmations preserve their original actor/time/reason when another invoice changes.
- Creation validates nested references, conditions and charge evidence against the actual selected PDF/run/page/snippet. Fact revisions validate and stamp nested references, equipment quantities, applicability conditions and restrictions.
- New published agreements inherit typed operational references from their source. Legacy published agreements missing typed references or applicability derive them from the pinned extraction and correction revision into new snapshots only. Missing source data stays unknown. Current linked agreement facts missing an applicability model are also normalized before analysis, including human revisions that omit the field.
- Native reviewed provider/service conditions preserve evidence; absent contracting party, route endpoints, modality and equipment remain unknown unless the source explicitly documents a restriction or unrestricted scope. Missing required date basis stays unknown.
- Internal DS UI separates documentary links, applicability conditions/candidates and economic findings. Native controls cover actual equipment/counts, typed references, route, parties, mode and dates. Advanced validated JSON handles arbitrary structured conditions and charge tables. Line-item agreements require documented lines and allow per-line currencies with no fabricated global price/currency.

## Actual checks

- `pnpm build:packages`: passed after shared schemas, line-items mode and source reference preservation.
- `pnpm --filter @reconcile/application build`: passed after applicability normalization of legacy and current snapshot agreements.
- `pnpm --filter @reconcile/web typecheck`: passed after UI/native control/line-items changes.
- Targeted ESLint across modified application, contract, UI and API test files: passed. Final normalization application/test lint also passed.
- Frontend presentation tests: 2 files, 8 tests passed.
- `node apps/web/test/agreements.browser.mjs`: passed six groups with synthetic HTTP fixtures: line-item publication without global amount/currency, invoice-specific selection, nullable missing context, applicability pending evidence, retained historical snapshot/stale notice, conflict recovery, mobile width/footer, keyboard focus/Escape, viewer controls absent and zero runtime errors. Mobile PNG inspected at `/tmp/agreements-qa-mobile.png`. Browser evidence precedes later backend-only source normalization; it does not certify backend authorization or extraction accuracy.
- `node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts apps/api/test/agreements.integration.test.ts`: 5 tests passed against local infrastructure after normalization. Covers omitted applicability pending/no price match, inherited source booking reference, pinned legacy extraction despite newer current extraction, unchanged confirmation metadata, organization isolation, audit and immutable analysis history. One earlier run failed because the synthetic test used unsupported `Booking:` instead of the extractor's documented `Booking reference:` label; fixture corrected and rerun passed.
- Nested evidence API regressions added to `analysis.integration.test.ts`; full integration execution belongs to coordinator.

## Findings and limitations

Resolved: selection formerly rejected semantic mismatches before recording them; missing dimensions could become wildcard legacy conditions; selected publication could erase source references; nested new evidence could evade source validation; changing invoice B could rewrite invoice A confirmation metadata. Browser caught a Zod `.pick()` call on a refined object; replaced by a dedicated strict schema and browser rerun passed.

Advanced condition/table authoring remains technical JSON. Native equipment/count/date/reference controls reduce this burden but do not claim arbitrary PDF matrix extraction. No deployment, merge, sending messages or external approval occurred. Full `pnpm check`, complete integration and service smoke are coordinated separately by `/root` and are not attributed to this implementer run.

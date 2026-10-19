# Engine implementation evidence

- Execution: `/root/engine`, canonical backend-engineer implementation profile; sequential implementer checks, **not independent review**.
- Scope: `packages/domain/src/analysis.ts`, domain exports, `packages/contracts/src/analysis.ts` (shared schemas subsequently coordinated with workflow agent), `packages/sector-rules/src/logistics/{evaluate,applicability}.ts`, own `evaluate.test.ts` additions.
- Read: AGENTS.md, workflow, backend/domain profiles, README, architecture overview, implementation plan, git workflow/TDD skills. Consulted `/root/planning` before dependent implementation.

## Implemented behavior

`logistics-v3` separates operation references and reusable agreement identity. Typed references compare within their type; explicit conflicts remain reviewable. Applicability decisions persist sources/version and verified, unrestricted, unknown or contradictory conditions. A missing required date remains pending; reviewed service-date context cannot substitute a shipment/booking date. Explicit selections retain tenant and scope checks and cannot override contradictions. Candidate resolution uses no ranking or order priority.

Economic comparisons preserve signed decimals and line currency, avoid mixed-currency total arithmetic, use actual container/BL/shipment counts, keep conflicting counts pending, and do not add included package concepts. Corroborating quantities are normalized and deduplicated. Structured reviewed terms support line-items with nullable header currency rather than a fabricated dummy rate. Old snapshots remain accepted through additive optional schemas; legacy absent applicability retains service-date/provider/service-route semantics.

## Checks actually run

- `pnpm --filter @reconcile/domain build`: passed.
- `pnpm --filter @reconcile/contracts build`: passed before later workflow schema changes; root owns final workspace build.
- `pnpm --filter @reconcile/sector-rules typecheck`: passed after final engine edit.
- `pnpm exec vitest run packages/sector-rules/src/logistics`: **64 passed**, 20:56:08 local run (53 implementer tests plus 11 independent reviewer tests).
- Focused ESLint on owned domain/analysis/engine files: passed before final review corrections; root owns final lint.
- Owned files formatted with Prettier after final edits.

## Findings and limits

Independent findings were supplied by `/root/review`; their separate evidence owns the review conclusion. Implementer fixed missing operation identity, typed booking contradictions, selected service/date decision consistency, missing-route pending, operational context preservation, equipment contradictions, quantity reconciliation and traceability. Generic restrictions without an implemented evaluator remain unknown. No FX conversion support was fabricated. Package inclusion stays non-verifiable rather than automatically asserting an overcharge. No deployment or merge performed. This agent did not run service smoke, browser checks or full workspace checks; coordinator owns those.

Final follow-up: factored shared selectedContext and operationContext helpers; selected reference restrictions persist in immutable terms and are enforced for legacy bindings too. Tariff equipment and quantity selection reuse the same unique operational context as applicability. Contradictory reviewed date/route cannot reach structured economic comparison. Final sector typecheck and 64 tests passed after these changes.

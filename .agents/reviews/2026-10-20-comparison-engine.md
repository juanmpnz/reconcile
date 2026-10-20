# Contract/invoice observational comparison implementation

Execution: `/root/commercial_engine`, delegated implementation. Roles consulted: backend-engineer and logistics-domain profiles. Read AGENTS.md, shared workflow, product pilot requirements, implementation plan and architecture overview. This record describes actual implementation/self-checks, not independent approval.

## Scope and behavior

Files: logistics `concepts.ts`, `comparisons.ts`, `comparisons.test.ts`, plus version/output attachment in `evaluate.ts` and its version test. The pure engine emits additive `comparisonCandidates` under `logistics-v6`, with explicit bilingual alias version `commercial-concepts-v1`.

Each invoice line remains represented even when no known alias or reference exists. Known aliases match by semantic concept, origin/destination scope, billing unit and equipment; no price similarity or equal-amount matching exists. Generic freight/flete can produce an observational marine candidate but requires documented maritime context and stays pending for unknown mode, or contradictory for another mode. Unknown labels never auto-match, even when identical. Curated public shipping vocabulary also covers distinct origin wharfage, origin equipment transfer, carrier security, marine fuel recovery, emission allowance, equipment maintenance and import service; generic terminal handling is not inferred as equipment transfer. MFR and emissions remain pending for clause/region verification; lumpsum remains pending for inclusions. Public terminology sources are recorded by the principal engineer in the ADR.

The result preserves reference and invoice line identities, original unit-price currencies, observed quantity, expected/actual comparable amounts when supported, source evidence, conditions and reasons. Price equality/difference is separate from overall applicability. All candidates are literally nonclaimable. Existing finding/claim semantics remain separate; when explicit pricing terms require review, the legacy per-line financial path is blocked from simultaneously confirming a claimable difference.

Original tariff price and currency are an atomic pair. Partial original metadata never falls back to a booked amount with a different currency. Conversion remains a separate pending condition; original-currency unit-price observations remain visible. Comparable same-currency booked amounts are retained, with arithmetic contradictions explained separately.

Variable or unknown pricing behavior remains pending. Explicit row validity checks use only the named date basis. Missing basis/date or out-of-period rows cannot assert applicability. Monthly/annual rates require recurring calculation review; no generic quantity is interpreted as a temporal multiplier. A shared aggregate-supported guard also prevents incompatible billing unit/equipment or cadence from producing aggregate deltas. Such rows omit aggregate expected/actual amounts, delta and calculation. Opposite deltas stay individual observations and never become an automatic net claim.

Alternative output is limited to eight candidates per invoice line. More alternatives retain an explicit candidate-limit/pending reason, never silently select one. All invoice lines remain represented. Candidate evidence uses row evidence and bounded relevant condition evidence rather than copying entire document evidence; condition evidence is bounded as well.

## Validation

- `pnpm exec vitest run packages/sector-rules/src/logistics`: passed, 112 tests in 3 files, including 33 new comparison tests.
- `pnpm --filter @reconcile/sector-rules typecheck`: passed after domain/contract build.
- Prettier applied to changed files.

Regressions include bilingual unknown-service rows; correct and differing fixed prices; pending provider/acceptance; original-currency observations with conversion pending; unknown aliases; scoped origin/destination; equipment alternatives and ambiguity; bounded alternatives; opposite signed deltas; variable, expired, monthly and annual terms; unknown date basis; partial extraction; missing quantity/evidence; booked amount inconsistency; atomic source price/currency; and generic freight false friends.

## Limits

Fixtures use independently invented synthetic names, evidence, prices, quantities and dates. No private source identities or extracted values were copied into tests/docs. This implementation does not certify general alias coverage, perform exchange conversion, validate tax rules, reconcile recurring charges, automatically net grouped charges, or turn observations into approved claims. Independent review, integrated API/browser tests and production deployment are coordinated separately by the principal engineer.

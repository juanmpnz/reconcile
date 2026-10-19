# Commercial extraction — API regression

- Agent `/root/api_tests`, backend-engineer / QA implementation; test author checking is sequential, not independent certification.
- Scope: `apps/api/test/analysis.integration.test.ts` only; read AGENTS, workflow, role instructions previously in this session and `.agents/tasks/2026-10-19-commercial-extraction.json`.
- Added real-service test using newly generated synthetic PDF bytes only: uploaded commercial invoice has original USD tariff prices, billed EUR amounts, negative adjustment, quantity/equipment and literal source FX; quotation matrix has separate equipment rates.
- Assertions: absent provider stays null; source values remain distinct; analysis produces line-specific outcomes without `LINES_MISSING` or invented economic confirmation; nested FX forged page/snippet rejected; reviewed FX evidence revision pinned and historic snapshots unchanged.
- No private invoice text, real company identifiers or private values used.
- Local service-backed execution unavailable: no isolated DATABASE_URL/service infrastructure. Formatting and coordinated API typecheck outcomes recorded below when complete. CI must execute the service-backed acceptance.

- Formatting passed for the added regression.
- `./node_modules/.bin/tsc -p apps/api/tsconfig.test.json --noEmit` passed (exit 0) with additive FX contracts.
- Exact-array PDF→parser→rule smoke initially used stale document-processing dist (no commercial adapter yet); intentionally not reported as acceptance. Awaiting coordinated parser build.

## Final no-service real PDF smoke

Exact synthetic line arrays from the API test were passed through `makePdf` → real `extractPdf` PDF.js worker → `deriveAnalysisFacts` → `evaluateLogistics` using coordinated built packages. Exit 0: 2 invoice rows and 6 equipment tariff rates; original USD prices 100.00/-5.00 distinct from billed EUR amounts 180.00/-9.00; provider null; source FX 0.90 preserved; both invoice rows produce `FX_CONVERSION_REVIEW` / not-verifiable, no false confirmed finding or missing-lines warning.

The real PDF smoke exposed PDF.js typography normalization (`40'` → `40’`), which initially lost equipment grouping. Parser agent fixed straight/curly apostrophe support; repeat smoke now preserves `40HC` for both invoice rows. Fixture uses synthetic `002 CONT. 40' X 9'6 HIGH CUBE CONT.` grouping.

Forged nested FX page now uses schema-valid but source-absent page 2, rather than out-of-bound 999, so expected `INVALID_EVIDENCE` exercises source validation. Added mismatched source document ID carrying the original snippet as another rejection case.

Final API test TypeScript check after the FX negative-case and realistic group changes passed: `tsc -p apps/api/tsconfig.test.json --noEmit`, exit 0, no diagnostics.

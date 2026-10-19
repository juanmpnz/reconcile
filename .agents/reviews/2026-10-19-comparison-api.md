# Comparison dossier — API integration regression

- Agent: `/root/api_tests`, delegated backend-engineer / QA implementation.
- Scope: `apps/api/test/analysis.integration.test.ts`; test author checks are sequential, not independent certification.
- Read: AGENTS.md, .agents/WORKFLOW.md, manifest, backend/security/QA profiles, application fact revision and analysis contracts.
- Added one real-service regression: upload PDF tariff and invoice, extract through document worker, create arbitrary internal dossier label, process through analysis worker, assert applicable agreement and invoice-only economic difference. Tariff has no shipment/operation reference; invoice has its own external operation reference and typed agreement reference.
- Revision step confirms tariff extraction against source, recalculates into a new run, checks original tariff bytes and prior snapshot/result remain unchanged. Foreign tenant analysis access is denied.
- Synthetic documents prove supported structured extraction; this is not evidence that arbitrary commercial tables can be parsed.
- Infrastructure inventory: no `.env`, `pg_isready`, `redis-cli`, or `docker` available. Focused integration command attempted, pending startup; API test TypeScript check pending at time of record. Coordinator will append final command outcomes.
- Commands: `./node_modules/.bin/prettier --write apps/api/test/analysis.integration.test.ts`; `./node_modules/.bin/tsc -p apps/api/tsconfig.test.json --noEmit`; `./node_modules/.bin/vitest run --config vitest.integration.config.ts apps/api/test/analysis.integration.test.ts -t 'generic tariff in an arbitrary'`.
- No production/server access or real sensitive documents used. No implementation outside test scope.

## Command outcomes

- Focused integration: failed before test execution in identity fixture setup: isolated `DATABASE_URL` is absent; 15 tests skipped. No integration pass claimed.
- Direct API test TypeScript check: failed on stale generated/build artifacts across existing workspace APIs (missing agreement list/create exports, MFA Prisma properties and agreement decision fields). Requires package rebuild and Prisma generate before meaningful API type gate; coordinator informed.
- Formatting of the modified test completed successfully.

## Financial review guard regression

Added `apps/api/test/claims.integration.test.ts` regression for a deliberately injected persisted legacy finding targeting a tariff. The real authenticated HTTP review mutation must return 422 `INVOICE_SOURCE_REQUIRED` and leave review version, decisions, claims and `finding.reviewed` audit count unchanged. This exercises the new server guard against historical or malformed non-invoice targets; the seeded result injection is explicit and does not claim an end-to-end legacy engine reproduction. Integration remains unavailable without isolated services.

After coordinated package rebuilding, `./node_modules/.bin/tsc -p apps/api/tsconfig.test.json --noEmit` passed (exit 0) including both new integration regressions. Claims test formatting passed. No service-backed integration pass is claimed locally.

## Parser-to-rule execution without services

Corrected synthetic fixture to include explicit accepted agreement evidence and shared `Route: Port A` (required by existing supported extraction/line matching). Executed a temporary Node script using the exact PDF line arrays from the integration regression, `makePdf` → real `extractPdf` PDF.js worker → `deriveAnalysisFacts` → built `evaluateLogistics`. Exit 0: invoice external reference `SHIPMENT-410`, tariff operation reference null, accepted tariff; logistics-v4 decision applicable; invoice-only `PRICE_OR_QUANTITY_DIFFERENCE`, expected 150, invoiced 160.00, difference 10 USD. This validates supported synthetic parsing/rules, not DB/HTTP/worker persistence.

# Document metadata and global listing — self-review

Execution `/root/analysis_backend`, backend/document processing implementation with data/security constraints consulted. Sequential implementation review; independent architecture and QA review are separate.

Scope: documents contracts, additive metadata version migration/schema, document application/routes, analysis freshness projection, and focused document/analysis/claim HTTP tests.

PATCH document requires strict filename/type/version/reason, fresh verified writer, exact trusted Origin and existing per-actor mutation throttle. Filename is a bounded .pdf display label without control characters or path separators. A Repeatable Read transaction locks the tenant-scoped document row, rejects stale versions, preserves no-ops, increments a bounded metadata counter and appends before/after actor/reason/time/version audit. Original storage key, bytes, checksum, extraction runs and scalar corrections are untouched. Detail exposes newest 50 metadata events ordered by numeric metadata version, from at most 1000 revisions.

Renames retain reviewed financial facts: metadataVersion is added only to analysis sources when >0, outside the fact source fingerprint. This preserves the previous v0 fingerprint representation. Renaming/classifying makes all linked analyses and claims stale through live source collection; changing kind additionally changes the existing fact source fingerprint, requiring new classification review. Historical snapshots/results remain immutable.

Document list query accepts q and an explicit order allowlist. PostgreSQL CTEs project only extraction fields and latest exact-run reference correction, scope all real operation links to organization, search globally and order with deterministic ID tie-break before LIMIT/OFFSET. A separate count uses the same filtered CTE in Repeatable Read. Only page document rows and at most 20 real operation labels plus total association count are loaded; full PDF pages are not loaded for listing. Extracted/corrected references are presented separately from actual operation associations.

Added actual HTTP acceptance groups cover metadata/history/no-op/race, unchanged original/checksum/extraction/corrections, global search/order across page boundaries, invalid sort/input/Origin, viewer/foreign isolation; reviewed fact retention on rename and invalidation on kind change, source metadataVersion capture and historical immutability; existing claim staleness/export rejection while preserving sources and draft history. Real infrastructure execution is delegated to CI; not claimed here.

Validation: Prisma client generation and strict contracts/database/application/API test compilation passed. Changed-file ESLint was run (initial control-regex style issue fixed with explicit code point validation). Coordinator canonical check/real CI will establish final evidence. No OCR, financial engine, demo fixture, payment, external integration or original-file changes.

# Document metadata and operation usability — architecture/security/data

Reviewer `/root/analysis_architecture`, independent from backend/frontend implementation. Read current document contracts/model/application, analysis source fingerprints and existing tenant/security profiles under AGENTS/workflow. Owns this review only; no implementation.

## Prior contract

Add strict tenant-scoped `PATCH /api/v1/organizations/:organizationId/documents/:documentId` with `{filename,kind,expectedMetadataVersion,reason}`. Name is bounded display metadata (existing 200-character limit and safe filename sanitization), kind uses the existing enum, reason is nonempty/bounded. Reuse fresh verified writer authorization, exact trusted-Origin policy, throttling and no-store. Viewer reads only; foreign/missing IDs return non-disclosing404.

Introduce metadataVersion integer default0 for optimistic writes; lock document row before comparing expected version and update only on real name/kind changes. Stale writes return409 and retain UI draft. A no-op creates no false revision. Persist an atomic append audit with actor/date/version and bounded before/after filename/kind; expose bounded metadata history in authorized detail. Existing audit details can hold history without copying originals or adding an unrelated document-version model.

Never change original bytes, storageKey, checksum, extraction runs/results or scalar correction history during metadata edit. Download filename is presentation metadata and must continue safe encoding. Extraction jobs do not derive their content from kind/name, so no need to reupload/reparse or block editing simply because extraction is queued; completed/captured analysis snapshots remain immutable.

For staleness, preserve old input fingerprints for unedited metadataVersion0 documents: add metadataVersion only when positive to the source-provenance record participating in the operation fingerprint, and declare it optional in source contracts. Do not put this metadata version inside the separate financial sourceFingerprint used to select reviewed structured facts: a rename should mark prior analysis historical while retaining those reviewed facts. A kind change already changes financial sourceFingerprint, so old classification-specific fact reviews stop applying. This fingerprint strategy covers all linked operations including concurrent link creation, without updating every operation or changing unrelated old fingerprints.

Operation search/sort must have clear scope. Do not present filtering of one loaded page as a search of the whole organization. If server-side queries are introduced, validate bounded search and an explicit sort allowlist with deterministic ID tie-breaker; no interpolated SQL sort strings. New table columns should use bounded summary queries rather than one heavy full-detail request per row. A job completed label is not financial approval; no new money aggregates or sector rules are needed.

## Acceptance and review boundary

Actual-service checks: writer edits original name/type without changing bytes/run/hash/storage; history before/after; no-op; stale and concurrent writes200/409; viewer/foreign/revoked/Origin rejection; renamed document marks old analysis/claim stale while retaining financial fact revision; kind change invalidates prior classified facts; metadataVersion0 source shape remains compatible; new analysis captures metadata version. Browser checks: compact dialog from row, visible disabled reasons, retained drafts/conflicts, meaningful columns/search/sort and full-width compact header.

Planning complete and shared before dependent implementation. Final independent backend/schema/contracts/test-source review pending; no runtime execution claimed.

## Final independent backend/security/data source review

Passed after rereading the final candidate based on `1bc136dbe60618838a519c94e522a7676de2904a`. Scope: strict document metadata/query contracts, application metadata edit/detail/list, analysis provenance delta, additive schema migration, HTTP route/error handling and new real-service test source. This reviewer authored none of those implementation/test files. Browser UX and pipeline execution are coordinated separately.

Metadata editing locks the tenant-scoped document row in RepeatableRead, checks the expected metadata counter, preserves no-op behavior and atomically stores before/after audit on actual change. Existing authorizer/Origin/throttle/no-store rules apply to PATCH. Invalid paths/control characters/non-PDF display names are rejected; original bytes/storage/checksum/extraction/corrections are not modified. Prisma/raw serialization errors retain safe409 handling. Cap1000 metadata revisions bounds audit storage; latest50 displayed events are selected by their monotonic version after a bounded maximum1000 read, resolving DM1 (timestamp ties could otherwise misorder history).

Compatibility reviewed: source provenance only includes metadataVersion when greater than0, preserving old unedited fingerprints. The financial sourceFingerprint does not include this presentation revision, so rename preserves reviewed facts while marking old analyses/claims historical through their overall fingerprint. Kind still participates in the existing financial sourceFingerprint, so classification-specific reviewed facts do not silently apply to another kind. Historical snapshots/results remain untouched.

The initial list implementation loaded every current extraction page result before searching; that capacity issue was corrected before approval. Final PostgreSQL CTE is tenant-scoped, projects only required scalar document fields, an exact-run latest reference correction, JSON field reference and linked operation names/references. It filters/sorts/counts in the database and selects paginated IDs before loading DTO metadata and at most20 visible operation links plus count. No extraction pages/full results or per-row heavy operation details are loaded for the table. Search uses parameterized literal substring matching, not wildcard SQL or concatenated user SQL. Dynamic ORDER BY comes exclusively from the validated constant allowlist and direction enum; ID ASC breaks ties and nulls sort last. Count and page run within the same RepeatableRead transaction.

Independent test-source review confirms metadata success/history/no-op/stale/race200409, original bytes/run/hash/corrections unchanged, global search and sorting before pagination, rejected unsupported sort/path/Origin/viewer/foreign resources, and rename-versus-kind behavior with original analysis snapshot/result intact. The test also verifies metadataVersion0 sources omit the new optional field. This is source review only; actual database/HTTP execution remains CI acceptance. Existing claim staleness consumes that same current fingerprint; no claim mutation or new financial rule was added.

Reviewed SHA-256:

```text
e302b26a080097e90f672c17d775ed4c672bfa1cf03c54ea8cbc5e70a635a577 packages/application/src/documents.ts
091d2afd878000af26551402ca7c6f6a7fb9813e411185c40b726888fd305b90 packages/application/src/analysis.ts
f9ea457b072565fe170fa1ac59909ff95b5a2ed1282be870ed1ba8ef5ae5e922 packages/contracts/src/documents.ts
e9801e0658ccff7e60c3c8e9b0339f01eb8f2cdbbf60f0b445d5a462b2732ac5 packages/contracts/src/analysis.ts
8732b5e0ff2fde3781e054de7a03d62dcd45e5fcd07253c373de5dc4f5d3e98b packages/database/prisma/schema.prisma
bfb72bf28b4e21f45303a96c501e15801e5275df8d0473cc221630feb6f58288 packages/database/prisma/migrations/20261016100000_document_metadata/migration.sql
c32d88ee3a3dfc81c49c8dd9252e0309ed5ce051108e9594f0caecd880521fa8 apps/api/src/document.routes.ts
7629fa7e862fe89065632e4bf8bba3342b5bcca7948e1b1a480475302d38e3d5 apps/api/test/documents.integration.test.ts
6cd0049b5350dcc981ea7001ce1787e9dce927795f42506ee96f027bfe86bb87 apps/api/test/analysis.integration.test.ts
```

Final source status: passed independent architecture/security/data review; no critical/high findings open. DM1 and the table extraction-page loading issue are resolved in examined source. Bounded50-entry metadata display is not full history pagination; all audit events remain persisted up to the explicit1000-edit cap. No throughput/scalability benchmark or runtime success is claimed here.

## DC-P1 Spanish search/sort correction

Incremental source review passed after inspecting the final SQL CASE label projections against the actual UI dictionaries in `apps/web/src/features/documents/api.ts`. All five document kinds and six statuses match the displayed Spanish labels. Search includes both internal enums and rendered labels; kind/status sorting uses the validated label aliases with the existing deterministic ID tie-breaker. Tenant scoping, literal parameterized search and PostgreSQL pagination/count remain unchanged, with no extraction-page loading introduced.

The existing real-service test group now searches `Tarifa` and `Requiere revisión`, verifying visible-label terms rather than only enum strings. Runtime execution remains pending CI. Corrective SHA-256: application document service `2bb0baa8dbe9fde9e2d82717a88732567be849d4306b673ddf43d02bedc09f43`; document HTTP tests `2dacaf732d3be5791728aef5583671acb190c73832f9082d82bc3c7a1baa6b5f`. Earlier unchanged reviewed files retain their captured hashes. No new critical/high findings.

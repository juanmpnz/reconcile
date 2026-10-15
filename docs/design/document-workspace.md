# Document workspace and loading states

Date: 2026-10-15. Status: planning blueprint before frontend implementation. Independent planning execution: identity_ui_review, roles UX/visual/UI/accessibility. Applies AGENTS.md and .agents/WORKFLOW.md; preserves docs/design/identity-interface.md. Scope: usable loaders plus phase 2 document intake/extraction review; no comparison, invoice approval, payments or claims represented as available.

## Shared loaders

Initial request without usable data: local skeleton sized like the actual table/form region plus one visible, polite status (“Cargando documentos…”). Skeleton decorations are aria-hidden; parent region aria-busy=true, one status announcement, never an endless full-screen overlay. Session initialization may use compact page-level status; keep navigation shell when already known. Do not show empty-state before initial response.

Background refresh with valid cached data: retain safe current rows and show small inline spinner/text (“Actualizando…”). No whole-table skeleton flash. If permission/context is being revalidated, preserve the existing stricter identity pattern: hide protected table contents and disable mutations until authorization settles. Server authorization remains authoritative.

Mutations: show bounded action label (“Subiendo…”, “Guardando…”, “Reintentando…”), disable duplicate submit, preserve entered values on error. Do not replace all buttons with generic global loading state. Dialog retains focus; processing starts after upload and must not hold a modal open for the entire extraction. No fabricated percentage; use determinate upload progress only when transport actually reports it. Processing reports textual stage and last update, no invented completion estimate.

Spinner: 14–16px neutral monochrome icon with adjacent readable status; decorative icon aria-hidden. Respect prefers-reduced-motion: stop rotation/pulse and retain static icon/text. Skeleton no shimmer under reduced motion. Loading, success and failure cannot rely on animation or color alone. Async status uses role=status; failures role=alert with focusable summary when caused by submission. Retry action always reports whether it is pending and the failed state remains intelligible.

## Navigation and document list

Use existing compact 200px sidebar/52px topbar, grayscale, 14px body/h1<=24. Organization detail gains a functional Documentos destination once backed by endpoints; keep Miembros/Invitaciones available. Breadcrumb Organizaciones > current organization > Documentos; deep document detail adds filename with wrapping. Scope is selected organization; switching clears prior tenant content, dialog input and pending detail display.

Heading “Documentos”, one primary “Subir documento”. Table toolbar: labeled name search, optional type/status filter only if implemented against real data, result count from returned data. Columns: Nombre (detail link), Tipo, Estado, Fecha de carga; action “Abrir”. Size may be metadata under name, not a new wide column. No invented supplier/amount/reference until extracted and reviewed. Long filenames wrap; original filename is text, never trusted HTML. Explicit DEMO badge only from actual demo metadata, not guessed from content.

States: initial loading, upload processing rows, no documents (upload instructions), no search results (clear action), failed request (retry), insufficient permissions (explanation without forbidden upload button), session expired (sign-in action). Paginate only with real server paging/total; do not imply server totals from a partial page.

## Upload

Accessible dialog with visible file input; drop zone is optional enhancement, never the only input. State allowed extensions and server-configured maximum size before choice. MVP single file unless backend guarantees batch semantics. Type select: Tarifa, Factura, Cotización, Otro as supported contract permits; do not infer document purpose silently. Filename, size and chosen type visible before submit; remove/replace chosen file works by keyboard. Client validation is advisory; display authoritative server rejection cleanly.

Cancel before submit restores trigger focus and discards file. While upload request is pending prevent duplicate submission and accidental dismissal unless actual cancellation is supported; don't claim cancelling the browser request deletes a server record. On confirmed upload close dialog, invalidate list, announce upload completion and show returned document status/detail. Extraction proceeds asynchronously; users may leave/revisit. Do not claim text is extracted just because upload succeeded.

## Detail and extraction review

Header: filename, document type and real processing-state badge; action open/download original only through authorized bounded URL. Metadata: upload date, file size, processing stage/error with non-sensitive explanation. Original PDF may use browser preview with fallback download; prevent document text from becoming executable markup and do not embed arbitrary remote URLs from extracted text.

Desktop detail uses document preview and extraction panel side by side when both exist; at narrow widths stack with clearly labeled navigation. Never shrink editable fields into an unusable narrow strip. Missing preview is an explicit unsupported/failed-preview state, not extraction failure.

Extraction states map exactly to backend lifecycle: awaiting processing/processing/completed/failed/review required only when contract supports them. Completed means extraction finished, not invoice accepted. If OCR/scanned pages unsupported, explain limitation and offer supported upload/retry path; don't show empty successful data.

Review shows extracted text/fields with page/source evidence where actually available, uncertain or missing values explicitly labeled. Editing requires actual save API and allowed role; otherwise render read-only with honest instructions. A correction remains separate from source document; preserve original/version provenance. Save announces success and invalidates current detail; on error preserve user edits. No checkmarks implying financial validity. Retry extraction only for supported retriable state and authorized capability; visible pending label and resulting job status.

## Verification acceptance

Keyboard upload/select/remove/submit/retry, dialog trap/Escape/focus return; 390px and320px no page overflow; long filenames; 200% zoom; reduced motion; one meaningful loading announcement; no empty-state flash; background refresh stable; failed/unsupported PDF state; navigation away during upload/process without stale redirects; tenant change cannot show former document data. Browser fixtures prove UI only; actual upload/private download/worker persistence/isolation need service integration tests. Obra Community exact nodes remain uninspected; no pixel fidelity claim.

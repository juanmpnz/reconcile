# Document foundation — independent UX/accessibility review

Date: 2026-10-15. Reviewer: /root/identity_ui_review, independent execution from frontend implementer. Roles: UX, visual, UI and accessibility. Read AGENTS/workflow/role instructions, docs/design/document-workspace.md, prior identity blueprint and document frontend files.

Planning completed before dependent implementation: document-workspace.md specifies loading states, neutral compact table/upload/detail/extraction review, reduced motion and provenance boundaries.

## Initial source findings

- Medium: Loading role=status is nested in aria-busy=true which remains true until unmount. Assistive technologies may defer the live status indefinitely; place status outside the busy subtree.
- Medium: DocumentList pagination with empty out-of-range page and positive total renders reversed ranges (e.g.26–25). Render explicit empty-page count or omit numeric range when no returned items.

Sent both findings to implementer/root. Initial status changes-requested; no high/critical identified.

## Positive source evidence

Local skeleton and inline refresh states distinguish initial/background; decorative spinner/skeleton hidden from accessibility tree; prefers-reduced-motion stops animation. Upload uses actual input with type/size guidance and keyboard remove, real contract types, duplicate-submit guard, structured server errors and no fake percentage. Detail explicitly separates extraction completion from financial validity, exposes missing/ambiguous values with source-page evidence and retained original, supports actual separate correction history. Scanned-PDF/OCR limitation explicitly stated. Private original download uses authorized endpoint; text rendered as React text/pre, no HTML injection. Tables use captions/scope/scroll regions; fields use unique IDs and accessible labels; Radix handles modal primitives. Existing monochrome compact visual tokens retained.

Limits: source review only so far; browser fixtures/screenshots/interactions to be independently attributed to QA, not financial extraction proof. No Figma exact-node fidelity claim.

## Independent recheck

Original two findings closed: live status is outside the busy/aria-hidden skeleton, and empty returned pages render “0 documentos en esta página”. canWriteDocuments is required in parsed context instead of inferred from role. Document queries are gated while context checks; protected DOM region hidden and upload/correction portals suspended via controlled open while preserving React inputs. Context denial unmounts protected view.

Identified resume-file concern during recheck: Radix suspension remounts native file input, so unconditional required would block an otherwise retained File. Latest upload input uses required={!file}, with submit !file guard, resolving the source issue. QA should verify selected-file -> context refresh -> resume -> successful submit. Corrected values remain separate from original extraction; latest correction selection uses server DTO ordering rather than comparing timestamp strings.

Independent pnpm --filter @reconcile/web typecheck passed at recheck. Final bounded source review passed; no remaining high/critical/medium source findings. Browser motion/dialog/overflow/permission-refresh proof remains separately attributed to QA. No screen-reader announcement or pixel fidelity claim.

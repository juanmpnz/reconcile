# Identity administration interface

Date: 2026-10-15. Status: implementation blueprint. Independent planning by identity_ui_review, covering UX, visual design, UI composition and accessibility. Scope: replace the identity interface; no invoice/document features or fabricated business data.

## Direction and reference

Accepted reference: Obra shadcn/ui Community Edition (docs/design/reference.md). Use a compact monochrome administration interface. Exact Figma nodes have not been inspected; no pixel fidelity claim. Component vocabulary: sidebar, breadcrumb, compact page header, input, button, table, tabs and dialog. Actual dependency adoption must be reported honestly.

## Shell and tokens

Desktop >= 900px: 200px sidebar, 52px topbar over remaining width, main fills remaining width with 24px padding. Do not center the application inside a narrow max-width card. Sidebar: Reconcile wordmark, functional Organizations link, signed-in identity and sign-out action. Do not add disabled/fake future navigation. Topbar: breadcrumb only when there is meaningful hierarchy; no marketing copy or duplicated page title.

Body: Arial/system sans-serif 14px, line-height 1.45. H1 22px, maximum 24px; section heading 16px; labels 13px; metadata 12px. White surfaces, #fafafa sidebar/table headers, #171717 text, #595959 secondary text, #d4d4d4 borders, #f2f2f2 hover. Primary button black/white; outline secondary button; black 2px focus ring with 2px offset. Radius 6px controls, 8px dialog. Control height 36px desktop, at least 40px narrow/touch. No green, colored status dots, eyebrow headings, hero, decorative half-screen panel or large shadows. States use explicit text and neutral badges.

At <900px, sidebar becomes a compact top navigation row; do not require a new drawer just to expose one destination. Main padding 16px; page heading and action wrap naturally. At <=420px auth/dialog padding 16px; form/action buttons remain reachable. Respect 200% zoom and 320px viewport without whole-page horizontal overflow. Tables may scroll within a labeled, keyboard-focusable horizontal region.

## Organization list

Page heading: Organizations / Organizaciones. Primary action: Create organization / Crear organización. Single short explanatory sentence is optional. Search with visible label filters authorized organizations by name/slug; no network call per keypress required for existing small list.

Real-data table columns: Name (link/button opens details), Identifier, Your role if actually returned by backend, Action (Open). Omit unsupported columns, never infer a role or member count. Rows ~48px; header ~36px. Semantic table with caption (visually hidden allowed), scoped column headers. Search result count announces politely; distinguish no organizations from no search matches. Empty state gives Create or invitation instructions. Loading rows/status, retriable request error and no-results clear-search action must be distinct.

Create opens a modal with title, Name and Identifier fields, Cancel and Create actions. On success close, refresh list, announce success and select/open created organization when its ID is available. Failed mutation leaves form values intact and focuses an error summary.

## Organization detail

Breadcrumb: Organizations > organization name. Heading: name; identifier and current user's role in small neutral metadata. Back to list remains available. No invoice metrics or placeholder cards.

Tabs: Members and Invitations, backed only by real supported API responses. Members table: Name, Email, Role; no removal/role editing in this redesign. Invitations table: Email, Role, Status, Expiry if returned; pending/expired/cancelled must reflect actual data. If a role cannot read a tab, show the permission explanation instead of a misleading empty table; do not call forbidden endpoints merely to populate a layout.

Invite action only for current server-confirmed capability; opens a dialog with email and analyst/viewer role. Disable submission while submitting or refreshing authorization. Keep invite context across login/register/verification. After success refresh invitations and announce outcome; never manufacture the new row locally as confirmed server state. Invitation acceptance has explicit pending, success, expired/invalid and mismatched-account states as backend errors allow.

Changing organization clears previous tenant display immediately; queries and mutations carry organization ID. Loading/permission refresh must not claim fresh confirmation. If current permission is denied, hide privileged actions and show retry/back options. 401 requests sign-in; 403/404 explain unavailable access; network/5xx explain service failure.

## Authentication

Single form, maximum width 380px, centered with generous but bounded margin; small Reconcile wordmark, 22px task title, necessary instructions only. No marketing hero or left panel. Preserve login, register, forgot/reset password, verification/resend states and invitation destinations. Visible labels and autocomplete; password minimum remains 12. Email success copy does not reveal account existence. Missing/expired token offers a working recovery link. Logout failure remains visible on every signed-in screen.

## Interaction and accessibility acceptance

Every async region has visible loading text and appropriate status/alert; forms use aria-busy and prevent duplicate submission. Errors have actionable copy and focus management. Dialog uses a proven accessible primitive or native modal dialog: accessible name, initial field focus, trapped Tab/Shift+Tab, Escape cancel when safe, focus restored to triggering control. Background is inert while open. Cancel must not submit. Keep filled fields on request error; clear on successful completion/intentional dismissal.

Tabs support keyboard semantics (arrow keys/Home/End when using tablist); otherwise use ordinary clearly labeled navigation buttons without pretending tab semantics. Focused elements remain visible. Form fields must have unique IDs even while underlying page remains mounted. Long names/emails wrap or have full accessible text; never clip critical identity. Native links/buttons only, no clickable row without keyboard equivalent.

Verify desktop and 390/320px layouts, 200% zoom, keyboard create/invite dialogs and focus return, loading/error/empty/permission states, and no horizontal page overflow. Browser fixtures must be labeled as UI evidence, not real authentication evidence. Independently review source after implementation and record browser limits separately.

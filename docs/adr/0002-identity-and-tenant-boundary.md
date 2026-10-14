# ADR 0002 — identity and organization boundary

Accepted contract, 2026-10-14. Better Auth/Prisma handles users, sessions, accounts, verification, organizations, membership and invitations. The existing organizations table remains the single tenant identity, UUID-backed; do not duplicate membership authorization elsewhere.

Use the official Fastify Request/Response bridge, fixed configured base URL and getSetCookie for multiple cookies. Explicitly enable native CSRF/origin protections in every environment (Better Auth otherwise skips origin checks in tests). The Fastify bridge additionally requires an exact configured Origin on browser auth POSTs and rejects cross-site Fetch Metadata; Referer is not a fallback. Email verification GET links support absent Origin. Server-to-server integrations must use a separately designed authentication contract. Preserve native X-Retry-After and expose the same numeric value as standard Retry-After on 429 responses. Use Prisma adapter transactions and revoke sessions on reset. No cookie-cached role or activeOrganizationId authorization. The context endpoint reads the verified session and current membership every request, including after revocation/downgrade.

Custom roles owner/admin/analyst/viewer apply to native organization endpoints as well as application routes. Never grant membership by matching email domain. Admins cannot assign ownership or remove the final owner. Invitations require verified matching address and valid pending state. No additional billing/document/worker business routes yet.

Development uses local Mailpit SMTP; injected capture is test-only and never exposed publicly. Production configuration must fail closed without HTTPS, a strong secret, TLS SMTP and delivery credentials. MFA for privileged accounts is a hard gate before real customer data; it is not silently claimed implemented. Corporate SSO and social providers are future work.

References: https://better-auth.com/docs/integrations/fastify, https://better-auth.com/docs/plugins/organization, https://better-auth.com/docs/concepts/database, https://better-auth.com/docs/authentication/email-password.

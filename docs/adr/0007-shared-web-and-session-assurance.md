# ADR 0007 — Shared web boundaries and session assurance

Status: accepted; runtime verification tracked in the architecture-closure task.

## Context

Individual screens bypassed reusable controls and manually handled remote writes. Session protection was conditional rendering rather than a route boundary. Sensitive-data access requires enforceable second-factor proof beyond the user's enrollment flag.

## Decision

Keep the modular monolith and server-owned cookie session. Use one internal DS with lint-enforced native-control ownership, TanStack Query factories/mutation hooks, one same-origin HTTP transport and React Router private layouts. Separate local form state from cached server state. Cancel and clear private caches before rendering a new identity.

Production requires TOTP or a one-use backup code. Store encrypted factors with a unique user key and server-only verification on each session. Gate business and native organization APIs; a session opened before enrollment does not inherit proof. Disable trusted-device bypass and gate management endpoints. QR generation stays local; enrollment secrets are transient UI state.

## Consequences

Existing accounts must enroll before accessing production organizations. AUTH_SECRET becomes a durable factor-encryption dependency and must not be casually rotated. Declarative routes and global lint rules add dependencies but prevent repeated screen-level patches. Background refresh keeps drafts mounted; current authorization remains enforced on the server.

Actual TLS/proxy, external encrypted backup/restore and host encryption require deployment evidence. Parser thread resource bounds do not constitute OS isolation. This decision does not certify production or complete OWASP coverage. See docs/architecture/architecture-closure.md for implemented contracts and the task record for exact checks.

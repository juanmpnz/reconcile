# Reconcile

Kershell product foundation for comparing supplier invoices with agreed costs and evidence of performed services. Common core, sector-specific rules, logistics as first pilot.

This repository implements phase 0 infrastructure and phase 1 account/organization access under validation. It does not process or approve invoices yet. See docs/status.md for verified scope.

## Expert harness

Every task follows [AGENTS.md](AGENTS.md) and the [expert workflow](.agents/WORKFLOW.md). Sixteen specialist profiles cover product, logistics, architecture, UX, visual design, UI, frontend, backend, data, integrations, document AI, security, QA, accessibility and platform. Codex/Claude adapters are generated from one catalog. [Usage and limits](docs/engineering/harness.md).

## Start

Use Node 24, pnpm 11.25 and Docker Compose v2. See [local development](docs/runbooks/local-development.md) for environment setup, migrations and startup.

- [Implementation plan](docs/plans/implementation.md)
- [Product requirements](docs/product/pilot-requirements.md)
- [Architecture](docs/architecture/overview.md)
- [Decision record](docs/adr/0001-platform-foundation.md)
- [Actual status and next step](docs/status.md)

Quality gate: `pnpm check`. Integration smoke: `pnpm --filter @reconcile/worker smoke` with infrastructure, API and worker running.

No credentials, invoices or confidential customer documents belong in git. Fixtures will use synthetic identities and explicit demo markings.

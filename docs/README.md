# SubPath Application & Infrastructure Documentation

Welcome to the SubPath monorepo documentation. This guide covers the full application architecture, live recurring billing infrastructure, production deployment verification, operations, and testnet verification.

## Documentation Index

* [Architecture & Monorepo Overview](architecture.md): Overview of workspace packages, dependency graph, component roles (Web UI, SDK, Indexer, Executor), and data flows.
* [Infrastructure & Daemon Design](infrastructure.md): Architecture of the Neon PostgreSQL database, event-driven ledger indexer daemon, and permissionless executor daemon.
* [Operations & Runbook](operations.md): Setup, configuration, database migrations, running daemons in development and production, troubleshooting, and health monitoring.
* [Testnet Lifecycle Verification](testnet-verification.md): Detailed evidence of on-chain plan creation, token allowance, recurring billing execution, pause, resume, and cancellation on Stellar Testnet.
* [Deployment Verification](deployment-verification.md): Verified evidence of the Next.js production build, Vercel monorepo configuration, environment settings, and live route tests.
* [v0.1.0 Release Notes](release-notes-v0.1.0.md): Scope, verified deployment parameters, and verification evidence for the v0.1.0 release.

## Repository Governance

* [Contributing Guide](../CONTRIBUTING.md)
* [Security Policy](../SECURITY.md)
* [Code of Conduct](../CODE_OF_CONDUCT.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

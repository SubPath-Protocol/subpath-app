# SubPath Application & Infrastructure v0.1.0 Release Notes

**Release Date**: 2026-10-08  
**Repository**: `SubPath-Protocol/subpath-app`  
**Network**: Stellar Testnet (`Test SDF Network ; September 2015`)  
**Production URL**: [https://subpath-app.vercel.app](https://subpath-app.vercel.app)  
**License**: MIT  

---

## Overview

SubPath v0.1.0 provides the full-stack application layer, client SDK, and background automation services supporting the SubPath recurring payments protocol on Stellar Soroban. The stack includes a Next.js 16 web application, a TypeScript SDK, an event indexer daemon backed by Neon PostgreSQL, and an autonomous billing executor daemon.

---

## Verified Deployments & Infrastructure

* **Production Web URL**: [https://subpath-app.vercel.app](https://subpath-app.vercel.app)
* **Testnet Contract ID**: [`CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3`](https://stellar.expert/explorer/testnet/contract/CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3)
* **Database**: Neon Serverless PostgreSQL with Prisma ORM
* **Hosting**: Vercel (monorepo build pipeline configured via `vercel.json`)
* **Verification Evidence**:
  * [Deployment Verification](deployment-verification.md)
  * [Testnet Lifecycle Verification](testnet-verification.md)

---

## What is Included

1. **`@subpath/sdk`**: Client SDK providing type-safe abstractions for plan creation, subscriptions, and billing queries.
2. **`apps/web`**: Web application featuring Merchant Dashboard (`/dashboard`) and public hosted subscription checkout pages (`/plans/[planId]`).
3. **Multi-Wallet Support**: Full integration with `@creit.tech/stellar-wallets-kit`, enabling Freighter (browser extension), Albedo (zero-install web popup on mobile and desktop), xBull, Lobstr, Rabet, and Hana.
4. **`apps/indexer`**: Background event streaming daemon continuously syncing Soroban ledgers into PostgreSQL with idempotent cursor state.
5. **`apps/executor`**: Autonomous billing relayer daemon querying due subscriptions and submitting permissionless `execute_billing` transactions.
6. **Cloud Daemon Deployment**: Turn-key Docker configurations (`Dockerfile.indexer`, `Dockerfile.executor`), `docker-compose.yml`, and `render.yaml` blueprint for 24/7 cloud worker deployment.
7. **Automated CI Validation**: Monorepo GitHub Actions pipeline verifying linting, typechecking, tests, and production builds.

---

## Verification Evidence & Documentation

* [README.md](../README.md): Project overview and quick start.
* [Architecture Guide](architecture.md): Monorepo structure, data flows, and component responsibilities.
* [Infrastructure Design](infrastructure.md): Schema definitions, indexer cursor design, and executor logic.
* [Operations Runbook](operations.md): Environment configuration, daemon run commands, and health checks.
* [Deployment Verification](deployment-verification.md): Evidence of Vercel production deployment and live route tests.
* [Testnet Lifecycle Verification](testnet-verification.md): Evidence of on-chain plan creation, allowance approval, recurring billing, and cancellation.
* [Changelog](../CHANGELOG.md): Historical change records.

---

## Security & Audit Status

* **Status**: Prototype MVP.
* **Network**: Configured for Stellar Testnet.
* **Non-Custodial**: The web app never accesses user private keys. All signing occurs securely in client wallets.
* **Mainnet Caution**: The application and contracts are not audited for Mainnet financial deployments.
* **Vulnerability Reporting**: Report security findings privately to `security@subpath-protocol.com`. See [SECURITY.md](../SECURITY.md).

---

## Upgrade & Setup Notes

* **Local Development**: Run `pnpm install`, `pnpm --filter @subpath/sdk build`, `pnpm db:generate`, and `pnpm --filter web dev`.
* **Database Setup**: Configure `DATABASE_URL` and push Prisma schema migrations via `pnpm --filter indexer db:push`.
* **Daemon Execution**: Background services run via `pnpm --filter indexer start` and `pnpm --filter executor start`.

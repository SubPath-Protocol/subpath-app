# Changelog

All notable changes to the `subpath-app` repository will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-08

### Added
* Monorepo architecture using `pnpm` workspaces (`apps/web`, `apps/indexer`, `apps/executor`, `packages/sdk`).
* `@subpath/sdk`: Type-safe TypeScript library for Stellar Soroban contract interactions.
* `apps/web`: Next.js 16 Web application featuring Merchant Dashboard (`/dashboard`) and hosted subscription checkout (`/plans/[planId]`).
* Multi-wallet integration via `@creit.tech/stellar-wallets-kit`, enabling Freighter (extension), Albedo (zero-install mobile & desktop web popup), xBull, Lobstr, Rabet, and Hana.
* `apps/indexer`: Background event daemon indexing `plan_add`, `sub_new`, `sub_billed`, `sub_pause`, `sub_resume`, and `sub_end` events into Neon PostgreSQL with idempotent cursor resumption.
* `apps/executor`: Autonomous recurring billing daemon scanning due subscriptions and submitting permissionless `execute_billing` transactions.
* Production Vercel deployment with monorepo build configuration (`pnpm --filter @subpath/sdk build && pnpm --filter web build`) live at `https://subpath-app.vercel.app`.
* Containerized worker deployment assets including `Dockerfile.indexer`, `Dockerfile.executor`, `docker-compose.yml`, and `render.yaml` blueprint for 24/7 cloud operation.
* Full on-chain Testnet lifecycle verification documented in `docs/testnet-verification.md`.
* Automated GitHub Actions CI pipeline passing lint, typecheck, tests, and workspace builds.

### Limitations
* Prototype release evaluated on Stellar Testnet.
* Automated recurring billing is executed by background worker daemons rather than serverless functions.
* Application relies on off-chain subscriber token allowances approved prior to recurring billing intervals.

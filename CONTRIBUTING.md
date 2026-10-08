# Contributing to SubPath

Thank you for contributing to the SubPath monorepo.

## Workspace Structure

* `apps/web`: Next.js 16 web application and dashboard.
* `apps/indexer`: Background ledger poller syncing Soroban events to PostgreSQL.
* `apps/executor`: Background automated recurring billing execution service.
* `packages/sdk`: TypeScript client SDK wrapping Soroban contracts.

## Development Setup

### Prerequisites
* Node.js (v20 or v22)
* `pnpm` (v9.12.1 or later): `corepack enable pnpm`

### Setup Commands
```bash
# Install dependencies
pnpm install

# Build SDK package
pnpm --filter @subpath/sdk build

# Generate database client
pnpm db:generate

# Workspace verification commands
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Pull Request Guidelines

1. **One Logical Change Per Commit**: Keep commits atomic and clearly titled.
2. **Commit Style**: Use conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
3. **No Co-Author Lines**: Do not add automated AI co-author attribution.
4. **No Secrets**: Never commit `.env` files, database passwords, or Stellar private seeds.
5. **Passing CI**: All Pull Requests must pass GitHub Actions CI (`lint`, `typecheck`, `test`, `build`) before review.

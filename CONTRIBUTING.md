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

## Drips Wave Contribution Guidelines

This repository participates in the **Stellar Wave Program** on the [Drips Network](https://drips.network/wave).

1. **Find an Issue**: Look for issues tagged with the `Stellar Wave` label.
2. **Apply to Contribute**: Apply directly on the Drips Wave portal before starting work so maintainers can assign the task and lock in your due date.
3. **Mandatory Issue Linking**: Every Pull Request description **must explicitly link** to the issue it resolves using GitHub keywords:
   - Example: `Fixes #12` or `Closes #12`.
   - Pull Requests lacking an issue link will fail the automated `PR Lint` CI check.
4. **Branch Workflow**: Fork the repository, create a descriptive feature branch (e.g. `feat/issue-12-skeletons`), push your commits, and open a PR against `main`.
5. **Squash and Merge**: Maintainers review code and squash-merge approved contributions, automatically issuing Drips Wave points to contributors upon completion.

## Pull Request Guidelines

1. **One Logical Change Per Commit**: Keep commits atomic and clearly titled.
2. **Commit Style**: Use conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
3. **No Co-Author Lines**: Do not add automated AI co-author attribution.
4. **No Secrets**: Never commit `.env` files, database passwords, or Stellar private seeds.
5. **Passing CI**: All Pull Requests must pass GitHub Actions CI (`PR Lint`, `lint`, `typecheck`, `test`, `build`) before review.

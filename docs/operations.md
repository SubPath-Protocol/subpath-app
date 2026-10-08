# SubPath Operations Runbook

## Environment Configuration

Configure the following environment variables in `.env` or in deployment container environments:

```bash
# Network & RPC Configuration
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_PASSPHRASE="Test SDF Network ; September 2015"
SUBPATH_CONTRACT_ID=CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3

# Public Frontend (apps/web)
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_STELLAR_PASSPHRASE="Test SDF Network ; September 2015"
NEXT_PUBLIC_SUBPATH_CONTRACT_ID=CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3

# PostgreSQL Database (Neon)
DATABASE_URL=postgresql://user:password@host/neondb?sslmode=require

# Executor Relayer Keypair (Funded Testnet Account)
EXECUTOR_SECRET_KEY=S...
```

> **Security Note**: Never commit actual secret keys or credentials to version control. Production secrets must be managed via secure secret managers or Vercel environment variables.

---

## Running Daemons Locally

```bash
# Install monorepo dependencies
pnpm install

# Generate Prisma Client
pnpm db:generate

# Push schema migrations to Neon DB
pnpm --filter indexer db:push

# Build the SDK
pnpm --filter @subpath/sdk build

# Start web frontend in development
pnpm --filter web dev

# Start indexer daemon
pnpm --filter indexer start

# Start executor daemon
pnpm --filter executor start
```

---

## Production Deployment Architecture

* **Frontend (`apps/web`)**: Hosted on Vercel (`https://subpath-app.vercel.app`). Automatically builds with `pnpm --filter @subpath/sdk build && pnpm --filter web build`.
* **Database**: Hosted on Neon Serverless PostgreSQL with pooled connections.
* **Daemons (`apps/indexer`, `apps/executor`)**: Run as persistent background processes (e.g. systemd services, Docker containers, or Kubernetes pods) with automatic restart policies.

---

## Monitoring & Health Checks

1. **Indexer Health**:
   * Inspect `IndexerState` table: `SELECT * FROM "IndexerState";`
   * Compare `lastLedger` against the latest ledger reported by `https://soroban-testnet.stellar.org`.
2. **Executor Health**:
   * Inspect `BillingLog` table: `SELECT * FROM "BillingLog" ORDER BY "timestamp" DESC LIMIT 10;`
   * Confirm transactions report `SUCCESS` on Stellar Testnet explorers.
3. **Frontend Health**:
   * Inspect HTTP 200 response on `https://subpath-app.vercel.app/` and `/dashboard`.

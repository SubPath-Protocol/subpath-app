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
* **Daemons (`apps/indexer`, `apps/executor`)**: Run as persistent background processes in the cloud with automatic restart policies.

---

## Deploying Daemons to the Cloud (24/7 Persistent Workers)

### Option 1: Docker Compose (VPS / DigitalOcean / AWS / Hetzner)

A production-ready `docker-compose.yml` and corresponding Dockerfiles (`Dockerfile.indexer` and `Dockerfile.executor`) are provided in the repository root.

1. Clone repository to your server:
   ```bash
   git clone https://github.com/SubPath-Protocol/subpath-app.git
   cd subpath-app
   ```
2. Create your `.env` file containing:
   ```bash
   DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
   SUBPATH_CONTRACT_ID="CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3"
   STELLAR_RPC_URL="https://soroban-testnet.stellar.org"
   STELLAR_PASSPHRASE="Test SDF Network ; September 2015"
   EXECUTOR_SECRET="S..." # Relayer secret key funded on Testnet
   ```
3. Start the daemons in detached background mode:
   ```bash
   docker compose up -d --build
   ```
4. View live logs:
   ```bash
   docker compose logs -f indexer
   docker compose logs -f executor
   ```

---

### Option 2: Render (1-Click Blueprint)

The repository includes a `render.yaml` specification defining two background worker services (`subpath-indexer` and `subpath-executor`).

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** > **Blueprint**.
3. Connect the `SubPath-Protocol/subpath-app` repository.
4. Render will detect `render.yaml` and prompt for required environment secrets:
   * `DATABASE_URL`: Your Neon PostgreSQL connection string.
   * `EXECUTOR_SECRET`: The funded relayer secret key (`S...`).
5. Click **Apply**. Both workers will build using Docker and run continuously with automatic restarts.

---

### Option 3: Railway

1. Log in to [Railway](https://railway.app) and create a **New Project** > **Deploy from GitHub repo**.
2. Select `SubPath-Protocol/subpath-app`.
3. Add two services from the same repository:
   * **Indexer Service**:
     * In **Settings** > **Build**, set **Dockerfile Path** to `Dockerfile.indexer`.
     * In **Variables**, add `DATABASE_URL`, `SUBPATH_CONTRACT_ID`, `STELLAR_RPC_URL`, `STELLAR_PASSPHRASE`.
   * **Executor Service**:
     * In **Settings** > **Build**, set **Dockerfile Path** to `Dockerfile.executor`.
     * In **Variables**, add `DATABASE_URL`, `EXECUTOR_SECRET`, `SUBPATH_CONTRACT_ID`, `STELLAR_RPC_URL`, `STELLAR_PASSPHRASE`.
4. Deploy both services. Railway manages restarts and container health automatically.

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

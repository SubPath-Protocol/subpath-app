# SubPath Infrastructure & Daemon Design

## Overview

While the SubPath smart contract is fully decentralized and non-custodial, automated recurring billing requires an off-chain coordinator to monitor due subscriptions and trigger `execute_billing` transactions. The infrastructure stack consists of:
1. **Neon Serverless PostgreSQL Database**
2. **Event Indexer Daemon (`apps/indexer`)**
3. **Automated Billing Executor Daemon (`apps/executor`)**

---

## 1. Database Schema (Prisma ORM)

The relational schema tracks on-chain state indexed from Soroban contract events:

```prisma
model Plan {
  id           BigInt   @id
  merchant     String
  token        String
  amount       Decimal
  cycleSeconds Int
  createdAt    DateTime @default(now())
}

model Subscription {
  subscriber      String
  planId          BigInt
  status          String   // ACTIVE, PAUSED, CANCELED
  nextBillingTime DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@id([subscriber, planId])
}

model BillingLog {
  id           String   @id @default(uuid())
  subscriber   String
  planId       BigInt
  txHash       String   @unique
  timestamp    DateTime @default(now())
  status       String   // SUCCESS, FAILED
}

model IndexerState {
  id           String   @id @default("singleton")
  lastLedger   BigInt
  updatedAt    DateTime @updatedAt
}
```

---

## 2. Event Indexer Daemon (`apps/indexer`)

* **Engine**: Node.js worker polling Stellar Soroban RPC `getEvents`.
* **Cursor Tracking**: Ingests new ledgers starting from `IndexerState.lastLedger`.
* **Idempotency**: Event processing is wrapped in database transactions; duplicate events or replayed ledgers are ignored safely.
* **Topics Monitored**:
  * `plan_add`: Inserts new `Plan` record.
  * `sub_new`: Inserts new `Subscription` record with `status: ACTIVE`.
  * `sub_billed`: Updates `nextBillingTime` and inserts `BillingLog`.
  * `sub_pause`: Updates `status: PAUSED`.
  * `sub_resume`: Updates `status: ACTIVE`.
  * `sub_end`: Updates `status: CANCELED`.

---

## 3. Automated Billing Executor Daemon (`apps/executor`)

* **Autonomous Execution**: Runs on a configurable polling interval (default: 5 seconds).
* **Billing Query**:
  ```sql
  SELECT * FROM "Subscription"
  WHERE "status" = 'ACTIVE'
    AND "nextBillingTime" <= NOW()
  LIMIT 50;
  ```
* **Simulation & Preparation**:
  1. Loads current subscriber account sequence from Soroban RPC.
  2. Constructs `execute_billing(subscriber, planId)`.
  3. Prepares transaction via `server.prepareTransaction(tx)` to simulate Soroban resource footprints.
  4. Signs with operator keypair and submits via `server.sendTransaction(tx)`.
* **Failure Handling**:
  * If a subscriber has revoked their token allowance or has insufficient balance, the on-chain transfer fails safely without disrupting other subscriptions.
  * Stale locks are handled to prevent concurrent double-execution of the same subscription cycle.

---

## 4. Container Topology & Cloud Deployment

SubPath cleanly separates stateless user-facing web experiences from persistent daemon workloads:

```text
┌─────────────────────────────────┐
│        Vercel (Edge/Serverless) │
│  apps/web (Next.js 14)          │
└───────────────┬─────────────────┘
                │ Reads & Writes
                ▼
┌─────────────────────────────────┐
│      Neon Serverless Postgres   │
└───────┬─────────────────▲───────┘
        │                 │
 Reads  ▼          Writes │
┌──────────────────┐    ┌─┴────────────────┐
│ subpath-executor │    │ subpath-indexer  │
│ (Cloud Worker)   │    │ (Cloud Worker)   │
└────────┬─────────┘    └─────────▲────────┘
         │ Submits tx             │ Polls events
         ▼                        │
┌─────────────────────────────────┴────────┐
│      Stellar Soroban Testnet RPC         │
│  (Contract: CC4ZFZ...NIKWLUV3)           │
└──────────────────────────────────────────┘
```

Both daemons are packaged with self-contained Docker images (`Dockerfile.indexer` and `Dockerfile.executor`) and orchestrated via `docker-compose.yml`, `render.yaml` (Render Blueprints), or Railway.


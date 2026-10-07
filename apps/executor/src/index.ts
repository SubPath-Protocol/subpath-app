import { SubPathClient } from "@subpath/sdk";
import { Keypair, TransactionBuilder, Account } from "@stellar/stellar-sdk";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });

const EXECUTOR_SECRET = process.env.EXECUTOR_SECRET;
if (!EXECUTOR_SECRET) {
  console.warn("EXECUTOR_SECRET is missing. Executor will run in dry-run mode.");
}

const keypair = EXECUTOR_SECRET ? Keypair.fromSecret(EXECUTOR_SECRET) : null;
const prisma = new PrismaClient();

const client = new SubPathClient({
  contractId: process.env.NEXT_PUBLIC_SUBPATH_CONTRACT_ID || "",
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE || "Test SDF Network ; September 2015"
});

const STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function run() {
  console.log(`Starting SubPath Production Executor with public key: ${keypair?.publicKey() || "DRY RUN"}`);

  while (true) {
    try {
      // Phase 15: Crash Recovery - Recover stale processing locks
      await recoverStaleLocks();

      // Phase 14 & 17: Poll & Execute due subscriptions safely
      await pollAndExecute();
    } catch (e) {
      console.error("Executor run loop error:", e);
    }
    // Poll every 30 seconds
    await new Promise(r => setTimeout(r, 30000));
  }
}

async function recoverStaleLocks() {
  const staleThreshold = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS);
  const recovered = await prisma.subscription.updateMany({
    where: {
      status: 2, // PROCESSING
      lockedAt: { lt: staleThreshold }
    },
    data: {
      status: 1, // Revert to ACTIVE
      lockedAt: null
    }
  });

  if (recovered.count > 0) {
    console.log(`[EXECUTOR RECOVERY] Recovered ${recovered.count} stale subscription lock(s).`);
  }
}

async function pollAndExecute() {
  const now = Math.floor(Date.now() / 1000);

  // 1. Find due active subscriptions
  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      nextBillingTime: { lte: now },
      status: 1 // 1 = ACTIVE
    },
    take: 50
  });

  if (dueSubscriptions.length === 0) {
    return;
  }

  console.log(`[EXECUTOR] Found ${dueSubscriptions.length} due subscription(s).`);

  for (const sub of dueSubscriptions) {
    // Phase 17: Optimistic Concurrency Control - Lock the row atomically
    const lockTime = new Date();
    const locked = await prisma.subscription.updateMany({
      where: {
        subscriber: sub.subscriber,
        planId: sub.planId,
        status: 1
      },
      data: {
        status: 2, // Mark as PROCESSING
        lockedAt: lockTime
      }
    });

    if (locked.count === 0) {
      console.log(`[EXECUTOR] Subscription ${sub.planId}:${sub.subscriber} was claimed by another worker.`);
      continue;
    }

    console.log(`[EXECUTOR] Executing billing for ${sub.subscriber} on Plan #${sub.planId}...`);

    if (!keypair) {
      // Dry run mode
      console.log(`[EXECUTOR DRY-RUN] Would bill ${sub.subscriber} for Plan #${sub.planId}`);
      await prisma.subscription.updateMany({
        where: { subscriber: sub.subscriber, planId: sub.planId },
        data: { status: 1, lockedAt: null }
      });
      continue;
    }

    try {
      const op = client.executeBilling(keypair.publicKey(), sub.subscriber, sub.planId);
      const accountData = await client.server.getAccount(keypair.publicKey());
      const source = new Account(keypair.publicKey(), accountData.sequenceNumber());
      const tx = new TransactionBuilder(source, {
        fee: "10000",
        networkPassphrase: client.config.networkPassphrase
      })
        .addOperation(op)
        .setTimeout(100)
        .build();

      const preparedTx = await client.server.prepareTransaction(tx);
      preparedTx.sign(keypair);
      const resp = await client.server.sendTransaction(preparedTx);

      if (resp.status === "PENDING") {
        console.log(`[EXECUTOR] Submitted transaction. Hash: ${resp.hash}`);

        // Phase 14: Polling transaction status until final result (SUCCESS or FAILED)
        const confirmed = await waitForTransactionConfirmation(resp.hash);

        if (confirmed.status === "SUCCESS") {
          console.log(`[EXECUTOR SUCCESS] Transaction ${resp.hash} confirmed on-chain.`);
          await prisma.billingAttempt.create({
            data: {
              subscriber: sub.subscriber,
              planId: sub.planId,
              status: "SUCCESS",
              txHash: resp.hash
            }
          });
          // Note: Indexer will update Subscription status and nextBillingTime when event is observed
        } else {
          throw new Error(`Transaction ${resp.hash} failed with status: ${confirmed.status}`);
        }
      } else {
        throw new Error(`Transaction submission rejected with status: ${resp.status}`);
      }
    } catch (e: unknown) {
      const err = e as Error;
      console.error(`[EXECUTOR ERROR] Failed billing ${sub.subscriber} on Plan #${sub.planId}:`, err.message);

      // Phase 16: Retry Policy & BillingAttempt recording
      await prisma.billingAttempt.create({
        data: {
          subscriber: sub.subscriber,
          planId: sub.planId,
          status: "FAILED",
          errorMessage: err.message || "Unknown execution error"
        }
      });

      // Release lock so it can be retried or synced with chain state
      await prisma.subscription.updateMany({
        where: { subscriber: sub.subscriber, planId: sub.planId },
        data: { status: 1, lockedAt: null }
      });
    }
  }
}

async function waitForTransactionConfirmation(hash: string, maxAttempts = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = await client.server.getTransaction(hash);
      if (tx.status === "SUCCESS" || tx.status === "FAILED") {
        return tx;
      }
    } catch {
      // Transaction not yet indexed into RPC getTransaction
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return { status: "TIMEOUT" };
}

run();

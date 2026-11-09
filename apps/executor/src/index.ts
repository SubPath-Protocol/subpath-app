import { SubPathClient } from "@subpath/sdk";
import { Keypair, TransactionBuilder, Account } from "@stellar/stellar-sdk";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });

const EXECUTOR_SECRET = process.env.EXECUTOR_SECRET || process.env.EXECUTOR_SECRET_KEY;
if (!EXECUTOR_SECRET) {
  console.warn("EXECUTOR_SECRET is missing. Executor will run in dry-run mode.");
}

export const keypair = EXECUTOR_SECRET ? Keypair.fromSecret(EXECUTOR_SECRET) : null;
export const prisma = new PrismaClient();

const contractId = process.env.SUBPATH_CONTRACT_ID || process.env.NEXT_PUBLIC_SUBPATH_CONTRACT_ID || "CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3";
const rpcUrl = process.env.STELLAR_RPC_URL || process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const networkPassphrase = process.env.STELLAR_PASSPHRASE || process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE || "Test SDF Network ; September 2015";

export const client = new SubPathClient({
  contractId,
  rpcUrl,
  networkPassphrase
});

export const STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const UNRESOLVED_EXPIRATION_MS = 15 * 60 * 1000; // 15 minutes

let isRunning = true;
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down executor gracefully...`);
  isRunning = false;
  try {
    await prisma.$disconnect();
  } catch (err) {
    console.error("Error disconnecting Prisma:", err);
  }
  process.exit(0);
};

if (typeof process !== "undefined" && process.on) {
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

/**
 * Reconciles unresolved transactions recorded as PENDING in the database.
 * Prevents retrying a billing attempt whose on-chain outcome is not yet confirmed.
 */
export async function reconcilePendingTransactions(
  db: PrismaClient = prisma,
  sdkClient: SubPathClient = client
): Promise<number> {
  const pendingAttempts = await db.billingAttempt.findMany({
    where: { status: "PENDING", txHash: { not: null } },
    take: 20
  });

  let resolvedCount = 0;

  for (const attempt of pendingAttempts) {
    if (!attempt.txHash) continue;
    try {
      const tx = await sdkClient.server.getTransaction(attempt.txHash);

      if (tx.status === "SUCCESS") {
        console.log(`[RECONCILIATION SUCCESS] Resolved transaction ${attempt.txHash} as SUCCESS`);
        await db.billingAttempt.update({
          where: { id: attempt.id },
          data: { status: "SUCCESS" }
        });

        const chainSub = await sdkClient.getSubscription(attempt.subscriber, attempt.planId);
        await db.subscription.updateMany({
          where: { subscriber: attempt.subscriber, planId: attempt.planId },
          data: {
            status: 1,
            nextBillingTime: chainSub ? Number(chainSub.next_billing_time) : undefined,
            lastBilledAt: Math.floor(Date.now() / 1000),
            lockedAt: null
          }
        });
        resolvedCount++;
      } else if (tx.status === "FAILED") {
        console.log(`[RECONCILIATION FAILED] Resolved transaction ${attempt.txHash} as FAILED`);
        await db.billingAttempt.update({
          where: { id: attempt.id },
          data: {
            status: "FAILED",
            errorMessage: (tx as any).resultXdr || "Transaction rejected on-chain"
          }
        });
        // Release lock so a genuine retry can occur in subsequent cycles
        await db.subscription.updateMany({
          where: { subscriber: attempt.subscriber, planId: attempt.planId },
          data: { status: 1, lockedAt: null }
        });
        resolvedCount++;
      } else {
        // Still pending on RPC. Check age against expiration timeout
        const ageMs = Date.now() - attempt.createdAt.getTime();
        if (ageMs > UNRESOLVED_EXPIRATION_MS) {
          const chainSub = await sdkClient.getSubscription(attempt.subscriber, attempt.planId);
          const isBilled = chainSub && Number(chainSub.next_billing_time) > Math.floor(Date.now() / 1000);

          await db.billingAttempt.update({
            where: { id: attempt.id },
            data: {
              status: isBilled ? "SUCCESS" : "FAILED",
              errorMessage: isBilled ? null : "Transaction expired without confirmation"
            }
          });

          await db.subscription.updateMany({
            where: { subscriber: attempt.subscriber, planId: attempt.planId },
            data: {
              status: 1,
              nextBillingTime: chainSub ? Number(chainSub.next_billing_time) : undefined,
              lockedAt: null
            }
          });
          resolvedCount++;
        }
      }
    } catch (err) {
      console.warn(`[RECONCILIATION WARN] Could not inspect transaction ${attempt.txHash}:`, err);
    }
  }

  return resolvedCount;
}

/**
 * Recovers stale processing locks, but NEVER releases locks that have an active PENDING billing attempt.
 */
export async function recoverStaleLocks(db: PrismaClient = prisma): Promise<number> {
  const staleThreshold = new Date(Date.now() - STALE_LOCK_TIMEOUT_MS);
  const staleSubs = await db.subscription.findMany({
    where: {
      status: 2, // PROCESSING
      lockedAt: { lt: staleThreshold }
    }
  });

  let recoveredCount = 0;

  for (const sub of staleSubs) {
    const pendingTx = await db.billingAttempt.findFirst({
      where: {
        subscriber: sub.subscriber,
        planId: sub.planId,
        status: "PENDING"
      }
    });

    if (!pendingTx) {
      await db.subscription.updateMany({
        where: { subscriber: sub.subscriber, planId: sub.planId, status: 2 },
        data: { status: 1, lockedAt: null }
      });
      recoveredCount++;
    } else {
      console.log(`[EXECUTOR RECOVERY] Preserved lock on ${sub.subscriber}:${sub.planId} pending transaction reconciliation`);
    }
  }

  return recoveredCount;
}

/**
 * Polls and safely executes billing for due subscriptions with strict idempotency and authoritative state check.
 */
export async function pollAndExecute(
  db: PrismaClient = prisma,
  sdkClient: SubPathClient = client,
  signer: Keypair | null = keypair
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  // 1. Find due active subscriptions
  const dueSubscriptions = await db.subscription.findMany({
    where: {
      nextBillingTime: { lte: now },
      status: 1 // 1 = ACTIVE
    },
    take: 50
  });

  if (dueSubscriptions.length === 0) {
    return 0;
  }

  let executedCount = 0;

  for (const sub of dueSubscriptions) {
    // 2. Optimistic Concurrency Control - Lock the row atomically
    const lockTime = new Date();
    const locked = await db.subscription.updateMany({
      where: {
        subscriber: sub.subscriber,
        planId: sub.planId,
        status: 1
      },
      data: {
        status: 2, // PROCESSING
        lockedAt: lockTime
      }
    });

    if (locked.count === 0) {
      // Claimed by concurrent worker
      continue;
    }

    // 3. Authoritative On-Chain State Verification (guards against indexer lag)
    try {
      const chainSub = await sdkClient.getSubscription(sub.subscriber, sub.planId);
      if (!chainSub) {
        console.warn(`[EXECUTOR] Subscription ${sub.subscriber}:${sub.planId} not found on chain. Marking canceled.`);
        await db.subscription.updateMany({
          where: { subscriber: sub.subscriber, planId: sub.planId },
          data: { status: 0, lockedAt: null }
        });
        continue;
      }

      if (Number(chainSub.next_billing_time) > now) {
        console.log(`[EXECUTOR] Subscription ${sub.subscriber}:${sub.planId} already billed on-chain. Syncing local nextBillingTime.`);
        await db.subscription.updateMany({
          where: { subscriber: sub.subscriber, planId: sub.planId },
          data: {
            status: 1,
            nextBillingTime: Number(chainSub.next_billing_time),
            lockedAt: null
          }
        });
        continue;
      }
    } catch (chainErr) {
      console.error(`[EXECUTOR] Could not verify on-chain status for ${sub.subscriber}:${sub.planId}:`, chainErr);
      // Release lock without submitting to avoid duplicate billing on network partition
      await db.subscription.updateMany({
        where: { subscriber: sub.subscriber, planId: sub.planId },
        data: { status: 1, lockedAt: null }
      });
      continue;
    }

    if (!signer) {
      // Dry run mode
      await db.subscription.updateMany({
        where: { subscriber: sub.subscriber, planId: sub.planId },
        data: { status: 1, lockedAt: null }
      });
      continue;
    }

    // 4. Transaction Construction, Simulation & Submission
    let txHash: string | null = null;
    let pendingAttemptId: string | null = null;

    try {
      const op = sdkClient.executeBilling(sub.subscriber, sub.planId);
      const accountData = await sdkClient.server.getAccount(signer.publicKey());
      const source = new Account(signer.publicKey(), accountData.sequenceNumber());
      const tx = new TransactionBuilder(source, {
        fee: "10000",
        networkPassphrase: sdkClient.config.networkPassphrase
      })
        .addOperation(op)
        .setTimeout(100)
        .build();

      const preparedTx = await sdkClient.server.prepareTransaction(tx);
      preparedTx.sign(signer);
      const resp = await sdkClient.server.sendTransaction(preparedTx);

      if (resp.status === "PENDING") {
        txHash = resp.hash;

        // Persist PENDING status BEFORE releasing lock or polling
        const pendingAttempt = await db.billingAttempt.create({
          data: {
            subscriber: sub.subscriber,
            planId: sub.planId,
            status: "PENDING",
            txHash: resp.hash
          }
        });
        pendingAttemptId = pendingAttempt.id;

        // Bounded polling for transaction confirmation
        const confirmed = await waitForTransactionConfirmation(sdkClient, resp.hash);

        if (confirmed.status === "SUCCESS") {
          await db.billingAttempt.update({
            where: { id: pendingAttemptId },
            data: { status: "SUCCESS" }
          });

          const updatedChainSub = await sdkClient.getSubscription(sub.subscriber, sub.planId);
          await db.subscription.updateMany({
            where: { subscriber: sub.subscriber, planId: sub.planId },
            data: {
              status: 1,
              nextBillingTime: updatedChainSub ? Number(updatedChainSub.next_billing_time) : sub.nextBillingTime + 2592000,
              lastBilledAt: now,
              lockedAt: null
            }
          });
          executedCount++;
        } else if (confirmed.status === "FAILED") {
          await db.billingAttempt.update({
            where: { id: pendingAttemptId },
            data: {
              status: "FAILED",
              errorMessage: (confirmed as any).resultXdr || "Transaction confirmed failed"
            }
          });
          // Release lock for future retries
          await db.subscription.updateMany({
            where: { subscriber: sub.subscriber, planId: sub.planId },
            data: { status: 1, lockedAt: null }
          });
        } else {
          // TIMEOUT / UNCERTAIN
          console.warn(`[EXECUTOR TIMEOUT] Transaction ${resp.hash} pending confirmation. Retaining lock for reconciliation.`);
          // DO NOT revert subscription to status 1! Leave in status 2 so subsequent workers don't double bill.
        }
      } else {
        throw new Error(`Transaction submission rejected with status: ${resp.status}`);
      }
    } catch (e: unknown) {
      const err = e as Error;
      console.error(`[EXECUTOR ERROR] Error executing billing for ${sub.subscriber}:${sub.planId}:`, err.message);

      if (!txHash) {
        // Submission failed before on-chain receipt -> safe to record failed and release lock
        await db.billingAttempt.create({
          data: {
            subscriber: sub.subscriber,
            planId: sub.planId,
            status: "FAILED",
            errorMessage: err.message || "Submission failure"
          }
        });
        await db.subscription.updateMany({
          where: { subscriber: sub.subscriber, planId: sub.planId },
          data: { status: 1, lockedAt: null }
        });
      }
    }
  }

  return executedCount;
}

export async function waitForTransactionConfirmation(
  sdkClient: SubPathClient,
  hash: string,
  maxAttempts = 10,
  delayMs = 2000
) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = await sdkClient.server.getTransaction(hash);
      if (tx.status === "SUCCESS" || tx.status === "FAILED") {
        return tx;
      }
    } catch {
      // Transaction not yet indexed
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  return { status: "TIMEOUT" };
}

export async function run() {
  console.log(`Starting SubPath Production Executor with public key: ${keypair?.publicKey() || "DRY RUN"}`);

  while (isRunning) {
    try {
      // 1. Reconcile any in-flight or unresolved transactions from prior runs
      await reconcilePendingTransactions(prisma, client);

      // 2. Safely recover abandoned stale locks (ignoring active PENDING transactions)
      await recoverStaleLocks(prisma);

      // 3. Poll & execute due subscriptions
      await pollAndExecute(prisma, client, keypair);
    } catch (e) {
      console.error("Executor run loop error:", e);
    }

    for (let i = 0; i < 30 && isRunning; i++) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

if (process.env.NODE_ENV !== "test" && require.main === module) {
  run();
}

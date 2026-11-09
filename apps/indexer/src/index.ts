import { SubPathClient } from "@subpath/sdk";
import { PrismaClient } from "@prisma/client";
import { scValToNative } from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });

export const prisma = new PrismaClient();

const contractId = process.env.SUBPATH_CONTRACT_ID || process.env.NEXT_PUBLIC_SUBPATH_CONTRACT_ID || "CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3";
const rpcUrl = process.env.STELLAR_RPC_URL || process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const networkPassphrase = process.env.STELLAR_PASSPHRASE || process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE || "Test SDF Network ; September 2015";

export const client = new SubPathClient({
  contractId,
  rpcUrl,
  networkPassphrase
});

export const MAX_LEDGER_BATCH = 100;
export const EVENT_PAGE_LIMIT = 200;

export function parseSubscriptionStatus(status: any): number {
  const str = String(Array.isArray(status) ? status[0] : (typeof status === 'object' && status !== null ? Object.keys(status)[0] : status));
  if (str === "Active" || str === "0") return 1; // 1 = ACTIVE
  if (str === "Paused" || str === "2") return 3; // 3 = PAUSED
  if (str === "Canceled" || str === "1") return 0; // 0 = CANCELED
  return 1;
}

export function generateEventId(event: { id?: string; ledger?: number; txHash?: string }, index: number): string {
  return event.id || `${event.ledger || 0}:${event.txHash || "0"}:${index}`;
}

/**
 * Durably processes an individual contract event inside an atomic Prisma transaction.
 * If fetching authoritative state from the contract fails, throws so caller does not mark as processed.
 */
export async function processContractEvent(
  event: any,
  index: number,
  db: PrismaClient = prisma,
  sdkClient: SubPathClient = client
): Promise<{ processed: boolean; eventId: string; status: "indexed" | "skipped_duplicate" | "skipped_malformed" }> {
  const eventId = generateEventId(event, index);

  // Idempotency check: Skip if already durably processed
  const existing = await db.processedEvent.findUnique({
    where: { eventId }
  });
  if (existing) {
    return { processed: true, eventId, status: "skipped_duplicate" };
  }

  let topic1: any = null;
  let topic2: any = null;
  try {
    topic1 = event.topic && event.topic[0] ? scValToNative(event.topic[0]) : null;
    topic2 = event.topic && event.topic[1] ? scValToNative(event.topic[1]) : null;
  } catch (err) {
    console.warn(`[INDEXER WARN] Malformed ScVal in event topic for ${eventId}:`, err);
    // Mark malformed event as processed to prevent infinite blocking retry
    await db.processedEvent.create({
      data: {
        eventId,
        eventType: "malformed_topic",
        ledger: event.ledger || 0
      }
    });
    return { processed: true, eventId, status: "skipped_malformed" };
  }

  const recognizedEvents = ["plan_add", "sub_new", "sub_pause", "sub_resume", "sub_end", "sub_cancel", "sub_billed"];
  if (!topic1 || !recognizedEvents.includes(String(topic1))) {
    // Unsupported event type - record as processed to avoid permanent stall
    await db.processedEvent.create({
      data: {
        eventId,
        eventType: String(topic1 || "unknown"),
        ledger: event.ledger || 0
      }
    });
    return { processed: true, eventId, status: "skipped_malformed" };
  }

  const eventType = String(topic1);

  if (eventType === "plan_add") {
    let planId: number;
    try {
      planId = Number(scValToNative(event.value));
    } catch {
      await db.processedEvent.create({ data: { eventId, eventType, ledger: event.ledger || 0 } });
      return { processed: true, eventId, status: "skipped_malformed" };
    }

    // Authoritative RPC read - throws if network/RPC fails
    const planData = await sdkClient.getPlan(planId);
    if (!planData) {
      throw new Error(`Plan #${planId} could not be retrieved from contract state`);
    }

    await db.$transaction([
      db.plan.upsert({
        where: { id: planId },
        update: {
          merchant: planData.merchant,
          token: planData.token,
          amount: planData.amount.toString(),
          cycleSeconds: Number(planData.cycle_seconds)
        },
        create: {
          id: planId,
          merchant: planData.merchant,
          token: planData.token,
          amount: planData.amount.toString(),
          cycleSeconds: Number(planData.cycle_seconds)
        }
      }),
      db.processedEvent.create({
        data: { eventId, eventType, ledger: event.ledger || 0 }
      })
    ]);
  } else if (eventType === "sub_new") {
    const subscriber = String(topic2 || "");
    let planId: number;
    try {
      planId = Number(scValToNative(event.value));
    } catch {
      await db.processedEvent.create({ data: { eventId, eventType, ledger: event.ledger || 0 } });
      return { processed: true, eventId, status: "skipped_malformed" };
    }

    const subData = await sdkClient.getSubscription(subscriber, planId);
    if (!subData) {
      throw new Error(`Subscription (${subscriber}, ${planId}) not found on-chain`);
    }
    const parsedStatus = parseSubscriptionStatus(subData.status);

    await db.$transaction([
      db.subscription.upsert({
        where: { subscriber_planId: { subscriber, planId } },
        update: {
          status: parsedStatus,
          nextBillingTime: Number(subData.next_billing_time),
          lockedAt: null
        },
        create: {
          subscriber,
          planId,
          status: parsedStatus,
          nextBillingTime: Number(subData.next_billing_time)
        }
      }),
      db.processedEvent.create({
        data: { eventId, eventType, ledger: event.ledger || 0 }
      })
    ]);
  } else if (eventType === "sub_pause") {
    const subscriber = String(topic2 || "");
    const planId = Number(scValToNative(event.value));

    await db.$transaction([
      db.subscription.updateMany({
        where: { subscriber, planId },
        data: { status: 3, lockedAt: null } // 3 = PAUSED
      }),
      db.processedEvent.create({
        data: { eventId, eventType, ledger: event.ledger || 0 }
      })
    ]);
  } else if (eventType === "sub_resume") {
    const subscriber = String(topic2 || "");
    const planId = Number(scValToNative(event.value));
    const subData = await sdkClient.getSubscription(subscriber, planId);

    await db.$transaction([
      db.subscription.updateMany({
        where: { subscriber, planId },
        data: {
          status: subData ? parseSubscriptionStatus(subData.status) : 1,
          nextBillingTime: subData ? Number(subData.next_billing_time) : Math.floor(Date.now() / 1000),
          lockedAt: null
        }
      }),
      db.processedEvent.create({
        data: { eventId, eventType, ledger: event.ledger || 0 }
      })
    ]);
  } else if (eventType === "sub_end" || eventType === "sub_cancel") {
    const subscriber = String(topic2 || "");
    const planId = Number(scValToNative(event.value));

    await db.$transaction([
      db.subscription.updateMany({
        where: { subscriber, planId },
        data: { status: 0, lockedAt: null } // 0 = CANCELED
      }),
      db.processedEvent.create({
        data: { eventId, eventType, ledger: event.ledger || 0 }
      })
    ]);
  } else if (eventType === "sub_billed") {
    const subscriber = String(topic2 || "");
    const planId = Number(scValToNative(event.value));
    const subData = await sdkClient.getSubscription(subscriber, planId);

    const ops: any[] = [];
    if (subData) {
      ops.push(
        db.subscription.updateMany({
          where: { subscriber, planId },
          data: {
            status: parseSubscriptionStatus(subData.status),
            nextBillingTime: Number(subData.next_billing_time),
            lockedAt: null
          }
        })
      );
    }
    ops.push(
      db.billingAttempt.create({
        data: {
          subscriber,
          planId,
          status: "SUCCESS",
          txHash: event.txHash || null
        }
      })
    );
    ops.push(
      db.processedEvent.create({
        data: { eventId, eventType, ledger: event.ledger || 0 }
      })
    );

    await db.$transaction(ops);
  }

  return { processed: true, eventId, status: "indexed" };
}

/**
 * Synchronizes events across a bounded ledger range [startLedger, endLedger].
 * Propagates errors on RPC or database failures without advancing the cursor prematurely.
 */
export async function syncLedgerRange(
  startLedger: number,
  endLedger: number,
  db: PrismaClient = prisma,
  sdkClient: SubPathClient = client
): Promise<number> {
  let highestProcessedLedger = startLedger - 1;
  let cursor: string | undefined = undefined;
  let hasMore = true;

  while (hasMore) {
    const request: any = cursor
      ? {
          filters: [{ type: "contract", contractIds: [sdkClient.config.contractId] }],
          cursor,
          limit: EVENT_PAGE_LIMIT
        }
      : {
          startLedger,
          endLedger,
          filters: [{ type: "contract", contractIds: [sdkClient.config.contractId] }],
          limit: EVENT_PAGE_LIMIT
        };

    const res = await sdkClient.server.getEvents(request);
    const events = res.events || [];

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (event.ledger && event.ledger > endLedger) {
        hasMore = false;
        break;
      }

      await processContractEvent(event, i, db, sdkClient);

      if (event.ledger && event.ledger > highestProcessedLedger) {
        highestProcessedLedger = event.ledger;
      }
    }

    if (res.cursor && events.length === EVENT_PAGE_LIMIT && (!events[events.length - 1]?.ledger || events[events.length - 1].ledger <= endLedger)) {
      cursor = res.cursor;
    } else {
      hasMore = false;
    }
  }

  return Math.max(highestProcessedLedger, endLedger);
}

let isRunning = true;
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down indexer gracefully...`);
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

export async function run() {
  console.log("Starting SubPath Durable PostgreSQL Indexer with resilient cursor semantics...");

  let state = await prisma.indexerState.findUnique({
    where: { id: "singleton" }
  });

  if (!state) {
    const latestLedger = await client.server.getLatestLedger();
    const startLedger = Math.max(1, latestLedger.sequence - 1000);
    state = await prisma.indexerState.create({
      data: { id: "singleton", lastSyncedLedger: startLedger }
    });
    console.log(`Initialized IndexerState singleton with start ledger ${startLedger}`);
  }

  let lastSyncedLedger = state.lastSyncedLedger;

  while (isRunning) {
    try {
      const latestLedger = await client.server.getLatestLedger();

      // Explicit RPC retention gap handling
      if ((latestLedger as any).oldestLedger && lastSyncedLedger + 1 < (latestLedger as any).oldestLedger) {
        console.warn(
          `[INDEXER RETENTION GAP] Durable cursor (${lastSyncedLedger}) is older than RPC retention window (${(latestLedger as any).oldestLedger}). Resetting to oldest available ledger.`
        );
        lastSyncedLedger = (latestLedger as any).oldestLedger;
        await prisma.indexerState.update({
          where: { id: "singleton" },
          data: { lastSyncedLedger }
        });
      }

      if (latestLedger.sequence > lastSyncedLedger) {
        const targetLedger = Math.min(latestLedger.sequence, lastSyncedLedger + MAX_LEDGER_BATCH);
        console.log(`Indexing bounded batch: ledgers ${lastSyncedLedger + 1} to ${targetLedger}`);

        // syncLedgerRange throws on failure -> cursor will NOT be advanced
        const durablyProcessedUpTo = await syncLedgerRange(lastSyncedLedger + 1, targetLedger, prisma, client);

        lastSyncedLedger = durablyProcessedUpTo;
        await prisma.indexerState.update({
          where: { id: "singleton" },
          data: { lastSyncedLedger }
        });
      }
    } catch (e) {
      console.error("[INDEXER ERROR] Synchronisation failure. Preserving durable cursor for retry:", e);
    }

    for (let i = 0; i < 10 && isRunning; i++) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

if (process.env.NODE_ENV !== "test" && require.main === module) {
  run();
}

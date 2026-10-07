import { SubPathClient, SubscriptionStatus } from "@subpath/sdk";
import { PrismaClient } from "@prisma/client";
import { scValToNative } from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });

const prisma = new PrismaClient();

const client = new SubPathClient({
  contractId: process.env.NEXT_PUBLIC_SUBPATH_CONTRACT_ID || "",
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE || "Test SDF Network ; September 2015"
});

async function run() {
  console.log("Starting SubPath Durable PostgreSQL Indexer...");

  // Phase 11: Cursor Persistence - Restore cursor from Database
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

  while (true) {
    try {
      const latestLedger = await client.server.getLatestLedger();
      if (latestLedger.sequence > lastSyncedLedger) {
        console.log(`Indexing ledgers ${lastSyncedLedger + 1} to ${latestLedger.sequence}`);
        await syncEvents(lastSyncedLedger + 1, latestLedger.sequence);
        lastSyncedLedger = latestLedger.sequence;

        await prisma.indexerState.update({
          where: { id: "singleton" },
          data: { lastSyncedLedger }
        });
      }
    } catch (e) {
      console.error("Indexer poll loop error:", e);
    }
    // Poll every 10 seconds
    await new Promise(r => setTimeout(r, 10000));
  }
}

function parseSubscriptionStatus(status: any): number {
  const str = String(Array.isArray(status) ? status[0] : (typeof status === 'object' && status !== null ? Object.keys(status)[0] : status));
  if (str === "Active" || str === "0") return 1; // 1 = ACTIVE
  if (str === "Paused" || str === "2") return 3; // 3 = PAUSED
  if (str === "Canceled" || str === "1") return 0; // 0 = CANCELED
  return 1;
}

async function syncEvents(startLedger: number, endLedger: number) {
  let res;
  try {
    res = await client.server.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [client.config.contractId]
        }
      ],
      limit: 10000
    });
  } catch (err) {
    console.error(`Failed to fetch contract events from ledger ${startLedger}:`, err);
    return;
  }

  for (let i = 0; i < (res.events || []).length; i++) {
    const event = res.events[i];
    const eventId = event.id || `${event.ledger}:${event.txHash}:${i}`;

    // Phase 12: Event Idempotency Check
    const existing = await prisma.processedEvent.findUnique({
      where: { eventId }
    });
    if (existing) {
      continue; // Skip already indexed event
    }

    const topic1 = event.topic[0] ? scValToNative(event.topic[0]) : null;
    const topic2 = event.topic[1] ? scValToNative(event.topic[1]) : null;

    try {
      if (topic1 === "plan_add") {
        const planId = Number(scValToNative(event.value));
        const planData = await client.getPlan(planId);
        if (planData) {
          await prisma.plan.upsert({
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
          });
          console.log(`[INDEXER] Processed event plan_add -> Plan #${planId}`);
        }
      } else if (topic1 === "sub_new") {
        const subscriber = String(topic2 || "");
        const planId = Number(scValToNative(event.value));
        const subData = await client.getSubscription(subscriber, planId);
        if (subData) {
          const parsedStatus = parseSubscriptionStatus(subData.status);
          await prisma.subscription.upsert({
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
          });
          console.log(`[INDEXER] Processed event sub_new -> Subscriber ${subscriber} on Plan #${planId}`);
        }
      } else if (topic1 === "sub_pause") {
        const subscriber = String(topic2 || "");
        const planId = Number(scValToNative(event.value));
        await prisma.subscription.updateMany({
          where: { subscriber, planId },
          data: { status: 3, lockedAt: null } // 3 = PAUSED
        });
        console.log(`[INDEXER] Processed event sub_pause -> Subscriber ${subscriber} on Plan #${planId}`);
      } else if (topic1 === "sub_resume") {
        const subscriber = String(topic2 || "");
        const planId = Number(scValToNative(event.value));
        const subData = await client.getSubscription(subscriber, planId);
        await prisma.subscription.updateMany({
          where: { subscriber, planId },
          data: {
            status: subData ? parseSubscriptionStatus(subData.status) : 1,
            nextBillingTime: subData ? Number(subData.next_billing_time) : Math.floor(Date.now() / 1000),
            lockedAt: null
          }
        });
        console.log(`[INDEXER] Processed event sub_resume -> Subscriber ${subscriber} on Plan #${planId}`);
      } else if (topic1 === "sub_end" || topic1 === "sub_cancel") {
        const subscriber = String(topic2 || "");
        const planId = Number(scValToNative(event.value));
        await prisma.subscription.updateMany({
          where: { subscriber, planId },
          data: { status: 0, lockedAt: null } // 0 = CANCELED
        });
        console.log(`[INDEXER] Processed event sub_cancel -> Subscriber ${subscriber} on Plan #${planId}`);
      } else if (topic1 === "sub_billed") {
        const subscriber = String(topic2 || "");
        const planId = Number(scValToNative(event.value));
        const subData = await client.getSubscription(subscriber, planId);
        if (subData) {
          await prisma.subscription.updateMany({
            where: { subscriber, planId },
            data: {
              status: parseSubscriptionStatus(subData.status),
              nextBillingTime: Number(subData.next_billing_time),
              lockedAt: null
            }
          });
        }
        await prisma.billingAttempt.create({
          data: {
            subscriber,
            planId,
            status: "SUCCESS",
            txHash: event.txHash || null
          }
        });
        console.log(`[INDEXER] Processed event sub_billed -> Billed ${subscriber} for Plan #${planId}`);
      }

      // Mark event as processed
      await prisma.processedEvent.create({
        data: {
          eventId,
          eventType: String(topic1 || "unknown"),
          ledger: event.ledger || endLedger
        }
      });
    } catch (err) {
      console.error(`Error processing event ${eventId}:`, err);
    }
  }
}

run();

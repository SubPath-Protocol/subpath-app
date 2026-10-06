import { SubPathClient } from "@subpath/sdk";
import { PrismaClient } from "@prisma/client";
import { xdr, scValToNative } from "@stellar/stellar-sdk";
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
  console.log("Starting SubPath PostgreSQL Indexer...");
  
  let lastSyncedLedger = 0;
  
  while (true) {
    try {
      const latestLedger = await client.server.getLatestLedger();
      if (lastSyncedLedger === 0) {
        lastSyncedLedger = Math.max(1, latestLedger.sequence - 1000); // Start indexing
      }

      if (latestLedger.sequence > lastSyncedLedger) {
        console.log(`Syncing ledgers ${lastSyncedLedger} to ${latestLedger.sequence}`);
        await syncEvents(lastSyncedLedger);
        lastSyncedLedger = latestLedger.sequence;
      }
    } catch (e) {
      console.error("Indexer error:", e);
    }
    // Poll every 10 seconds (Stellar closes a ledger every ~5s)
    await new Promise(r => setTimeout(r, 10000));
  }
}

async function syncEvents(startLedger: number) {
  const res = await client.server.getEvents({
    startLedger,
    filters: [
      {
        type: "contract",
        contractIds: [client.config.contractId],
        topics: [["*"]]
      }
    ],
    limit: 10000
  });

  for (const event of res.events || []) {
    const topic1 = event.topic[0] ? scValToNative(event.topic[0]) : null;
    
    if (topic1 === "plan_add") {
       const planId = Number(scValToNative(event.value));
       const planData = await client.getPlan(planId);
       if (planData) {
         await prisma.plan.upsert({
           where: { id: planId },
           update: {},
           create: {
             id: planId,
             merchant: planData.merchant,
             token: planData.token,
             amount: planData.amount.toString(),
             cycleSeconds: planData.cycle_seconds
           }
         });
         console.log(`Indexed new Plan #${planId}`);
       }
    }
  }
}

run();

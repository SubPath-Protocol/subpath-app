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

async function run() {
  console.log(`Starting SubPath Executor with public key: ${keypair?.publicKey() || "DRY RUN"}`);
  
  while (true) {
    try {
      await pollAndExecute();
    } catch (e) {
      console.error("Executor error:", e);
    }
    await new Promise(r => setTimeout(r, 60000));
  }
}

async function pollAndExecute() {
  console.log(`Checking for due subscriptions on-chain...`);
  const now = Math.floor(Date.now() / 1000);

  // 1. Idempotency Lock: Find due subscriptions that are NOT currently processing
  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      nextBillingTime: { lte: now },
      status: 1 // 1 = ACTIVE, 2 = PROCESSING, 0 = CANCELED
    },
    take: 50 // Batch size
  });

  if (dueSubscriptions.length === 0) {
    console.log("No subscriptions due.");
    return;
  }

  for (const sub of dueSubscriptions) {
    // 2. Optimistic Concurrency Control: Lock the row
    const locked = await prisma.subscription.updateMany({
      where: { subscriber: sub.subscriber, planId: sub.planId, status: 1 },
      data: { status: 2 } // Mark as PROCESSING
    });

    if (locked.count === 0) continue; // Another executor got it

    console.log(`Executing billing for ${sub.subscriber} on plan ${sub.planId}`);
    
    if (!keypair) {
      // Dry run
      await prisma.subscription.update({
        where: { subscriber_planId: { subscriber: sub.subscriber, planId: sub.planId } },
        data: { status: 1 } // Revert lock
      });
      continue;
    }

    try {
      const op = client.executeBilling(keypair.publicKey(), sub.subscriber, sub.planId);
      const accountData = await client.server.getAccount(keypair.publicKey());
      const source = new Account(keypair.publicKey(), accountData.sequenceNumber());
      const tx = new TransactionBuilder(source, { fee: "10000", networkPassphrase: client.config.networkPassphrase })
        .addOperation(op)
        .setTimeout(100)
        .build();
        
      tx.sign(keypair);
      const resp = await client.server.sendTransaction(tx);
      
      if (resp.status === "PENDING" || resp.status === "SUCCESS") {
         console.log(`Execution sent. TX Hash: ${resp.hash}`);
         // Status will be reverted to ACTIVE by the Indexer once the event is seen on-chain
      } else {
         throw new Error(`Tx failed: ${resp.status}`);
      }
    } catch (e) {
      console.error(`Failed to execute sub ${sub.planId} for ${sub.subscriber}:`, e);
      // Unlock on failure
      await prisma.subscription.update({
        where: { subscriber_planId: { subscriber: sub.subscriber, planId: sub.planId } },
        data: { status: 1 }
      });
    }
  }
}

run();

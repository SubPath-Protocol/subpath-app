import { Keypair, rpc, TransactionBuilder, Networks, Horizon } from "@stellar/stellar-sdk";
import { SubPathClient } from "../../packages/sdk/src/client";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const prisma = new PrismaClient();
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

const merchantSecret = process.env.TEST_MERCHANT_SECRET || process.env.EXECUTOR_SECRET;
const subscriberSecret = process.env.TEST_SUBSCRIBER_SECRET;

const merchantKp = merchantSecret ? Keypair.fromSecret(merchantSecret) : Keypair.random();
const subscriberKp = subscriberSecret ? Keypair.fromSecret(subscriberSecret) : Keypair.random();

const client = new SubPathClient({
  networkPassphrase: Networks.TESTNET,
  rpcUrl: "https://soroban-testnet.stellar.org",
  contractId: "CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3"
});
const NATIVE_TOKEN = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function getBalance(pubKey: string) {
  const account = await horizon.loadAccount(pubKey);
  const native = account.balances.find((b: any) => b.asset_type === "native");
  return native ? native.balance : "0";
}

async function submitTx(kp: Keypair, op: any) {
  const source = await horizon.loadAccount(kp.publicKey());
  let tx = new TransactionBuilder(source, {
    fee: "1000000",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const prepared = await client.server.prepareTransaction(tx);
  prepared.sign(kp);
  const response = await client.server.sendTransaction(prepared);
  if (response.status === "ERROR") {
    console.error("TX Error:", response);
    throw new Error("Tx Failed");
  }

  // Wait for confirmation
  let txStatus;
  while (true) {
    txStatus = await client.server.getTransaction(response.hash);
    if (txStatus.status !== "NOT_FOUND") break;
    await delay(2000);
  }
  return { hash: response.hash, ledger: txStatus.ledger };
}

async function run() {
  console.log("=== SubPath E2E Infrastructure Verification ===");

  const cursorBefore = await prisma.indexerState.findUnique({ where: { id: "singleton" } });
  console.log(`Initial Cursor: ${cursorBefore?.lastSyncedLedger}`);

  console.log("\n[1] Creating Plan...");
  const cycleSeconds = 15;
  const amount = 1000000n; // 0.1 XLM
  const createPlanOp = client.createPlan(merchantKp.publicKey(), NATIVE_TOKEN, amount, cycleSeconds);
  const planTx = await submitTx(merchantKp, createPlanOp);
  console.log(`Plan Created! Hash: ${planTx.hash}, Ledger: ${planTx.ledger}`);

  console.log("Waiting for indexer to pick up plan...");
  let dbPlan;
  while (true) {
    dbPlan = await prisma.plan.findFirst({ orderBy: { id: 'desc' } });
    if (dbPlan) break;
    await delay(3000);
  }
  const planId = dbPlan.id;
  console.log(`Indexed Plan ID: ${planId}`);

  console.log("\n[2] Subscriber Allowance...");
  const currentLedger = (await client.server.getLatestLedger()).sequence;
  const approveOp = client.approveToken(NATIVE_TOKEN, subscriberKp.publicKey(), 100000000n, currentLedger + 10000);
  const approveTx = await submitTx(subscriberKp, approveOp);
  console.log(`Allowance Approved! Hash: ${approveTx.hash}`);

  console.log("\n[3] Subscriber Subscribes...");
  const subOp = client.subscribe(subscriberKp.publicKey(), planId);
  const subTx = await submitTx(subscriberKp, subOp);
  console.log(`Subscribed! Hash: ${subTx.hash}, Ledger: ${subTx.ledger}`);

  console.log("Waiting for indexer to pick up subscription...");
  let dbSub;
  while (true) {
    dbSub = await prisma.subscription.findUnique({
      where: { subscriber_planId: { subscriber: subscriberKp.publicKey(), planId } }
    });
    if (dbSub) break;
    await delay(3000);
  }
  console.log(`Indexed Subscription: Next Billing: ${dbSub.nextBillingTime}`);

  const merchantBal1 = await getBalance(merchantKp.publicKey());
  const subBal1 = await getBalance(subscriberKp.publicKey());
  console.log(`\nBalances Before Recurring: Merchant=${merchantBal1}, Subscriber=${subBal1}`);

  console.log(`\n[4] Waiting for Executor to trigger automated billing...`);
  console.log(`Target Next Billing Time: ${dbSub.nextBillingTime}`);
  let lastBilledAt = dbSub.lastBilledAt;
  while (true) {
    const checkSub = await prisma.subscription.findUnique({
      where: { subscriber_planId: { subscriber: subscriberKp.publicKey(), planId } }
    });
    const now = Math.floor(Date.now() / 1000);
    console.log(`Current Time: ${now}, Next Billing: ${checkSub?.nextBillingTime}`);
    if (checkSub?.lastBilledAt !== lastBilledAt) {
      console.log(`\nBilling Executed! New LastBilledAt: ${checkSub?.lastBilledAt}`);
      console.log(`Updated Next Billing Time: ${checkSub?.nextBillingTime}`);
      break;
    }
    await delay(5000);
  }

  const merchantBal2 = await getBalance(merchantKp.publicKey());
  const subBal2 = await getBalance(subscriberKp.publicKey());
  console.log(`\nBalances After Recurring: Merchant=${merchantBal2}, Subscriber=${subBal2}`);

  const cursorAfter = await prisma.indexerState.findUnique({ where: { id: "singleton" } });
  console.log(`\nFinal Cursor: ${cursorAfter?.lastSyncedLedger}`);
  console.log("=== Verification Complete ===");
}

run().catch(console.error);

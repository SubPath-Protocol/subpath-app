import { SubPathClient } from "@subpath/sdk";
import { Keypair, TransactionBuilder, Account } from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });

const EXECUTOR_SECRET = process.env.EXECUTOR_SECRET;
if (!EXECUTOR_SECRET) {
  throw new Error("EXECUTOR_SECRET is missing");
}

const keypair = Keypair.fromSecret(EXECUTOR_SECRET);

const client = new SubPathClient({
  contractId: process.env.NEXT_PUBLIC_SUBPATH_CONTRACT_ID || "",
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
  networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE || "Test SDF Network ; September 2015"
});

async function run() {
  console.log(`Starting SubPath Executor with public key: ${keypair.publicKey()}`);
  
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
  // Note: For a production network, this executor should poll an off-chain indexer database 
  // that stores the exact list of subscribers and their next billing times.
  
  // Here is the reference logic to execute a due subscription once identified:
  /*
  const op = client.executeBilling(keypair.publicKey(), subscriber, planId);
  const accountData = await client.server.getAccount(keypair.publicKey());
  const source = new Account(keypair.publicKey(), accountData.sequence);
  const tx = new TransactionBuilder(source, { fee: "10000", networkPassphrase: client.config.networkPassphrase })
    .addOperation(op)
    .setTimeout(100)
    .build();
    
  tx.sign(keypair);
  const resp = await client.server.sendTransaction(tx);
  console.log("Execution Result:", resp);
  */
}

run();

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const sdk_1 = require("@subpath/sdk");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });
const EXECUTOR_SECRET = process.env.EXECUTOR_SECRET;
if (!EXECUTOR_SECRET) {
    throw new Error("EXECUTOR_SECRET is missing");
}
const keypair = stellar_sdk_1.Keypair.fromSecret(EXECUTOR_SECRET);
const client = new sdk_1.SubPathClient({
    contractId: process.env.NEXT_PUBLIC_SUBPATH_CONTRACT_ID || "",
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
    networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE || "Test SDF Network ; September 2015"
});
async function run() {
    console.log(`Starting SubPath Executor with public key: ${keypair.publicKey()}`);
    while (true) {
        try {
            await pollAndExecute();
        }
        catch (e) {
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

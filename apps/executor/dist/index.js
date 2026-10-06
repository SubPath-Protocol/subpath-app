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
const client_1 = require("@prisma/client");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });
const EXECUTOR_SECRET = process.env.EXECUTOR_SECRET;
if (!EXECUTOR_SECRET) {
    console.warn("EXECUTOR_SECRET is missing. Executor will run in dry-run mode.");
}
const keypair = EXECUTOR_SECRET ? stellar_sdk_1.Keypair.fromSecret(EXECUTOR_SECRET) : null;
const prisma = new client_1.PrismaClient();
const client = new sdk_1.SubPathClient({
    contractId: process.env.NEXT_PUBLIC_SUBPATH_CONTRACT_ID || "",
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
    networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE || "Test SDF Network ; September 2015"
});
async function run() {
    console.log(`Starting SubPath Executor with public key: ${keypair?.publicKey() || "DRY RUN"}`);
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
        if (locked.count === 0)
            continue; // Another executor got it
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
            const source = new stellar_sdk_1.Account(keypair.publicKey(), accountData.sequenceNumber());
            const tx = new stellar_sdk_1.TransactionBuilder(source, { fee: "10000", networkPassphrase: client.config.networkPassphrase })
                .addOperation(op)
                .setTimeout(100)
                .build();
            tx.sign(keypair);
            const resp = await client.server.sendTransaction(tx);
            if (resp.status === "PENDING") {
                console.log(`Execution sent. TX Hash: ${resp.hash}`);
                // Status will be reverted to ACTIVE by the Indexer once the event is seen on-chain
            }
            else {
                throw new Error(`Tx failed: ${resp.status}`);
            }
        }
        catch (e) {
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

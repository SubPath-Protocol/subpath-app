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
const client_1 = require("@prisma/client");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const dotenv = __importStar(require("dotenv"));
dotenv.config({ path: "../../.env.local" });
dotenv.config({ path: "../../.env" });
const prisma = new client_1.PrismaClient();
const client = new sdk_1.SubPathClient({
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
        }
        catch (e) {
            console.error("Indexer error:", e);
        }
        // Poll every 10 seconds (Stellar closes a ledger every ~5s)
        await new Promise(r => setTimeout(r, 10000));
    }
}
async function syncEvents(startLedger) {
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
        const topic1 = event.topic[0] ? (0, stellar_sdk_1.scValToNative)(stellar_sdk_1.xdr.ScVal.fromXDR(event.topic[0], "base64")) : null;
        if (topic1 === "plan_add") {
            const planId = Number((0, stellar_sdk_1.scValToNative)(event.value));
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

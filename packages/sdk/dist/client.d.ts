import { Contract, rpc } from "@stellar/stellar-sdk";
import type { SubPathConfig } from "./config";
import type { Plan, Subscription } from "./types";
export declare class SubPathClient {
    readonly config: SubPathConfig;
    readonly contract: Contract;
    readonly server: rpc.Server;
    constructor(config: SubPathConfig);
    getPlan(planId: number): Promise<Plan | null>;
    getSubscription(subscriber: string, planId: number): Promise<Subscription | null>;
    private simulateRead;
    approveToken(tokenAddress: string, from: string, amount: bigint, expirationLedger: number): import("@stellar/stellar-sdk/lib/esm/xdr").Operation;
    createPlan(merchant: string, token: string, amount: bigint, cycleSeconds: number): import("@stellar/stellar-sdk/lib/esm/xdr").Operation;
    subscribe(subscriber: string, planId: number): import("@stellar/stellar-sdk/lib/esm/xdr").Operation;
    cancelSubscription(subscriber: string, planId: number): import("@stellar/stellar-sdk/lib/esm/xdr").Operation;
    pauseSubscription(subscriber: string, planId: number): import("@stellar/stellar-sdk/lib/esm/xdr").Operation;
    resumeSubscription(subscriber: string, planId: number): import("@stellar/stellar-sdk/lib/esm/xdr").Operation;
    executeBilling(caller: string, subscriber: string, planId: number): import("@stellar/stellar-sdk/lib/esm/xdr").Operation;
}

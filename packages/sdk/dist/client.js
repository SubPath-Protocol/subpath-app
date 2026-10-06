"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubPathClient = void 0;
const stellar_sdk_1 = require("@stellar/stellar-sdk");
class SubPathClient {
    config;
    contract;
    server;
    constructor(config) {
        this.config = config;
        this.contract = new stellar_sdk_1.Contract(config.contractId);
        this.server = new stellar_sdk_1.rpc.Server(config.rpcUrl);
    }
    // --- Reads ---
    async getPlan(planId) {
        const op = this.contract.call("get_plan", (0, stellar_sdk_1.nativeToScVal)(planId, { type: "u64" }));
        return this.simulateRead(op);
    }
    async getSubscription(subscriber, planId) {
        const op = this.contract.call("get_subscription", (0, stellar_sdk_1.nativeToScVal)(subscriber, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(planId, { type: "u64" }));
        return this.simulateRead(op);
    }
    async simulateRead(operation) {
        // To simulate a read, we build a dummy transaction from a zero account
        const source = new stellar_sdk_1.Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
        const tx = new stellar_sdk_1.TransactionBuilder(source, {
            fee: "100",
            networkPassphrase: this.config.networkPassphrase,
        })
            .addOperation(operation)
            .setTimeout(30)
            .build();
        const response = await this.server.simulateTransaction(tx);
        if (stellar_sdk_1.rpc.Api.isSimulationError(response)) {
            throw new Error(`Simulation error: ${response.error}`);
        }
        if (!response.result || !response.result.retval) {
            return null;
        }
        // In soroban, successful reads wrap the result in the retval
        return (0, stellar_sdk_1.scValToNative)(response.result.retval);
    }
    // --- Writes (Returning operations to be signed by a wallet/executor) ---
    createPlan(merchant, token, amount, cycleSeconds) {
        return this.contract.call("create_plan", (0, stellar_sdk_1.nativeToScVal)(merchant, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(token, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(amount, { type: "i128" }), (0, stellar_sdk_1.nativeToScVal)(cycleSeconds, { type: "u64" }));
    }
    subscribe(subscriber, planId) {
        return this.contract.call("subscribe", (0, stellar_sdk_1.nativeToScVal)(subscriber, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(planId, { type: "u64" }));
    }
    cancelSubscription(subscriber, planId) {
        return this.contract.call("cancel_subscription", (0, stellar_sdk_1.nativeToScVal)(subscriber, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(planId, { type: "u64" }));
    }
    executeBilling(caller, subscriber, planId) {
        return this.contract.call("execute_billing", (0, stellar_sdk_1.nativeToScVal)(caller, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(subscriber, { type: "address" }), (0, stellar_sdk_1.nativeToScVal)(planId, { type: "u64" }));
    }
}
exports.SubPathClient = SubPathClient;

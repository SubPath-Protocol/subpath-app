import { Contract, nativeToScVal, scValToNative, rpc, TransactionBuilder, Account, Networks } from "@stellar/stellar-sdk";
import type { SubPathConfig } from "./config";
import type { Plan, Subscription } from "./types";

export class SubPathClient {
  public readonly contract: Contract;
  public readonly server: rpc.Server;

  constructor(public readonly config: SubPathConfig) {
    this.contract = new Contract(config.contractId);
    this.server = new rpc.Server(config.rpcUrl);
  }

  // --- Reads ---
  async getPlan(planId: number): Promise<Plan | null> {
    const op = this.contract.call("get_plan", nativeToScVal(planId, { type: "u64" }));
    return this.simulateRead<Plan>(op);
  }

  async getSubscription(subscriber: string, planId: number): Promise<Subscription | null> {
    const op = this.contract.call("get_subscription",
      nativeToScVal(subscriber, { type: "address" }),
      nativeToScVal(planId, { type: "u64" })
    );
    return this.simulateRead<Subscription>(op);
  }

  private async simulateRead<T>(operation: any): Promise<T | null> {
    // To simulate a read, we build a dummy transaction from a zero account
    const source = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF", "0");
    const tx = new TransactionBuilder(source, {
      fee: "100",
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const response = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(response)) {
      throw new Error(`Simulation error: ${response.error}`);
    }
    if (!response.result || !response.result.retval) {
      return null;
    }
    
    // In soroban, successful reads wrap the result in the retval
    return scValToNative(response.result.retval) as T;
  }

  // --- Writes (Returning operations to be signed by a wallet/executor) ---
  approveToken(tokenAddress: string, from: string, amount: bigint, expirationLedger: number) {
    const token = new Contract(tokenAddress);
    return token.call("approve",
      nativeToScVal(from, { type: "address" }),
      nativeToScVal(this.config.contractId, { type: "address" }),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(expirationLedger, { type: "u32" })
    );
  }

  createPlan(merchant: string, token: string, amount: bigint, cycleSeconds: number) {
    return this.contract.call("create_plan",
      nativeToScVal(merchant, { type: "address" }),
      nativeToScVal(token, { type: "address" }),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(cycleSeconds, { type: "u64" })
    );
  }

  subscribe(subscriber: string, planId: number) {
    return this.contract.call("subscribe",
      nativeToScVal(subscriber, { type: "address" }),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  cancelSubscription(subscriber: string, planId: number) {
    return this.contract.call("cancel_subscription",
      nativeToScVal(subscriber, { type: "address" }),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  pauseSubscription(subscriber: string, planId: number) {
    return this.contract.call("pause_subscription",
      nativeToScVal(subscriber, { type: "address" }),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  resumeSubscription(subscriber: string, planId: number) {
    return this.contract.call("resume_subscription",
      nativeToScVal(subscriber, { type: "address" }),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  executeBilling(caller: string, subscriber: string, planId: number) {
    return this.contract.call("execute_billing",
      nativeToScVal(caller, { type: "address" }),
      nativeToScVal(subscriber, { type: "address" }),
      nativeToScVal(planId, { type: "u64" })
    );
  }
}

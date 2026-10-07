import { Contract, nativeToScVal, scValToNative, rpc, TransactionBuilder, Account, Address } from "@stellar/stellar-sdk";
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
    if (typeof planId !== "number" || isNaN(planId) || planId < 0) {
      return null;
    }
    const op = this.contract.call("get_plan", nativeToScVal(planId, { type: "u64" }));
    return this.simulateRead<Plan>(op);
  }

  async getSubscription(subscriber: string, planId: number): Promise<Subscription | null> {
    if (typeof planId !== "number" || isNaN(planId) || planId < 0 || !subscriber) {
      return null;
    }
    const op = this.contract.call("get_subscription",
      nativeToScVal(new Address(subscriber)),
      nativeToScVal(planId, { type: "u64" })
    );
    return this.simulateRead<Subscription>(op);
  }

  private async simulateRead<T>(operation: any): Promise<T | null> {
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
      return null;
    }
    if (!response.result || !response.result.retval) {
      return null;
    }
    
    return scValToNative(response.result.retval) as T;
  }

  // --- Writes ---
  approveToken(tokenAddress: string, from: string, amount: bigint, expirationLedger: number) {
    const tokenContract = new Contract(tokenAddress);
    return tokenContract.call("approve",
      nativeToScVal(new Address(from)),
      nativeToScVal(new Address(this.config.contractId)),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(expirationLedger, { type: "u32" })
    );
  }

  createPlan(merchant: string, token: string, amount: bigint, cycleSeconds: number) {
    return this.contract.call("create_plan",
      nativeToScVal(new Address(merchant)),
      nativeToScVal(new Address(token)),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(cycleSeconds, { type: "u64" })
    );
  }

  subscribe(subscriber: string, planId: number) {
    return this.contract.call("subscribe",
      nativeToScVal(new Address(subscriber)),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  cancelSubscription(subscriber: string, planId: number) {
    return this.contract.call("cancel_subscription",
      nativeToScVal(new Address(subscriber)),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  pauseSubscription(subscriber: string, planId: number) {
    return this.contract.call("pause_subscription",
      nativeToScVal(new Address(subscriber)),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  resumeSubscription(subscriber: string, planId: number) {
    return this.contract.call("resume_subscription",
      nativeToScVal(new Address(subscriber)),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  executeBilling(subscriber: string, planId: number): any;
  executeBilling(caller: string, subscriber: string, planId: number): any;
  executeBilling(param1: string, param2: string | number, param3?: number) {
    if (typeof param2 === "number" || param3 === undefined) {
      const subscriber = param1;
      const planId = param2 as number;
      return this.contract.call("execute_billing",
        nativeToScVal(new Address(subscriber)),
        nativeToScVal(planId, { type: "u64" })
      );
    } else {
      const caller = param1;
      const subscriber = param2 as string;
      const planId = param3 as number;
      return this.contract.call("execute_billing",
        nativeToScVal(new Address(caller)),
        nativeToScVal(new Address(subscriber)),
        nativeToScVal(planId, { type: "u64" })
      );
    }
  }
}

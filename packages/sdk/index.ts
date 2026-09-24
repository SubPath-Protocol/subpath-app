import { Contract, Operation, nativeToScVal } from "@stellar/stellar-sdk";

export class SubPathClient {
  contractId: string;
  
  constructor(contractId: string) {
    this.contractId = contractId;
  }

  // Phase 5 interfaces wrapped in TS
  createPlan(merchant: string, token: string, amount: string, cycleSeconds: number) {
    const contract = new Contract(this.contractId);
    return contract.call("create_plan",
      nativeToScVal(merchant, { type: "address" }),
      nativeToScVal(token, { type: "address" }),
      nativeToScVal(amount, { type: "i128" }),
      nativeToScVal(cycleSeconds, { type: "u64" })
    );
  }

  subscribe(subscriber: string, planId: number) {
    const contract = new Contract(this.contractId);
    return contract.call("subscribe",
      nativeToScVal(subscriber, { type: "address" }),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  cancelSubscription(subscriber: string, planId: number) {
    const contract = new Contract(this.contractId);
    return contract.call("cancel_subscription",
      nativeToScVal(subscriber, { type: "address" }),
      nativeToScVal(planId, { type: "u64" })
    );
  }

  executeBilling(caller: string, subscriber: string, planId: number) {
    const contract = new Contract(this.contractId);
    return contract.call("execute_billing",
      nativeToScVal(caller, { type: "address" }),
      nativeToScVal(subscriber, { type: "address" }),
      nativeToScVal(planId, { type: "u64" })
    );
  }
}

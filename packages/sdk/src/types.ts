export interface Plan {
  merchant: string;
  token: string;
  amount: bigint;
  cycle_seconds: number;
}

export enum SubscriptionStatus {
  Active = 0,
  Canceled = 1,
  Paused = 2
}

export interface Subscription {
  subscriber: string;
  plan_id: number;
  status: SubscriptionStatus;
  next_billing_time: number;
}

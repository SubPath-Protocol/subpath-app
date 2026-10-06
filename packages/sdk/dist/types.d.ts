export interface Plan {
    merchant: string;
    amount: bigint;
    cycle_seconds: number;
}
export declare enum SubscriptionStatus {
    Active = 0,
    Canceled = 1
}
export interface Subscription {
    subscriber: string;
    plan_id: number;
    status: SubscriptionStatus;
    next_billing_time: number;
}

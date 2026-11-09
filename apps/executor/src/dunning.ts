/**
 * Dunning & Retry Schedule for SubPath Recurring Billing Executor
 *
 * Implements exponential backoff retry scheduling to handle transient RPC timeouts
 * or failing allowance checks without hammering Stellar RPC nodes.
 */

export const DEFAULT_DUNNING_BACKOFF_HOURS = [1, 6, 24]; // 1st retry: 1h, 2nd: 6h, 3rd: 24h
export const MAX_DUNNING_RETRY_ATTEMPTS = DEFAULT_DUNNING_BACKOFF_HOURS.length;

export const SUBSCRIPTION_STATUS = {
  CANCELED: 0,
  ACTIVE: 1,
  PROCESSING: 2,
  PAUSED: 3,
} as const;

export interface DunningRetryResult {
  attemptCount: number;
  delayHours: number;
  delaySeconds: number;
  nextBillingTime: number;
  milestoneIso: string;
  isMaxExceeded: boolean;
  nextStatus: number;
}

/**
 * Calculates the next retry timestamp with exponential backoff progression.
 *
 * @param consecutiveFailures The number of prior consecutive failures for this billing cycle.
 * @param nowSeconds Current unix timestamp in seconds.
 * @param scheduleHours Array of backoff delay intervals in hours (default: [1, 6, 24]).
 */
export function calculateDunningRetry(
  consecutiveFailures: number,
  nowSeconds = Math.floor(Date.now() / 1000),
  scheduleHours = DEFAULT_DUNNING_BACKOFF_HOURS
): DunningRetryResult {
  const attemptCount = consecutiveFailures + 1;

  if (attemptCount > scheduleHours.length) {
    return {
      attemptCount,
      delayHours: 0,
      delaySeconds: 0,
      nextBillingTime: nowSeconds,
      milestoneIso: new Date(nowSeconds * 1000).toISOString(),
      isMaxExceeded: true,
      nextStatus: SUBSCRIPTION_STATUS.PAUSED,
    };
  }

  const delayHours = scheduleHours[attemptCount - 1];
  const delaySeconds = delayHours * 3600;
  const nextBillingTime = nowSeconds + delaySeconds;

  return {
    attemptCount,
    delayHours,
    delaySeconds,
    nextBillingTime,
    milestoneIso: new Date(nextBillingTime * 1000).toISOString(),
    isMaxExceeded: false,
    nextStatus: SUBSCRIPTION_STATUS.ACTIVE,
  };
}

/**
 * Formats a structured log message with attempt counts and milestone timestamp.
 */
export function formatDunningRetryLog(
  subscriber: string,
  planId: number,
  result: DunningRetryResult
): string {
  if (result.isMaxExceeded) {
    return `[EXECUTOR RETRY MAX_EXCEEDED] Subscription ${planId}:${subscriber} reached max retry attempts (${result.attemptCount - 1}). Status transitioning to PAUSED to prevent RPC node exhaustion.`;
  }

  return `[EXECUTOR RETRY SCHEDULED] Scheduled retry attempt #${result.attemptCount} for ${planId}:${subscriber} in ${result.delayHours}h. Next milestone: ${result.milestoneIso} (timestamp: ${result.nextBillingTime})`;
}

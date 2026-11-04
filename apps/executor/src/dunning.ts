/**
 * Dunning Retry Schedule with Exponential Backoff for Executor Daemon
 *
 * Implements automated retry scheduling for recurring payment executions
 * that encounter transient RPC timeouts or failing allowance checks.
 *
 * Schedule:
 * - 1st failure: retry after 1 hour (3600 seconds)
 * - 2nd failure: retry after 6 hours (21600 seconds)
 * - 3rd failure: retry after 24 hours (86400 seconds)
 * - 4th failure+: max retries reached, stops hammering RPC nodes
 */

export const DEFAULT_DUNNING_SCHEDULE_SECONDS: readonly number[] = [
  3600,       // 1 hour
  6 * 3600,   // 6 hours
  24 * 3600   // 24 hours
];

export interface DunningCalculation {
  attemptCount: number;
  delaySeconds: number | null;
  nextRetryTimestamp: number | null;
  isMaxRetriesExceeded: boolean;
}

/**
 * Returns the backoff delay in seconds for the given failed attempt index (1-based).
 * Returns null if the maximum number of attempts has been reached.
 */
export function getDunningDelay(
  attemptIndex: number,
  schedule: readonly number[] = DEFAULT_DUNNING_SCHEDULE_SECONDS
): number | null {
  if (attemptIndex <= 0) {
    return 0;
  }
  const scheduleIndex = attemptIndex - 1;
  if (scheduleIndex < schedule.length) {
    return schedule[scheduleIndex];
  }
  return null;
}

/**
 * Calculates the next retry milestone timestamp based on current time and failure attempt count.
 */
export function calculateDunningRetry(
  currentTimestampSeconds: number,
  failedAttemptCount: number,
  schedule: readonly number[] = DEFAULT_DUNNING_SCHEDULE_SECONDS
): DunningCalculation {
  const delaySeconds = getDunningDelay(failedAttemptCount, schedule);

  if (delaySeconds === null) {
    return {
      attemptCount: failedAttemptCount,
      delaySeconds: null,
      nextRetryTimestamp: null,
      isMaxRetriesExceeded: true
    };
  }

  return {
    attemptCount: failedAttemptCount,
    delaySeconds,
    nextRetryTimestamp: currentTimestampSeconds + delaySeconds,
    isMaxRetriesExceeded: false
  };
}

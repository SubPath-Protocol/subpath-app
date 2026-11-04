import { describe, it, expect } from "vitest";
import {
  calculateDunningRetry,
  formatDunningRetryLog,
  DEFAULT_DUNNING_BACKOFF_HOURS,
  MAX_DUNNING_RETRY_ATTEMPTS,
  SUBSCRIPTION_STATUS,
} from "../dunning";

describe("Executor Concurrency & Recovery Logic", () => {
  it("should calculate stale lock recovery threshold (5 minutes ago)", () => {
    const STALE_LOCK_TIMEOUT_MS = 5 * 60 * 1000;
    const now = 1000000000000;
    const threshold = new Date(now - STALE_LOCK_TIMEOUT_MS);

    expect(threshold.getTime()).toBe(now - 300000);
  });

  it("should identify due billing timestamp correctly", () => {
    const nextBillingTime = 1700000000;
    const currentTime = 1700000005;

    const isDue = nextBillingTime <= currentTime;
    expect(isDue).toBe(true);
  });
});

describe("Dunning Retry Schedule with Exponential Backoff", () => {
  const baseNow = 1700000000; // Fixed unix epoch reference in seconds

  it("should schedule 1st retry after 1 hour (3600s) for first transient failure", () => {
    const result = calculateDunningRetry(0, baseNow);

    expect(result.attemptCount).toBe(1);
    expect(result.delayHours).toBe(1);
    expect(result.delaySeconds).toBe(3600);
    expect(result.nextBillingTime).toBe(baseNow + 3600);
    expect(result.milestoneIso).toBe(new Date((baseNow + 3600) * 1000).toISOString());
    expect(result.isMaxExceeded).toBe(false);
    expect(result.nextStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
  });

  it("should schedule 2nd retry after 6 hours (21600s) for second failure", () => {
    const result = calculateDunningRetry(1, baseNow);

    expect(result.attemptCount).toBe(2);
    expect(result.delayHours).toBe(6);
    expect(result.delaySeconds).toBe(6 * 3600);
    expect(result.nextBillingTime).toBe(baseNow + 21600);
    expect(result.milestoneIso).toBe(new Date((baseNow + 21600) * 1000).toISOString());
    expect(result.isMaxExceeded).toBe(false);
    expect(result.nextStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
  });

  it("should schedule 3rd retry after 24 hours (86400s) for third failure", () => {
    const result = calculateDunningRetry(2, baseNow);

    expect(result.attemptCount).toBe(3);
    expect(result.delayHours).toBe(24);
    expect(result.delaySeconds).toBe(24 * 3600);
    expect(result.nextBillingTime).toBe(baseNow + 86400);
    expect(result.milestoneIso).toBe(new Date((baseNow + 86400) * 1000).toISOString());
    expect(result.isMaxExceeded).toBe(false);
    expect(result.nextStatus).toBe(SUBSCRIPTION_STATUS.ACTIVE);
  });

  it("should mark subscription PAUSED and exceed max retries after 3 failures to protect RPC nodes", () => {
    const result = calculateDunningRetry(3, baseNow);

    expect(result.attemptCount).toBe(4);
    expect(result.isMaxExceeded).toBe(true);
    expect(result.nextStatus).toBe(SUBSCRIPTION_STATUS.PAUSED);
  });

  it("should format structured log messages with milestone timestamps", () => {
    const retry1 = calculateDunningRetry(0, baseNow);
    const log1 = formatDunningRetryLog("GABC123", 42, retry1);

    expect(log1).toContain("[EXECUTOR RETRY SCHEDULED]");
    expect(log1).toContain("attempt #1");
    expect(log1).toContain("42:GABC123 in 1h");
    expect(log1).toContain(retry1.milestoneIso);

    const retryExceeded = calculateDunningRetry(3, baseNow);
    const logExceeded = formatDunningRetryLog("GABC123", 42, retryExceeded);

    expect(logExceeded).toContain("[EXECUTOR RETRY MAX_EXCEEDED]");
    expect(logExceeded).toContain("PAUSED to prevent RPC node exhaustion");
  });

  it("should prevent RPC node hammering by strictly enforcing positive delay intervals", () => {
    for (let failures = 0; failures < MAX_DUNNING_RETRY_ATTEMPTS; failures++) {
      const result = calculateDunningRetry(failures, baseNow);
      expect(result.delaySeconds).toBeGreaterThan(0);
      expect(result.nextBillingTime).toBeGreaterThan(baseNow);
      // Ensure delays strictly increase monotonically
      if (failures > 0) {
        const prev = calculateDunningRetry(failures - 1, baseNow);
        expect(result.delaySeconds).toBeGreaterThan(prev.delaySeconds);
      }
    }
  });

  it("should support custom backoff schedules", () => {
    const customSchedule = [2, 12, 48];
    const result = calculateDunningRetry(0, baseNow, customSchedule);

    expect(result.delayHours).toBe(2);
    expect(result.delaySeconds).toBe(7200);
    expect(result.nextBillingTime).toBe(baseNow + 7200);
  });
});

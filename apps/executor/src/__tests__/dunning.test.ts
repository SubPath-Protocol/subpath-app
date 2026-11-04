import { describe, it, expect } from "vitest";
import {
  DEFAULT_DUNNING_SCHEDULE_SECONDS,
  getDunningDelay,
  calculateDunningRetry
} from "../dunning";

describe("Dunning Retry Schedule & Exponential Backoff", () => {
  it("should return the correct backoff delays for 1st, 2nd, and 3rd failed attempts", () => {
    // 1st retry: 1 hour (3600s)
    expect(getDunningDelay(1)).toBe(3600);
    // 2nd retry: 6 hours (21600s)
    expect(getDunningDelay(2)).toBe(21600);
    // 3rd retry: 24 hours (86400s)
    expect(getDunningDelay(3)).toBe(86400);
  });

  it("should return null when max retries (3) are exceeded", () => {
    expect(getDunningDelay(4)).toBeNull();
    expect(getDunningDelay(5)).toBeNull();
    expect(getDunningDelay(10)).toBeNull();
  });

  it("should accurately calculate next retry timestamps without overflow", () => {
    const baseTime = 1730700000;

    // 1st attempt: 1 hour later
    const retry1 = calculateDunningRetry(baseTime, 1);
    expect(retry1.isMaxRetriesExceeded).toBe(false);
    expect(retry1.delaySeconds).toBe(3600);
    expect(retry1.nextRetryTimestamp).toBe(baseTime + 3600);

    // 2nd attempt: 6 hours later
    const retry2 = calculateDunningRetry(baseTime, 2);
    expect(retry2.isMaxRetriesExceeded).toBe(false);
    expect(retry2.delaySeconds).toBe(21600);
    expect(retry2.nextRetryTimestamp).toBe(baseTime + 21600);

    // 3rd attempt: 24 hours later
    const retry3 = calculateDunningRetry(baseTime, 3);
    expect(retry3.isMaxRetriesExceeded).toBe(false);
    expect(retry3.delaySeconds).toBe(86400);
    expect(retry3.nextRetryTimestamp).toBe(baseTime + 86400);

    // 4th attempt: max exceeded
    const retry4 = calculateDunningRetry(baseTime, 4);
    expect(retry4.isMaxRetriesExceeded).toBe(true);
    expect(retry4.delaySeconds).toBeNull();
    expect(retry4.nextRetryTimestamp).toBeNull();
  });

  it("should honor custom schedules if provided", () => {
    const customSchedule = [60, 300, 1800]; // 1m, 5m, 30m
    expect(getDunningDelay(1, customSchedule)).toBe(60);
    expect(getDunningDelay(2, customSchedule)).toBe(300);
    expect(getDunningDelay(3, customSchedule)).toBe(1800);
    expect(getDunningDelay(4, customSchedule)).toBeNull();
  });
});

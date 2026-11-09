import { describe, it, expect, vi } from 'vitest';
import {
  reconcilePendingTransactions,
  recoverStaleLocks,
  pollAndExecute,
  waitForTransactionConfirmation,
  STALE_LOCK_TIMEOUT_MS
} from '../index';
import {
  calculateDunningRetry,
  formatDunningRetryLog,
  DEFAULT_DUNNING_BACKOFF_HOURS,
  MAX_DUNNING_RETRY_ATTEMPTS,
  SUBSCRIPTION_STATUS,
} from "../dunning";

describe('Executor Concurrency & Recovery Logic', () => {
  it('should calculate stale lock recovery threshold (5 minutes ago)', () => {
    const now = 1000000000000;
    const threshold = new Date(now - STALE_LOCK_TIMEOUT_MS);
    expect(threshold.getTime()).toBe(now - 300000);
  });

  it("should identify due billing timestamp correctly", () => {
    const nextBillingTime = 1700000000;
    const currentTime = 1700000005;
    expect(nextBillingTime <= currentTime).toBe(true);
  });

  it('should recover stale locks that have NO pending transactions', async () => {
    const mockDb: any = {
      subscription: {
        findMany: vi.fn().mockResolvedValue([
          { subscriber: 'sub_1', planId: 1, status: 2 }
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      },
      billingAttempt: {
        findFirst: vi.fn().mockResolvedValue(null) // No pending attempt
      }
    };

    const count = await recoverStaleLocks(mockDb);
    expect(count).toBe(1);
    expect(mockDb.subscription.updateMany).toHaveBeenCalledWith({
      where: { subscriber: 'sub_1', planId: 1, status: 2 },
      data: { status: 1, lockedAt: null }
    });
  });

  it('should PRESERVE lock if an unresolved PENDING transaction exists', async () => {
    const mockDb: any = {
      subscription: {
        findMany: vi.fn().mockResolvedValue([
          { subscriber: 'sub_pending', planId: 1, status: 2 }
        ]),
        updateMany: vi.fn()
      },
      billingAttempt: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'attempt-1',
          status: 'PENDING',
          txHash: '0xabc'
        })
      }
    };

    const count = await recoverStaleLocks(mockDb);
    expect(count).toBe(0);
    // updateMany must NOT be called, preserving the lock
    expect(mockDb.subscription.updateMany).not.toHaveBeenCalled();
  });
});

describe('Uncertain-Transaction Reconciliation', () => {
  it('should reconcile PENDING transaction to SUCCESS when confirmed on-chain', async () => {
    const mockDb: any = {
      billingAttempt: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'attempt-1', subscriber: 'sub_1', planId: 1, status: 'PENDING', txHash: 'hash-123' }
        ]),
        update: vi.fn().mockResolvedValue({})
      },
      subscription: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };

    const mockSdk: any = {
      server: {
        getTransaction: vi.fn().mockResolvedValue({ status: 'SUCCESS' })
      },
      getSubscription: vi.fn().mockResolvedValue({
        next_billing_time: 1800000000
      })
    };

    const count = await reconcilePendingTransactions(mockDb, mockSdk);
    expect(count).toBe(1);
    expect(mockDb.billingAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: { status: 'SUCCESS' }
    });
    expect(mockDb.subscription.updateMany).toHaveBeenCalledWith({
      where: { subscriber: 'sub_1', planId: 1 },
      data: expect.objectContaining({
        status: 1,
        nextBillingTime: 1800000000,
        lockedAt: null
      })
    });
  });

  it('should reconcile PENDING transaction to FAILED and release lock when failed on-chain', async () => {
    const mockDb: any = {
      billingAttempt: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'attempt-2', subscriber: 'sub_failed', planId: 1, status: 'PENDING', txHash: 'hash-fail' }
        ]),
        update: vi.fn().mockResolvedValue({})
      },
      subscription: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };

    const mockSdk: any = {
      server: {
        getTransaction: vi.fn().mockResolvedValue({ status: 'FAILED', resultXdr: 'AAAA...' })
      }
    };

    const count = await reconcilePendingTransactions(mockDb, mockSdk);
    expect(count).toBe(1);
    expect(mockDb.billingAttempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-2' },
      data: expect.objectContaining({
        status: 'FAILED'
      })
    });
    expect(mockDb.subscription.updateMany).toHaveBeenCalledWith({
      where: { subscriber: 'sub_failed', planId: 1 },
      data: { status: 1, lockedAt: null }
    });
  });

  it('should tolerate RPC network timeout during reconciliation without crashing', async () => {
    const mockDb: any = {
      billingAttempt: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'attempt-3', subscriber: 'sub_3', planId: 1, status: 'PENDING', txHash: 'hash-timeout' }
        ]),
        update: vi.fn()
      }
    };

    const mockSdk: any = {
      server: {
        getTransaction: vi.fn().mockRejectedValue(new Error('Network drop 504'))
      }
    };

    const count = await reconcilePendingTransactions(mockDb, mockSdk);
    expect(count).toBe(0);
    expect(mockDb.billingAttempt.update).not.toHaveBeenCalled();
  });
});

describe('Authoritative On-Chain State & Concurrency Protection', () => {
  it('should prevent duplicate submission when indexer is delayed but contract state shows already billed', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockDb: any = {
      subscription: {
        findMany: vi.fn().mockResolvedValue([
          { subscriber: 'sub_billed_ahead', planId: 1, nextBillingTime: now - 100, status: 1 }
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };

    const mockSdk: any = {
      // Authoritative on-chain subscription shows next billing time is in the future
      getSubscription: vi.fn().mockResolvedValue({
        next_billing_time: now + 2592000,
        status: 'Active'
      }),
      executeBilling: vi.fn(),
      server: {
        getAccount: vi.fn()
      }
    };

    const mockSigner: any = {
      publicKey: () => 'GBOWTBFBE5DFOLVESCOQDJERT2K7BAGNOZACMYS3FIA62IXOOGS4SJQU'
    };

    const count = await pollAndExecute(mockDb, mockSdk, mockSigner);
    expect(count).toBe(0);
    // Must NOT call executeBilling
    expect(mockSdk.executeBilling).not.toHaveBeenCalled();
    // Must update DB nextBillingTime to match chain state and release lock
    expect(mockDb.subscription.updateMany).toHaveBeenCalledWith({
      where: { subscriber: 'sub_billed_ahead', planId: 1 },
      data: {
        status: 1,
        nextBillingTime: now + 2592000,
        lockedAt: null
      }
    });
  });

  it('should safely skip subscription when claimed by concurrent worker (optimistic concurrency)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const mockDb: any = {
      subscription: {
        findMany: vi.fn().mockResolvedValue([
          { subscriber: 'sub_concurrent', planId: 1, nextBillingTime: now - 50, status: 1 }
        ]),
        // updateMany returns count: 0 (another worker locked it first)
        updateMany: vi.fn().mockResolvedValue({ count: 0 })
      }
    };

    const mockSdk: any = {
      getSubscription: vi.fn()
    };

    const count = await pollAndExecute(mockDb, mockSdk, null);
    expect(count).toBe(0);
    expect(mockSdk.getSubscription).not.toHaveBeenCalled();
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

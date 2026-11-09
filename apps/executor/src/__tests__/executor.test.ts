import { describe, it, expect, vi } from 'vitest';
import {
  reconcilePendingTransactions,
  recoverStaleLocks,
  pollAndExecute,
  waitForTransactionConfirmation,
  STALE_LOCK_TIMEOUT_MS
} from '../index';

describe('Executor Concurrency & Recovery Logic', () => {
  it('should calculate stale lock recovery threshold (5 minutes ago)', () => {
    const now = 1000000000000;
    const threshold = new Date(now - STALE_LOCK_TIMEOUT_MS);
    expect(threshold.getTime()).toBe(now - 300000);
  });

  it('should identify due billing timestamp correctly', () => {
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

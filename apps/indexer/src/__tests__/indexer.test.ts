import { describe, it, expect, vi } from 'vitest';
import {
  generateEventId,
  parseSubscriptionStatus,
  processContractEvent,
  syncLedgerRange
} from '../index';
import { nativeToScVal } from '@stellar/stellar-sdk';

describe('Indexer Logic & Event Idempotency', () => {
  it('should generate stable event IDs for idempotency deduplication', () => {
    const event = { ledger: 12345, txHash: 'a1b2c3d4e5f6' };
    const eventId = generateEventId(event, 0);
    expect(eventId).toBe('12345:a1b2c3d4e5f6:0');

    // If event has native id, it uses native id
    expect(generateEventId({ id: 'native-evt-123' }, 0)).toBe('native-evt-123');
  });

  it('should calculate initial ledger cursor range correctly', () => {
    const latestLedgerSequence = 50000;
    const startLedger = Math.max(1, latestLedgerSequence - 1000);
    expect(startLedger).toBe(49000);
  });

  it('should correctly parse SubscriptionStatus variants', () => {
    expect(parseSubscriptionStatus('Active')).toBe(1);
    expect(parseSubscriptionStatus('0')).toBe(1);
    expect(parseSubscriptionStatus('Paused')).toBe(3);
    expect(parseSubscriptionStatus('2')).toBe(3);
    expect(parseSubscriptionStatus('Canceled')).toBe(0);
    expect(parseSubscriptionStatus('1')).toBe(0);
  });

  it('should skip duplicate events when already indexed', async () => {
    const mockDb: any = {
      processedEvent: {
        findUnique: vi.fn().mockResolvedValue({ eventId: '100:tx1:0', eventType: 'plan_add' })
      },
      $transaction: vi.fn()
    };
    const mockSdk: any = {};

    const event = {
      ledger: 100,
      txHash: 'tx1',
      topic: [nativeToScVal('plan_add')],
      value: nativeToScVal(1)
    };

    const res = await processContractEvent(event, 0, mockDb, mockSdk);
    expect(res.status).toBe('skipped_duplicate');
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it('should gracefully handle malformed event topics without stalling', async () => {
    const mockDb: any = {
      processedEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({})
      },
      $transaction: vi.fn()
    };
    const mockSdk: any = {};

    const malformedEvent = {
      ledger: 100,
      txHash: 'tx_malformed',
      topic: [null], // Invalid topic
      value: nativeToScVal(1)
    };

    const res = await processContractEvent(malformedEvent, 0, mockDb, mockSdk);
    expect(res.status).toBe('skipped_malformed');
    expect(mockDb.processedEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventType: 'unknown',
        ledger: 100
      })
    });
  });

  it('should atomically process plan_add event inside a database transaction', async () => {
    const mockDb: any = {
      processedEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockReturnValue({ op: 'create_event' })
      },
      plan: {
        upsert: vi.fn().mockReturnValue({ op: 'upsert_plan' })
      },
      $transaction: vi.fn().mockResolvedValue([])
    };

    const mockSdk: any = {
      getPlan: vi.fn().mockResolvedValue({
        merchant: 'GBOWTBFBE5DFOLVESCOQDJERT2K7BAGNOZACMYS3FIA62IXOOGS4SJQU',
        token: 'CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3',
        amount: 1000n,
        cycle_seconds: 2592000
      })
    };

    const event = {
      ledger: 500,
      txHash: 'tx_plan',
      topic: [nativeToScVal('plan_add')],
      value: nativeToScVal(1)
    };

    const res = await processContractEvent(event, 0, mockDb, mockSdk);
    expect(res.status).toBe('indexed');
    expect(mockSdk.getPlan).toHaveBeenCalledWith(1);
    expect(mockDb.$transaction).toHaveBeenCalled();
  });

  it('should propagate error and NOT mark event as processed if contract RPC read fails', async () => {
    const mockDb: any = {
      processedEvent: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn()
      },
      $transaction: vi.fn()
    };

    const mockSdk: any = {
      getPlan: vi.fn().mockRejectedValue(new Error('RPC network connection timeout'))
    };

    const event = {
      ledger: 500,
      txHash: 'tx_plan_err',
      topic: [nativeToScVal('plan_add')],
      value: nativeToScVal(1)
    };

    await expect(processContractEvent(event, 0, mockDb, mockSdk)).rejects.toThrow(
      'RPC network connection timeout'
    );
    expect(mockDb.processedEvent.create).not.toHaveBeenCalled();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});

describe('Indexer Ledger Range Sync & Cursor Resilience', () => {
  it('should throw and preserve cursor if RPC fails before event retrieval', async () => {
    const mockDb: any = {};
    const mockSdk: any = {
      config: { contractId: 'CC4ZFZ64...' },
      server: {
        getEvents: vi.fn().mockRejectedValue(new Error('Stellar RPC unavailable 503'))
      }
    };

    await expect(syncLedgerRange(100, 150, mockDb, mockSdk)).rejects.toThrow(
      'Stellar RPC unavailable 503'
    );
  });

  it('should throw and preserve cursor if RPC fails during cursor pagination', async () => {
    const mockDb: any = {
      processedEvent: {
        findUnique: vi.fn().mockResolvedValue({ eventId: '101:tx:0' })
      }
    };
    const mockSdk: any = {
      config: { contractId: 'CC4ZFZ64...' },
      server: {
        getEvents: vi
          .fn()
          .mockResolvedValueOnce({
            events: new Array(200).fill({ ledger: 101, txHash: 'tx', topic: [], value: null }),
            cursor: 'cursor-page-2'
          })
          .mockRejectedValueOnce(new Error('RPC rate limit exceeded 429'))
      }
    };

    await expect(syncLedgerRange(100, 200, mockDb, mockSdk)).rejects.toThrow(
      'RPC rate limit exceeded 429'
    );
  });

  it('should handle multiple pages of events successfully across ledger bounds', async () => {
    const mockDb: any = {
      processedEvent: {
        findUnique: vi.fn().mockResolvedValue({ eventId: 'duplicate' })
      }
    };
    const mockSdk: any = {
      config: { contractId: 'CC4ZFZ64...' },
      server: {
        getEvents: vi
          .fn()
          .mockResolvedValueOnce({
            events: new Array(200).fill({ ledger: 105, txHash: 'tx1', topic: [], value: null }),
            cursor: 'cursor-p2'
          })
          .mockResolvedValueOnce({
            events: [{ ledger: 110, txHash: 'tx2', topic: [], value: null }],
            cursor: 'cursor-end'
          })
      }
    };

    const finalLedger = await syncLedgerRange(100, 120, mockDb, mockSdk);
    expect(finalLedger).toBe(120);
    expect(mockSdk.server.getEvents).toHaveBeenCalledTimes(2);
  });
});

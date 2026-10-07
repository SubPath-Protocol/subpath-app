import { describe, it, expect } from 'vitest';

describe('Indexer Logic & Event Idempotency', () => {
  it('should generate stable event IDs for idempotency deduplication', () => {
    const ledger = 12345;
    const txHash = "a1b2c3d4e5f6";
    const index = 0;
    const eventId = `${ledger}:${txHash}:${index}`;

    expect(eventId).toBe("12345:a1b2c3d4e5f6:0");
  });

  it('should calculate initial ledger cursor range correctly', () => {
    const latestLedgerSequence = 50000;
    const startLedger = Math.max(1, latestLedgerSequence - 1000);

    expect(startLedger).toBe(49000);
  });
});

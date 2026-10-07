import { describe, it, expect } from 'vitest';
import { SubPathClient } from '../client';

describe('SubPathClient Operations & Validations', () => {
  const client = new SubPathClient({
    contractId: "CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015"
  });

  const dummyMerchant = "GBOWTBFBE5DFOLVESCOQDJERT2K7BAGNOZACMYS3FIA62IXOOGS4SJQU";
  const dummyToken = "CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3";
  const dummySubscriber = "GBOWTBFBE5DFOLVESCOQDJERT2K7BAGNOZACMYS3FIA62IXOOGS4SJQU";

  it('should construct createPlan operation correctly', () => {
    const op = client.createPlan(dummyMerchant, dummyToken, 10000000n, 2592000);
    expect(op).toBeDefined();
    expect(op.body).toBeDefined();
  });

  it('should construct subscribe operation correctly', () => {
    const op = client.subscribe(dummySubscriber, 1);
    expect(op).toBeDefined();
    expect(op.body).toBeDefined();
  });

  it('should construct pauseSubscription operation correctly', () => {
    const op = client.pauseSubscription(dummySubscriber, 1);
    expect(op).toBeDefined();
    expect(op.body).toBeDefined();
  });

  it('should construct resumeSubscription operation correctly', () => {
    const op = client.resumeSubscription(dummySubscriber, 1);
    expect(op).toBeDefined();
    expect(op.body).toBeDefined();
  });

  it('should construct cancelSubscription operation correctly', () => {
    const op = client.cancelSubscription(dummySubscriber, 1);
    expect(op).toBeDefined();
    expect(op.body).toBeDefined();
  });

  it('should construct executeBilling operation correctly with permissionless signature', () => {
    const op = client.executeBilling(dummySubscriber, 1);
    expect(op).toBeDefined();
    expect(op.body).toBeDefined();
  });
});

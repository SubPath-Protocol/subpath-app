import { describe, it, expect } from 'vitest';
import { ConfigBuilder } from '../config';

describe('ConfigBuilder', () => {
  it('should initialize with testnet defaults', () => {
    const config = new ConfigBuilder("CD32ACJSW2FPYWXHLUT5YUAIZNQPIYU7A66QZP5RCC2IGRBU64DDQXYF").build();
    expect(config.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(config.contractId).toBe('CD32ACJSW2FPYWXHLUT5YUAIZNQPIYU7A66QZP5RCC2IGRBU64DDQXYF');
  });

  it('should allow overriding rpc and passphrase', () => {
    const config = new ConfigBuilder("CD123")
      .setRpcUrl("https://localhost:8000")
      .setNetworkPassphrase("Standalone Network ; February 2017")
      .build();
      
    expect(config.rpcUrl).toBe('https://localhost:8000');
    expect(config.networkPassphrase).toBe('Standalone Network ; February 2017');
    expect(config.contractId).toBe('CD123');
  });

  it('should parse valid testnet network strings correctly', () => {
    const config = new ConfigBuilder("CD123").setNetwork("TESTNET").build();
    expect(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
    expect(config.rpcUrl).toBe('https://soroban-testnet.stellar.org');
  });

  it('should parse valid mainnet network strings correctly', () => {
    const config = new ConfigBuilder("CD123").setNetwork("MAINNET").build();
    expect(config.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    expect(config.rpcUrl).toBe('https://soroban-rpc.stellar.org');
  });
});

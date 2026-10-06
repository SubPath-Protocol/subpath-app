export interface SubPathConfig {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

export class ConfigBuilder {
  private config: SubPathConfig;

  constructor(contractId: string) {
    this.config = {
      contractId,
      rpcUrl: 'https://soroban-testnet.stellar.org',
      networkPassphrase: 'Test SDF Network ; September 2015'
    };
  }

  setRpcUrl(url: string): this {
    this.config.rpcUrl = url;
    return this;
  }

  setNetworkPassphrase(passphrase: string): this {
    this.config.networkPassphrase = passphrase;
    return this;
  }

  setNetwork(network: 'TESTNET' | 'MAINNET' | string): this {
    if (network === 'MAINNET') {
      this.config.rpcUrl = 'https://soroban-rpc.stellar.org';
      this.config.networkPassphrase = 'Public Global Stellar Network ; September 2015';
    } else if (network === 'TESTNET') {
      this.config.rpcUrl = 'https://soroban-testnet.stellar.org';
      this.config.networkPassphrase = 'Test SDF Network ; September 2015';
    }
    return this;
  }

  build(): SubPathConfig {
    return this.config;
  }
}

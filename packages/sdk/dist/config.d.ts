export interface SubPathConfig {
    contractId: string;
    rpcUrl: string;
    networkPassphrase: string;
}
export declare class ConfigBuilder {
    private config;
    constructor(contractId: string);
    setRpcUrl(url: string): this;
    setNetworkPassphrase(passphrase: string): this;
    setNetwork(network: 'TESTNET' | 'MAINNET' | string): this;
    build(): SubPathConfig;
}

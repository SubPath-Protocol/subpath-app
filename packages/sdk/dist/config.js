"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigBuilder = void 0;
class ConfigBuilder {
    config;
    constructor(contractId) {
        this.config = {
            contractId,
            rpcUrl: 'https://soroban-testnet.stellar.org',
            networkPassphrase: 'Test SDF Network ; September 2015'
        };
    }
    setRpcUrl(url) {
        this.config.rpcUrl = url;
        return this;
    }
    setNetworkPassphrase(passphrase) {
        this.config.networkPassphrase = passphrase;
        return this;
    }
    setNetwork(network) {
        if (network === 'MAINNET') {
            this.config.rpcUrl = 'https://soroban-rpc.stellar.org';
            this.config.networkPassphrase = 'Public Global Stellar Network ; September 2015';
        }
        else if (network === 'TESTNET') {
            this.config.rpcUrl = 'https://soroban-testnet.stellar.org';
            this.config.networkPassphrase = 'Test SDF Network ; September 2015';
        }
        return this;
    }
    build() {
        return this.config;
    }
}
exports.ConfigBuilder = ConfigBuilder;

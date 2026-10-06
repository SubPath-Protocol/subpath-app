"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const config_1 = require("../config");
(0, vitest_1.describe)('ConfigBuilder', () => {
    (0, vitest_1.it)('should initialize with testnet defaults', () => {
        const config = new config_1.ConfigBuilder("CD32ACJSW2FPYWXHLUT5YUAIZNQPIYU7A66QZP5RCC2IGRBU64DDQXYF").build();
        (0, vitest_1.expect)(config.rpcUrl).toBe('https://soroban-testnet.stellar.org');
        (0, vitest_1.expect)(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
        (0, vitest_1.expect)(config.contractId).toBe('CD32ACJSW2FPYWXHLUT5YUAIZNQPIYU7A66QZP5RCC2IGRBU64DDQXYF');
    });
    (0, vitest_1.it)('should allow overriding rpc and passphrase', () => {
        const config = new config_1.ConfigBuilder("CD123")
            .setRpcUrl("https://localhost:8000")
            .setNetworkPassphrase("Standalone Network ; February 2017")
            .build();
        (0, vitest_1.expect)(config.rpcUrl).toBe('https://localhost:8000');
        (0, vitest_1.expect)(config.networkPassphrase).toBe('Standalone Network ; February 2017');
        (0, vitest_1.expect)(config.contractId).toBe('CD123');
    });
    (0, vitest_1.it)('should parse valid testnet network strings correctly', () => {
        const config = new config_1.ConfigBuilder("CD123").setNetwork("TESTNET").build();
        (0, vitest_1.expect)(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
        (0, vitest_1.expect)(config.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    });
    (0, vitest_1.it)('should parse valid mainnet network strings correctly', () => {
        const config = new config_1.ConfigBuilder("CD123").setNetwork("MAINNET").build();
        (0, vitest_1.expect)(config.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
        (0, vitest_1.expect)(config.rpcUrl).toBe('https://soroban-rpc.stellar.org');
    });
});

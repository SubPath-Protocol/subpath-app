import { SubPathClient } from "@subpath/sdk";

export const getClient = () => {
  return new SubPathClient({
    contractId: process.env.NEXT_PUBLIC_SUBPATH_CONTRACT_ID || "missing-contract",
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
    networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE || "Test SDF Network ; September 2015"
  });
};

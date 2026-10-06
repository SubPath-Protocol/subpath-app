"use client";

import { useWallet } from "../contexts/WalletContext";

export function ConnectWalletButton() {
  const { address, isConnecting, connect, disconnect } = useWallet();

  if (address) {
    const shortAddress = `${address.slice(0, 5)}...${address.slice(-4)}`;
    return (
      <button 
        onClick={disconnect}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors inline-flex items-center"
        title="Click to disconnect"
      >
        {shortAddress}
      </button>
    );
  }

  return (
    <button 
      onClick={connect}
      disabled={isConnecting}
      className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 transition-colors shadow-lg shadow-white/20 inline-flex items-center disabled:opacity-50"
    >
      {isConnecting ? "Connecting..." : "Connect Wallet"}
    </button>
  );
}

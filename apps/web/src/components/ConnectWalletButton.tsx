"use client";

import { useWallet } from "../contexts/WalletContext";

export function ConnectWalletButton() {
  const { address, selectedWallet, isConnecting, connect, disconnect } = useWallet();

  if (address) {
    const shortAddress = `${address.slice(0, 5)}...${address.slice(-4)}`;
    return (
      <button 
        onClick={disconnect}
        className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/20 transition-colors inline-flex items-center gap-2 border border-white/10"
        title="Click to disconnect"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span>{shortAddress}</span>
        {selectedWallet && (
          <span className="text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-mono">
            {selectedWallet}
          </span>
        )}
      </button>
    );
  }

  return (
    <button 
      onClick={connect}
      disabled={isConnecting}
      className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-black hover:bg-gray-200 transition-colors shadow-lg shadow-white/20 inline-flex items-center gap-2 disabled:opacity-50"
    >
      {isConnecting ? (
        <>
          <span className="w-2 h-2 rounded-full bg-black/60 animate-ping"></span>
          <span>Connecting...</span>
        </>
      ) : (
        "Connect Wallet"
      )}
    </button>
  );
}

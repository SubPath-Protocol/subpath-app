"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { isConnected, getAddress, getNetwork, signTransaction } from "@stellar/freighter-api";

interface WalletState {
  address: string | null;
  network: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signAndSubmit: (xdr: string) => Promise<string | null>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("subpath_wallet");
    if (stored) {
      checkConnection();
    }
  }, []);

  const checkConnection = async () => {
    try {
      const connected = await isConnected();
      if (connected) {
        const { address: pubKey } = await getAddress();
        const { network: net } = await getNetwork();
        setAddress(pubKey || null);
        setNetwork(net || null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const connect = async () => {
    try {
      setIsConnecting(true);
      const connected = await isConnected();
      if (!connected) {
        alert("Freighter is not installed or not available. Please install it.");
        setIsConnecting(false);
        return;
      }

      const { address: pubKey } = await getAddress();
      if (pubKey) {
        const { network: net } = await getNetwork();
        
        const expectedNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() || "TESTNET";
        if (net && net.toUpperCase() !== expectedNetwork) {
          alert(`Please switch your Freighter wallet to ${expectedNetwork}. Currently on ${net}.`);
        }

        setAddress(pubKey);
        setNetwork(net || null);
        localStorage.setItem("subpath_wallet", "true");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to connect wallet or user rejected the request.");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setNetwork(null);
    localStorage.removeItem("subpath_wallet");
  };

  const signAndSubmit = async (xdr: string): Promise<string | null> => {
    try {
      const { signedTxXdr } = await signTransaction(xdr, { networkPassphrase: process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE || "Test SDF Network ; September 2015" });
      if (!signedTxXdr) {
        alert("Transaction signing was rejected.");
        return null;
      }
      return signedTxXdr; 
    } catch (e) {
      console.error(e);
      alert("Error signing transaction.");
      return null;
    }
  };

  return (
    <WalletContext.Provider value={{ address, network, isConnecting, connect, disconnect, signAndSubmit }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within WalletProvider");
  return context;
};

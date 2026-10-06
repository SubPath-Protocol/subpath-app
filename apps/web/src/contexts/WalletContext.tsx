"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { isConnected, getPublicKey, getNetwork, signTransaction } from "@stellar/freighter-api";

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
        const pubKey = await getPublicKey();
        const net = await getNetwork();
        setAddress(pubKey);
        setNetwork(net);
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

      const pubKey = await getPublicKey();
      if (pubKey) {
        const net = await getNetwork();
        
        const expectedNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() || "TESTNET";
        if (net.toUpperCase() !== expectedNetwork) {
          alert(`Please switch your Freighter wallet to ${expectedNetwork}. Currently on ${net}.`);
        }

        setAddress(pubKey);
        setNetwork(net);
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
      const signedXdr = await signTransaction(xdr, { network: process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() || "TESTNET" });
      if (!signedXdr) {
        alert("Transaction signing was rejected.");
        return null;
      }
      return signedXdr as string; 
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

"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import {
  StellarWalletsKit,
  Networks,
  KitEventType,
  SwkAppDarkTheme,
} from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";
import { HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";

interface WalletState {
  address: string | null;
  network: string | null;
  selectedWallet: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  signAndSubmit: (xdr: string) => Promise<string | null>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || isInitialized.current) return;
    isInitialized.current = true;

    const targetNetwork =
      process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() === "PUBLIC"
        ? Networks.PUBLIC
        : Networks.TESTNET;

    const modules = [
      new FreighterModule(),
      new AlbedoModule(),
      new xBullModule(),
      new LobstrModule(),
      new RabetModule(),
      new HanaModule(),
    ];

    StellarWalletsKit.init({
      modules,
      network: targetNetwork,
      theme: SwkAppDarkTheme,
      authModal: {
        showInstallLabel: true,
        hideUnsupportedWallets: false,
      },
    });

    // Check if an address was previously active
    void StellarWalletsKit.getAddress()
      .then((res) => {
        if (res.address) {
          setAddress(res.address);
          setNetwork(process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet");
        }
      })
      .catch(() => {
        // No previously active address
      });

    const unsubDisconnect = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      setAddress(null);
      setSelectedWallet(null);
    });

    const unsubState = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (evt) => {
      if (evt.payload.address) {
        setAddress(evt.payload.address);
      }
    });

    const unsubWallet = StellarWalletsKit.on(KitEventType.WALLET_SELECTED, (evt) => {
      if (evt.payload.id) {
        setSelectedWallet(evt.payload.id);
      }
    });

    return () => {
      if (typeof unsubDisconnect === "function") unsubDisconnect();
      if (typeof unsubState === "function") unsubState();
      if (typeof unsubWallet === "function") unsubWallet();
    };
  }, []);

  const connect = async () => {
    try {
      setIsConnecting(true);
      const res = await StellarWalletsKit.authModal();
      if (res && res.address) {
        setAddress(res.address);
        setNetwork(process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet");
      }
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      if (err?.code === -1) {
        console.log("Wallet selection modal closed.");
      } else {
        console.error("Wallet connection error:", e);
        alert(err?.message || "Failed to connect wallet.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await StellarWalletsKit.disconnect();
    } catch (e) {
      console.error("Disconnect error:", e);
    } finally {
      setAddress(null);
      setNetwork(null);
      setSelectedWallet(null);
    }
  };

  const signAndSubmit = async (xdr: string): Promise<string | null> => {
    try {
      const passphrase =
        process.env.NEXT_PUBLIC_STELLAR_PASSPHRASE ||
        (process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toUpperCase() === "PUBLIC"
          ? Networks.PUBLIC
          : Networks.TESTNET);

      const res = await StellarWalletsKit.signTransaction(xdr, {
        networkPassphrase: passphrase,
        address: address || undefined,
      });

      if (!res || !res.signedTxXdr) {
        alert("Transaction signing was rejected.");
        return null;
      }
      return res.signedTxXdr;
    } catch (e: unknown) {
      console.error("Transaction signing error:", e);
      const err = e as { message?: string };
      alert(err?.message || "Error signing transaction.");
      return null;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        network,
        selectedWallet,
        isConnecting,
        connect,
        disconnect,
        signAndSubmit,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used within WalletProvider");
  return context;
};

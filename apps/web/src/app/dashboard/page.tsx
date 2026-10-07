"use client";

import React, { useState, useEffect, useCallback, FormEvent } from "react";
import { useWallet } from "../../contexts/WalletContext";
import { getClient } from "../../lib/sdk";
import { nativeToScVal, scValToNative, TransactionBuilder, Account } from "@stellar/stellar-sdk";

interface PlanItem {
  id: number;
  merchant: string;
  token: string;
  amount: bigint;
  cycle_seconds: number;
}

export default function DashboardPage() {
  const { address, signAndSubmit } = useWallet();
  const [isCreating, setIsCreating] = useState(false);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState("2592000");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPlans = useCallback(async () => {
    if (!address) {
      setPlans([]);
      return;
    }
    setLoadingPlans(true);
    try {
      const client = getClient();
      const latestLedger = await client.server.getLatestLedger();
      const startLedger = Math.max(1, latestLedger.sequence - 50000);

      const res = await client.server.getEvents({
        startLedger,
        filters: [
          {
            type: "contract",
            contractIds: [client.config.contractId],
            topics: [
              [nativeToScVal("plan_add", { type: "symbol" }).toXDR("base64")],
              [nativeToScVal(address, { type: "address" }).toXDR("base64")]
            ]
          }
        ],
        limit: 100
      });

      const fetchedPlans: PlanItem[] = [];
      for (const record of res.events || []) {
        const planId = Number(scValToNative(record.value));
        
        const planState = await client.getPlan(planId);
        if (planState) {
          fetchedPlans.push({ id: planId, ...planState });
        }
      }
      setPlans(fetchedPlans);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPlans(false);
    }
  }, [address]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadPlans();
  }, [loadPlans]);

  const handleCreatePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!address) return alert("Connect wallet first!");
    
    setIsSubmitting(true);
    try {
      const client = getClient();
      const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 10000000));
      
      const op = client.createPlan(address, tokenAddress, amountBigInt, parseInt(cycle));
      
      const accountData = await client.server.getAccount(address);
      const realSource = new Account(address, accountData.sequenceNumber());

      const tx = new TransactionBuilder(realSource, {
        fee: "10000",
        networkPassphrase: client.config.networkPassphrase,
      })
      .addOperation(op)
      .setTimeout(100)
      .build();

      const preparedTx = await client.server.prepareTransaction(tx);
      const signedXdr = await signAndSubmit(preparedTx.toXDR());
      if (signedXdr) {
        const txSubmit = TransactionBuilder.fromXDR(signedXdr, client.config.networkPassphrase);
        const resp = await client.server.sendTransaction(txSubmit);
        if (resp.status === "ERROR") {
          throw new Error(`Transaction rejected by network: ${resp.errorResult?.toXDR("base64") || "Simulation/validation error"}`);
        }
        
        // Poll for confirmation
        let status: string = resp.status;
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const txStatus = await client.server.getTransaction(resp.hash);
          status = txStatus.status;
          if (status !== "NOT_FOUND") break;
        }

        if (status === "SUCCESS") {
          alert("Plan created successfully on-chain!");
        } else if (status === "FAILED") {
          throw new Error("Transaction execution failed on-chain.");
        } else {
          alert(`Transaction submitted (hash: ${resp.hash.substring(0, 8)}...). Waiting for ledger confirmation.`);
        }

        setIsCreating(false);
        setTimeout(() => loadPlans(), 4000);
      }
    } catch (e: unknown) {
      const err = e as Error;
      alert("Error: " + (err.message || String(e)));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center pt-20">
        <h2 className="text-2xl font-bold mb-4">Connect Wallet to View Dashboard</h2>
        <p className="text-gray-400">You must be connected to manage plans.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold mb-2">Merchant Dashboard</h1>
          <p className="text-gray-400">Manage your subscription plans.</p>
        </div>
        <button 
          onClick={() => setIsCreating(!isCreating)}
          className="px-5 py-2.5 rounded-lg font-semibold bg-white text-black hover:bg-gray-200 transition-colors shadow-lg shadow-white/10"
        >
          {isCreating ? "Cancel" : "+ Create Plan"}
        </button>
      </div>

      {isCreating && (
        <div className="glass-panel p-6 mb-12 border border-indigo-500/30">
          <h3 className="text-xl font-bold mb-4">Create New Plan</h3>
          <form onSubmit={handleCreatePlan} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Token Address (e.g. USDC Contract ID)</label>
              <input required type="text" value={tokenAddress} onChange={e => setTokenAddress(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount (Raw Tokens)</label>
              <input required type="number" step="any" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cycle Duration</label>
              <select value={cycle} onChange={e => setCycle(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-2 text-white">
                <option value="10">10 Seconds (Testnet Demo)</option>
                <option value="60">1 Minute (Testnet Demo)</option>
                <option value="3600">Hourly</option>
                <option value="86400">Daily</option>
                <option value="604800">Weekly</option>
                <option value="2592000">Monthly</option>
                <option value="31536000">Yearly</option>
              </select>
            </div>
            <button disabled={isSubmitting} type="submit" className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
              {isSubmitting ? "Creating..." : "Submit Transaction"}
            </button>
          </form>
        </div>
      )}

      <h3 className="text-xl font-bold mb-6">Your On-Chain Plans</h3>
      {loadingPlans ? (
        <p className="text-gray-400 animate-pulse">Loading from ledger...</p>
      ) : plans.length === 0 ? (
        <p className="text-gray-400">No plans found. Create one to get started.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="glass-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/5 transition-colors group">
              <div className="flex items-center gap-4 mb-4 sm:mb-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm shadow-md">
                  #{plan.id}
                </div>
                <div>
                  <h4 className="font-bold">Plan #{plan.id}</h4>
                  <p className="text-sm text-gray-400">Token: {plan.token.substring(0,8)}... | Cycle: {plan.cycle_seconds}s</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{Number(plan.amount) / 10000000} Amount</p>
                </div>
                <a 
                  href={`/plans/${plan.id}`}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                >
                  Public Page →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

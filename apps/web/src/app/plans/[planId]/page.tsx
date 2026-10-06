"use client";

import { useState, useEffect } from "react";
import { useWallet } from "../../../contexts/WalletContext";
import { getClient } from "../../../lib/sdk";
import { TransactionBuilder, Account } from "@stellar/stellar-sdk";

export default function PlanPage({ params }: { params: { planId: string } }) {
  const { address, signAndSubmit, isConnecting, connect } = useWallet();
  const [plan, setPlan] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadData();
  }, [params.planId, address]);

  const loadData = async () => {
    setLoading(true);
    try {
      const client = getClient();
      const planId = parseInt(params.planId);
      const p = await client.getPlan(planId);
      setPlan(p);

      if (address && p) {
        const sub = await client.getSubscription(address, planId);
        setSubscription(sub);
      } else {
        setSubscription(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!address || !plan) return;
    setProcessing(true);
    try {
      const client = getClient();
      
      const latestLedger = await client.server.getLatestLedger();
      const expirationLedger = latestLedger.sequence + 100000; 
      
      const approveOp = client.approveToken(plan.token, address, plan.amount * BigInt(100), expirationLedger); 
      const subOp = client.subscribe(address, parseInt(params.planId));
      
      const accountData = await client.server.getAccount(address);
      const source = new Account(address, accountData.sequenceNumber());

      const tx = new TransactionBuilder(source, {
        fee: "10000",
        networkPassphrase: client.config.networkPassphrase,
      })
      .addOperation(approveOp)
      .addOperation(subOp)
      .setTimeout(100)
      .build();

      const signed = await signAndSubmit(tx.toXDR());
      if (signed) {
        const txSubmit = TransactionBuilder.fromXDR(signed, client.config.networkPassphrase);
        const resp = await client.server.sendTransaction(txSubmit as any);
        if (resp.status === "ERROR") throw new Error("Transaction rejected");
        alert("Subscribed successfully!");
        setTimeout(() => loadData(), 5000);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!address) return;
    setProcessing(true);
    try {
      const client = getClient();
      const op = client.cancelSubscription(address, parseInt(params.planId));
      
      const accountData = await client.server.getAccount(address);
      const source = new Account(address, accountData.sequenceNumber());
      
      const tx = new TransactionBuilder(source, { fee: "1000", networkPassphrase: client.config.networkPassphrase })
      .addOperation(op)
      .setTimeout(100)
      .build();

      const signed = await signAndSubmit(tx.toXDR());
      if (signed) {
        const txSubmit = TransactionBuilder.fromXDR(signed, client.config.networkPassphrase);
        const resp = await client.server.sendTransaction(txSubmit as any);
        if (resp.status === "ERROR") throw new Error("Transaction rejected");
        alert("Subscription canceled!");
        setTimeout(() => loadData(), 5000);
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setProcessing(false);
    }
  };
  
  if (loading) return <div className="pt-20 text-center animate-pulse">Loading plan details...</div>;
  if (!plan) return <div className="pt-20 text-center">Plan not found or network error.</div>;

  return (
    <div className="max-w-2xl mx-auto pt-10 pb-24 animate-in fade-in slide-in-from-bottom-4">
      <div className="glass-panel p-8">
        <h1 className="text-3xl font-black tracking-tight mb-6">Plan #{params.planId}</h1>
        
        <div className="space-y-4 mb-8">
          <div className="flex justify-between border-b border-white/10 pb-4">
            <span className="text-gray-400">Merchant</span>
            <span className="font-mono text-sm">{plan.merchant.substring(0,8)}...{plan.merchant.substring(plan.merchant.length-4)}</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-4">
            <span className="text-gray-400">Token</span>
            <span className="font-mono text-sm">{plan.token.substring(0,8)}...</span>
          </div>
          <div className="flex justify-between border-b border-white/10 pb-4">
            <span className="text-gray-400">Amount</span>
            <span className="font-bold">{Number(plan.amount) / 10000000}</span>
          </div>
          <div className="flex justify-between pb-4">
            <span className="text-gray-400">Cycle Duration</span>
            <span>{plan.cycle_seconds} seconds</span>
          </div>
        </div>

        {!address ? (
          <div className="text-center">
             <button onClick={connect} disabled={isConnecting} className="w-full py-4 rounded-xl font-bold bg-white text-black hover:bg-gray-200 transition-colors">
               {isConnecting ? "Connecting..." : "Connect Wallet to Subscribe"}
             </button>
          </div>
        ) : subscription ? (
          <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-6 text-center">
            <h3 className="text-xl font-bold mb-2">You are subscribed</h3>
            <p className="text-gray-400 mb-6">
              Status: {subscription.status === 0 ? "Active" : "Canceled"}<br/>
              Next Billing: {new Date(subscription.next_billing_time * 1000).toLocaleString()}
            </p>
            {subscription.status === 0 && (
              <button onClick={handleCancel} disabled={processing} className="px-6 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors font-medium">
                {processing ? "Processing..." : "Cancel Subscription"}
              </button>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-sm text-gray-400 mb-4">You will approve an allowance of {Number(plan.amount) * 100 / 10000000} tokens to allow future recurring billing.</p>
            <button onClick={handleSubscribe} disabled={processing} className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/25">
              {processing ? "Processing..." : "Approve & Subscribe"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

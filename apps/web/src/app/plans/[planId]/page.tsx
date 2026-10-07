"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "../../../contexts/WalletContext";
import { getClient } from "../../../lib/sdk";
import { TransactionBuilder, Account } from "@stellar/stellar-sdk";

interface PlanData {
  merchant: string;
  token: string;
  amount: bigint;
  cycle_seconds: number;
}

interface SubscriptionData {
  subscriber: string;
  plan_id: number;
  next_billing_time: number;
  status: number | string;
}

export default function PlanPage() {
  const routeParams = useParams();
  const planIdStr = Array.isArray(routeParams?.planId) ? routeParams.planId[0] : (routeParams?.planId as string) || "";
  const planId = parseInt(planIdStr);

  const { address, signAndSubmit, isConnecting, connect } = useWallet();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const loadData = useCallback(async () => {
    if (isNaN(planId) || planId <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const client = getClient();
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
  }, [planId, address]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const handleSubscribe = async () => {
    if (!address || !plan || isNaN(planId)) return;
    setProcessing(true);
    try {
      const client = getClient();
      
      const latestLedger = await client.server.getLatestLedger();
      const expirationLedger = latestLedger.sequence + 100000; 
      
      // Step 1: Approve token allowance on token contract
      const approveOp = client.approveToken(plan.token, address, plan.amount * BigInt(100), expirationLedger); 
      
      let accountData = await client.server.getAccount(address);
      let source = new Account(address, accountData.sequenceNumber());

      const approveTx = new TransactionBuilder(source, {
        fee: "10000",
        networkPassphrase: client.config.networkPassphrase,
      })
      .addOperation(approveOp)
      .setTimeout(100)
      .build();

      const preparedApproveTx = await client.server.prepareTransaction(approveTx);
      const signedApprove = await signAndSubmit(preparedApproveTx.toXDR());
      if (!signedApprove) {
        throw new Error("Allowance approval was canceled.");
      }

      const txSubmitApprove = TransactionBuilder.fromXDR(signedApprove, client.config.networkPassphrase);
      const respApprove = await client.server.sendTransaction(txSubmitApprove);
      if (respApprove.status === "ERROR") {
        throw new Error(`Allowance rejected: ${respApprove.errorResult?.toXDR("base64") || "Simulation error"}`);
      }

      // Poll until allowance is confirmed
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const txStatus = await client.server.getTransaction(respApprove.hash);
        if (txStatus.status === "SUCCESS") break;
        if (txStatus.status === "FAILED") throw new Error("Allowance transaction failed on-chain.");
      }

      // Step 2: Subscribe to the plan
      const subOp = client.subscribe(address, planId);
      accountData = await client.server.getAccount(address);
      source = new Account(address, accountData.sequenceNumber());

      const subTx = new TransactionBuilder(source, {
        fee: "10000",
        networkPassphrase: client.config.networkPassphrase,
      })
      .addOperation(subOp)
      .setTimeout(100)
      .build();

      const preparedSubTx = await client.server.prepareTransaction(subTx);
      const signedSub = await signAndSubmit(preparedSubTx.toXDR());
      if (!signedSub) {
        throw new Error("Subscription signature was canceled.");
      }

      const txSubmitSub = TransactionBuilder.fromXDR(signedSub, client.config.networkPassphrase);
      const respSub = await client.server.sendTransaction(txSubmitSub);
      if (respSub.status === "ERROR") {
        throw new Error(`Subscription rejected: ${respSub.errorResult?.toXDR("base64") || "Simulation error"}`);
      }

      let subStatus: string = respSub.status;
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const txStatus = await client.server.getTransaction(respSub.hash);
        subStatus = txStatus.status;
        if (subStatus !== "NOT_FOUND") break;
      }

      if (subStatus === "SUCCESS") {
        alert("Subscribed successfully! Your recurring subscription is now active.");
      } else if (subStatus === "FAILED") {
        throw new Error("Subscription execution failed on-chain.");
      } else {
        alert(`Subscription submitted (hash: ${respSub.hash.substring(0, 8)}...).`);
      }

      setTimeout(() => loadData(), 3000);
    } catch (e: unknown) {
      const err = e as Error;
      alert("Error: " + (err.message || String(e)));
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!address) return;
    setProcessing(true);
    try {
      const client = getClient();
      const op = client.cancelSubscription(address, planId);
      
      const accountData = await client.server.getAccount(address);
      const source = new Account(address, accountData.sequenceNumber());
      
      const tx = new TransactionBuilder(source, { fee: "1000", networkPassphrase: client.config.networkPassphrase })
      .addOperation(op)
      .setTimeout(100)
      .build();

      const preparedTx = await client.server.prepareTransaction(tx);
      const signed = await signAndSubmit(preparedTx.toXDR());
      if (signed) {
        const txSubmit = TransactionBuilder.fromXDR(signed, client.config.networkPassphrase);
        const resp = await client.server.sendTransaction(txSubmit);
        if (resp.status === "ERROR") throw new Error(`Transaction rejected by network: ${resp.errorResult?.toXDR("base64") || "Simulation error"}`);
        
        let status: string = resp.status;
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const txStatus = await client.server.getTransaction(resp.hash);
          status = txStatus.status;
          if (status !== "NOT_FOUND") break;
        }

        if (status === "SUCCESS") {
          alert("Subscription canceled!");
        } else if (status === "FAILED") {
          throw new Error("Cancellation execution failed on-chain.");
        } else {
          alert(`Transaction submitted (hash: ${resp.hash.substring(0, 8)}...).`);
        }

        setTimeout(() => loadData(), 4000);
      }
    } catch (e: unknown) {
      const err = e as Error;
      alert("Error: " + (err.message || String(e)));
    } finally {
      setProcessing(false);
    }
  };
  
  if (loading) return <div className="pt-20 text-center animate-pulse">Loading plan details...</div>;
  if (!plan) return <div className="pt-20 text-center">Plan not found or network error.</div>;

  return (
    <div className="max-w-2xl mx-auto pt-10 pb-24 animate-in fade-in slide-in-from-bottom-4">
      <div className="glass-panel p-8">
        <h1 className="text-3xl font-black tracking-tight mb-6">Plan #{planId}</h1>
        
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

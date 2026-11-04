"use client";

import React, { useState, useEffect, useCallback, FormEvent } from "react";
import { useWallet } from "../../contexts/WalletContext";
import { getClient } from "../../lib/sdk";
import { SubscriptionStatus } from "@subpath/sdk";
import { scValToNative, TransactionBuilder, Account } from "@stellar/stellar-sdk";
import { toast } from "sonner";
import { MobileSubscriptionDrawer, DrawerPlanItem } from "../../components/MobileSubscriptionDrawer";
import {
  CreditCard,
  PlusCircle,
  Clock,
  Coins,
  ShieldCheck,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";

interface PlanItem {
  id: number;
  merchant: string;
  token: string;
  amount: bigint;
  cycle_seconds: number;
}

interface ActiveSubscriptionItem {
  planId: number;
  plan: PlanItem;
  status: string;
  nextBillingTime: number;
}

export default function DashboardPage() {
  const { address, signAndSubmit } = useWallet();
  const [activeTab, setActiveTab] = useState<"subscriptions" | "merchant">("subscriptions");
  const [isCreating, setIsCreating] = useState(false);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<ActiveSubscriptionItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [tokenAddress, setTokenAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState("2592000");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drawer state
  const [selectedPlan, setSelectedPlan] = useState<DrawerPlanItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDrawerActionLoading, setIsDrawerActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!address) {
      setPlans([]);
      setSubscriptions([]);
      return;
    }
    setLoading(true);
    try {
      const client = getClient();
      const latestLedger = await client.server.getLatestLedger();
      const startLedger = Math.max(1, latestLedger.sequence - 2000);

      const res = await client.server.getEvents({
        startLedger,
        filters: [
          {
            type: "contract",
            contractIds: [client.config.contractId],
          },
        ],
        limit: 100,
      });

      const fetchedPlans: PlanItem[] = [];
      const seenPlanIds = new Set<number>();

      for (const record of res.events || []) {
        try {
          const sym = scValToNative(record.topic[0]);
          const merchant = scValToNative(record.topic[1]);
          const planId = Number(scValToNative(record.value));

          if (sym === "plan_add" && merchant === address && !seenPlanIds.has(planId)) {
            seenPlanIds.add(planId);
            const planState = await client.getPlan(planId);
            if (planState) {
              fetchedPlans.push({
                id: planId,
                merchant: planState.merchant,
                token: planState.token,
                amount: BigInt(planState.amount),
                cycle_seconds: Number(planState.cycle_seconds),
              });
            }
          }
        } catch (err) {
          console.error("Error parsing event record:", err);
        }
      }

      // Check recent plan IDs directly from contract storage as fallback
      const allKnownPlans: PlanItem[] = [...fetchedPlans];
      for (let id = 1; id <= 10; id++) {
        if (!seenPlanIds.has(id)) {
          try {
            const planState = await client.getPlan(id);
            if (planState) {
              const item: PlanItem = {
                id,
                merchant: planState.merchant,
                token: planState.token,
                amount: BigInt(planState.amount),
                cycle_seconds: Number(planState.cycle_seconds),
              };
              allKnownPlans.push(item);
              if (planState.merchant === address) {
                seenPlanIds.add(id);
                fetchedPlans.push(item);
              }
            }
          } catch {
            // Plan does not exist
          }
        }
      }

      setPlans(fetchedPlans);

      // Load active subscriptions for connected wallet (Subscriber View)
      const fetchedSubs: ActiveSubscriptionItem[] = [];
      for (const p of allKnownPlans) {
        try {
          const sub = await client.getSubscription(address, p.id);
          if (sub) {
            const isCanceled = sub.status === SubscriptionStatus.Canceled;
            const isPaused = sub.status === SubscriptionStatus.Paused;
            const statusLabel = isCanceled ? "Canceled" : isPaused ? "Paused" : "Active";

            if (statusLabel !== "Canceled") {
              fetchedSubs.push({
                planId: p.id,
                plan: p,
                status: statusLabel,
                nextBillingTime: Number(sub.next_billing_time),
              });
            }
          }
        } catch {
          // No subscription for this plan
        }
      }

      setSubscriptions(fetchedSubs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  const handleCreatePlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!address) return toast.error("Connect wallet first!");

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
          throw new Error(
            `Transaction rejected by network: ${resp.errorResult?.toXDR("base64") || "Simulation error"}`
          );
        }

        let status: string = resp.status;
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const txStatus = await client.server.getTransaction(resp.hash);
          status = txStatus.status;
          if (status !== "NOT_FOUND") break;
        }

        if (status === "SUCCESS") {
          toast.success("Plan created successfully on-chain!");
        } else if (status === "FAILED") {
          throw new Error("Transaction execution failed on-chain.");
        } else {
          toast.info(`Transaction submitted: ${resp.hash.substring(0, 8)}...`);
        }

        setIsCreating(false);
        setTimeout(() => loadData(), 4000);
      }
    } catch (e: unknown) {
      const err = e as Error;
      toast.error("Error: " + (err.message || String(e)));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSubscriptionDrawer = (item: ActiveSubscriptionItem) => {
    setSelectedPlan({
      ...item.plan,
      status: item.status,
      next_billing_time: item.nextBillingTime,
    });
    setIsDrawerOpen(true);
  };

  const handleOpenMerchantPlanDrawer = (plan: PlanItem) => {
    setSelectedPlan({
      ...plan,
      status: "Active",
    });
    setIsDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
  };

  const executeSubscriptionOperation = async (
    planId: number,
    operationType: "pause" | "resume" | "cancel"
  ) => {
    if (!address) {
      toast.error("Connect wallet to execute subscription operation");
      return;
    }

    setIsDrawerActionLoading(true);
    try {
      const client = getClient();
      let op;
      let actionLabel = "";

      if (operationType === "pause") {
        op = client.pauseSubscription(address, planId);
        actionLabel = "Pause Subscription";
      } else if (operationType === "resume") {
        op = client.resumeSubscription(address, planId);
        actionLabel = "Resume Subscription";
      } else {
        op = client.cancelSubscription(address, planId);
        actionLabel = "Cancel Subscription";
      }

      toast.info(`Submitting ${actionLabel} on Stellar...`);

      const accountData = await client.server.getAccount(address);
      const source = new Account(address, accountData.sequenceNumber());

      const tx = new TransactionBuilder(source, {
        fee: "1000",
        networkPassphrase: client.config.networkPassphrase,
      })
        .addOperation(op)
        .setTimeout(100)
        .build();

      const preparedTx = await client.server.prepareTransaction(tx);
      const signed = await signAndSubmit(preparedTx.toXDR());

      if (signed) {
        const txSubmit = TransactionBuilder.fromXDR(signed, client.config.networkPassphrase);
        const resp = await client.server.sendTransaction(txSubmit);

        if (resp.status === "ERROR") {
          throw new Error(
            `Transaction error: ${resp.errorResult?.toXDR("base64") || "Simulation failed"}`
          );
        }

        let status: string = resp.status;
        for (let i = 0; i < 15; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          const txStatus = await client.server.getTransaction(resp.hash);
          status = txStatus.status;
          if (status !== "NOT_FOUND") break;
        }

        if (status === "SUCCESS") {
          const nextStatus = operationType === "pause" ? "Paused" : operationType === "resume" ? "Active" : "Canceled";
          toast.success(`${actionLabel} confirmed on-chain!`);
          setSelectedPlan((prev) => (prev ? { ...prev, status: nextStatus } : null));
          setTimeout(() => loadData(), 2000);
        } else {
          toast.info(`Transaction submitted: ${resp.hash.substring(0, 8)}...`);
        }
      }
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(`Transaction note: ${err.message || String(e)}`);
      // Update local state preview
      const fallbackStatus = operationType === "pause" ? "Paused" : operationType === "resume" ? "Active" : "Canceled";
      setSelectedPlan((prev) => (prev ? { ...prev, status: fallbackStatus } : null));
    } finally {
      setIsDrawerActionLoading(false);
    }
  };

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center pt-20">
        <h2 className="text-2xl font-bold mb-4">Connect Wallet to View Dashboard</h2>
        <p className="text-gray-400">You must be connected to manage plans and active subscriptions.</p>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Dashboard Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
            Dashboard
          </h1>
          <p className="text-sm text-gray-400">
            Manage your active subscriptions and merchant billing plans on Stellar Soroban.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-white text-black hover:bg-gray-200 transition-colors shadow-lg shadow-white/10 flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            {isCreating ? "Cancel" : "Create Plan"}
          </button>
        </div>
      </div>

      {/* Segmented View Tabs: Active Subscriptions vs Merchant Plans */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/5 border border-white/10 w-fit mb-8">
        <button
          onClick={() => setActiveTab("subscriptions")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "subscriptions"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Active Subscriptions ({subscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab("merchant")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            activeTab === "merchant"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Merchant Plans ({plans.length})
        </button>
      </div>

      {/* Plan Creator Form */}
      {isCreating && (
        <div className="glass-panel p-6 mb-12 border border-indigo-500/30">
          <h3 className="text-xl font-bold mb-4">Create New Plan</h3>
          <form onSubmit={handleCreatePlan} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Token Address (e.g. USDC Contract ID)</label>
              <input required type="text" value={tokenAddress} onChange={(e) => setTokenAddress(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount (Raw Tokens)</label>
              <input required type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-2 text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cycle Duration</label>
              <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="w-full bg-black/50 border border-gray-700 rounded-lg p-2 text-white">
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

      {/* View 1: Active Subscriptions View (Issue #3) */}
      {activeTab === "subscriptions" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Active Subscriptions View
                <span className="hidden sm:inline-block text-xs font-normal text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                  Mobile Drawer Enabled
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Tap on any active subscription card on mobile or click details to open the management drawer.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-gray-400 animate-pulse py-8">Scanning Stellar ledger for active subscriptions...</p>
          ) : subscriptions.length === 0 ? (
            <div className="glass-panel p-10 text-center border border-white/5 space-y-3">
              <CreditCard className="w-10 h-10 text-gray-500 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-white">No active subscriptions found</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                You haven’t subscribed to any recurring plans yet with this wallet. Browse available merchant plans to get started.
              </p>
              <button
                onClick={() => setActiveTab("merchant")}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Browse Merchant Plans →
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {subscriptions.map((item) => {
                const isSelected = isDrawerOpen && selectedPlan?.id === item.planId;
                const nextDate = item.nextBillingTime
                  ? new Date(item.nextBillingTime * 1000).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Next cycle";

                return (
                  <div
                    key={item.planId}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isSelected}
                    onClick={() => handleOpenSubscriptionDrawer(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenSubscriptionDrawer(item);
                      }
                    }}
                    className={`glass-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/5 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                      isSelected ? "border-indigo-500/50 bg-white/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400 shadow-md">
                        #{item.planId}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h4 className="font-bold text-base text-white">
                            Subscription #{item.planId}
                          </h4>
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              item.status === "Paused"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          Next Billing: <span className="text-gray-300 font-medium">{nextDate}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-0 border-white/10 pt-3 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[11px] text-gray-400 uppercase tracking-wider block">Rate</span>
                        <p className="text-sm font-bold text-white flex items-center gap-1">
                          <Coins className="w-3.5 h-3.5 text-indigo-400" />
                          {Number(item.plan.amount) / 10000000} Tokens
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSubscriptionDrawer(item);
                        }}
                        className="px-4 py-2 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Manage Drawer →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* View 2: Merchant Plans View */}
      {activeTab === "merchant" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Your Created Plans</h2>
          </div>

          {loading ? (
            <p className="text-gray-400 animate-pulse py-8">Loading plans from ledger...</p>
          ) : plans.length === 0 ? (
            <p className="text-gray-400">No plans found. Create one using the button above.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {plans.map((plan) => {
                const isSelected = isDrawerOpen && selectedPlan?.id === plan.id;
                return (
                  <div
                    key={plan.id}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isSelected}
                    onClick={() => handleOpenMerchantPlanDrawer(plan)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenMerchantPlanDrawer(plan);
                      }
                    }}
                    className={`glass-panel p-5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/5 transition-colors group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
                      isSelected ? "border-indigo-500/50 bg-white/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-sm shadow-md">
                        #{plan.id}
                      </div>
                      <div>
                        <h4 className="font-bold flex items-center gap-2">
                          Plan #{plan.id}
                        </h4>
                        <p className="text-xs text-gray-400">
                          Token: {plan.token.substring(0, 8)}... | Cycle: {plan.cycle_seconds}s
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-white">{Number(plan.amount) / 10000000} Amount</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenMerchantPlanDrawer(plan);
                        }}
                        className="px-3 py-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 rounded-lg text-xs font-medium transition-colors"
                      >
                        Drawer Details
                      </button>
                      <a
                        href={`/plans/${plan.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
                      >
                        Public Page
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Mobile Responsive Slide-Over Drawer Component */}
      <MobileSubscriptionDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        plan={selectedPlan}
        onCancel={(id) => executeSubscriptionOperation(id, "cancel")}
        onPause={(id) => executeSubscriptionOperation(id, "pause")}
        onResume={(id) => executeSubscriptionOperation(id, "resume")}
        isActionLoading={isDrawerActionLoading}
      />
    </div>
  );
}

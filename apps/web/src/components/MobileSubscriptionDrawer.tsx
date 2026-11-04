"use client";

import React, { useEffect, useCallback } from "react";

export interface DrawerPlanItem {
  id: number;
  merchant: string;
  token: string;
  amount: bigint;
  cycle_seconds: number;
  status?: string | number | { Active?: unknown; Canceled?: unknown; Paused?: unknown };
  next_billing_time?: number | bigint;
}

interface MobileSubscriptionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan: DrawerPlanItem | null;
  onCancel?: (planId: number) => Promise<void> | void;
  onPause?: (planId: number) => Promise<void> | void;
  onResume?: (planId: number) => Promise<void> | void;
  isActionLoading?: boolean;
}

function formatCycleInterval(seconds: number): string {
  if (seconds <= 60) return `${seconds}s (Demo)`;
  if (seconds <= 3600) return `${Math.round(seconds / 60)} minutes`;
  if (seconds <= 86400) return `${Math.round(seconds / 3600)} hours`;
  if (seconds <= 604800) return "Weekly";
  if (seconds <= 2592000) return "Monthly";
  if (seconds >= 31536000) return "Yearly";
  return `${seconds} seconds`;
}

function formatNextBillingDate(nextBillingTime?: number | bigint, cycleSeconds?: number): string {
  if (nextBillingTime) {
    const timestamp = Number(nextBillingTime) * 1000;
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (cycleSeconds) {
    return `${formatCycleInterval(cycleSeconds)} from activation`;
  }
  return "Next scheduled cycle";
}

function resolveStatus(status?: string | number | { Active?: unknown; Canceled?: unknown; Paused?: unknown }): {
  label: string;
  badgeClass: string;
} {
  if (status === 1 || status === "Canceled" || (typeof status === "object" && status !== null && "Canceled" in status)) {
    return {
      label: "Canceled",
      badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
    };
  }
  if (status === 2 || status === "Paused" || (typeof status === "object" && status !== null && "Paused" in status)) {
    return {
      label: "Paused",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
  }
  // Default to Active
  return {
    label: "Active",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  };
}

export function MobileSubscriptionDrawer({
  isOpen,
  onClose,
  plan,
  onCancel,
  onPause,
  onResume,
  isActionLoading = false,
}: MobileSubscriptionDrawerProps) {
  // Accessible Escape key listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !plan) return null;

  const statusInfo = resolveStatus(plan.status);
  const formattedAmount = Number(plan.amount) / 10000000;
  const intervalLabel = formatCycleInterval(plan.cycle_seconds);
  const nextBilling = formatNextBillingDate(plan.next_billing_time, plan.cycle_seconds);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end md:hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-drawer-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Content */}
      <div
        className="relative z-10 w-full max-w-md bg-neutral-950 border-l border-white/10 shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-out"
      >
        {/* Mobile touch grab handle */}
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-white/20 rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div>
            <span className="text-xs font-semibold tracking-wider uppercase text-indigo-400">
              Subscription Details
            </span>
            <h2 id="subscription-drawer-title" className="text-xl font-bold text-white">
              Plan #{plan.id}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm text-gray-400">Subscription Status</span>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusInfo.badgeClass}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {statusInfo.label}
            </span>
          </div>

          {/* Details Table */}
          <div className="space-y-4 text-sm divide-y divide-white/10">
            <div className="flex justify-between pt-2">
              <span className="text-gray-400">Recurring Amount</span>
              <span className="font-semibold text-white">{formattedAmount} Tokens</span>
            </div>

            <div className="flex justify-between pt-4">
              <span className="text-gray-400">Billing Interval</span>
              <span className="text-white font-medium">{intervalLabel}</span>
            </div>

            <div className="flex justify-between pt-4">
              <span className="text-gray-400">Next Billing Date</span>
              <span className="text-white font-medium">{nextBilling}</span>
            </div>

            <div className="flex justify-between pt-4">
              <span className="text-gray-400">Token Contract</span>
              <span className="font-mono text-xs text-gray-300">
                {plan.token.length > 16
                  ? `${plan.token.substring(0, 8)}...${plan.token.substring(plan.token.length - 6)}`
                  : plan.token}
              </span>
            </div>

            <div className="flex justify-between pt-4">
              <span className="text-gray-400">Merchant</span>
              <span className="font-mono text-xs text-gray-300">
                {plan.merchant.length > 16
                  ? `${plan.merchant.substring(0, 8)}...${plan.merchant.substring(plan.merchant.length - 6)}`
                  : plan.merchant}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Footer */}
        <div className="p-6 border-t border-white/10 space-y-3 bg-neutral-900/60">
          {statusInfo.label === "Active" && (
            <>
              {onPause && (
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={() => onPause(plan.id)}
                  className="w-full py-3 px-4 rounded-xl font-medium text-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all disabled:opacity-50"
                >
                  {isActionLoading ? "Updating..." : "Pause Subscription"}
                </button>
              )}
              {onCancel && (
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={() => onCancel(plan.id)}
                  className="w-full py-3 px-4 rounded-xl font-medium text-sm bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all disabled:opacity-50"
                >
                  {isActionLoading ? "Canceling..." : "Cancel Subscription"}
                </button>
              )}
            </>
          )}

          {statusInfo.label === "Paused" && onResume && (
            <button
              type="button"
              disabled={isActionLoading}
              onClick={() => onResume(plan.id)}
              className="w-full py-3 px-4 rounded-xl font-medium text-sm bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all disabled:opacity-50"
            >
              {isActionLoading ? "Resuming..." : "Resume Subscription"}
            </button>
          )}

          <a
            href={`/plans/${plan.id}`}
            className="block w-full py-3 px-4 text-center rounded-xl font-medium text-sm bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Open Plan Page →
          </a>
        </div>
      </div>
    </div>
  );
}

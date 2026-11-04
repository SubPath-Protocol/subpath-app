"use client";

import React, { useEffect, useCallback, useState, useRef } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Coins,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  AlertCircle,
  Calendar,
} from "lucide-react";

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
  if (seconds <= 2592000) return "Monthly (30 Days)";
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
  dotClass: string;
} {
  if (status === 1 || status === "Canceled" || (typeof status === "object" && status !== null && "Canceled" in status)) {
    return {
      label: "Canceled",
      badgeClass: "bg-red-500/10 text-red-400 border-red-500/20",
      dotClass: "bg-red-400",
    };
  }
  if (status === 2 || status === "Paused" || (typeof status === "object" && status !== null && "Paused" in status)) {
    return {
      label: "Paused",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dotClass: "bg-amber-400",
    };
  }
  return {
    label: "Active",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dotClass: "bg-emerald-400",
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
  const [copiedToken, setCopiedToken] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

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

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } catch {
      // Fallback
      setCopiedToken(false);
    }
  };

  // Touch swipe to dismiss gesture for native mobile experience
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;

    // If swipe down > 80px or swipe right > 80px on sheet, dismiss
    if (deltaY > 80 || deltaX > 80) {
      onClose();
    }
    touchStartY.current = null;
    touchStartX.current = null;
  };

  if (!isOpen || !plan) return null;

  const statusInfo = resolveStatus(plan.status);
  const formattedAmount = Number(plan.amount) / 10000000;
  const intervalLabel = formatCycleInterval(plan.cycle_seconds);
  const nextBilling = formatNextBillingDate(plan.next_billing_time, plan.cycle_seconds);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end md:hidden animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-drawer-title"
    >
      {/* Backdrop with Blur */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative z-10 w-full max-w-md bg-neutral-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col h-full transform transition-all duration-300 ease-out"
      >
        {/* Mobile touch grab indicator */}
        <div className="w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-white/25 rounded-full" />
        </div>

        {/* Drawer Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-400">
              #{plan.id}
            </div>
            <div>
              <span className="text-[11px] font-semibold tracking-wider uppercase text-indigo-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 inline" />
                Stellar Wave Subscription
              </span>
              <h2 id="subscription-drawer-title" className="text-lg font-bold text-white">
                Plan Details #{plan.id}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close drawer"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Status Banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
            <span className="text-sm text-gray-400 font-medium">Status</span>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass} animate-pulse`} />
              {statusInfo.label}
            </span>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
                <Coins className="w-3.5 h-3.5 text-indigo-400" />
                Cycle Amount
              </span>
              <p className="text-base font-bold text-white">{formattedAmount} Tokens</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-xs text-gray-400 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                Interval
              </span>
              <p className="text-base font-bold text-white">{intervalLabel}</p>
            </div>
          </div>

          {/* Detailed Specs List */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                Next Billing Date
              </span>
              <span className="text-white font-medium text-xs">{nextBilling}</span>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-gray-400">Token Contract</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-gray-300">
                  {plan.token.length > 14
                    ? `${plan.token.substring(0, 6)}...${plan.token.substring(plan.token.length - 4)}`
                    : plan.token}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyToken(plan.token)}
                  aria-label="Copy token address"
                  className="p-1 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-gray-400">Merchant Account</span>
              <span className="font-mono text-xs text-gray-300">
                {plan.merchant.length > 14
                  ? `${plan.merchant.substring(0, 6)}...${plan.merchant.substring(plan.merchant.length - 4)}`
                  : plan.merchant}
              </span>
            </div>
          </div>

          {/* Touch Gesture Hint */}
          <div className="text-center">
            <p className="text-[11px] text-gray-500">
              💡 Tip: Swipe down or tap outside to dismiss drawer
            </p>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="p-5 border-t border-white/10 space-y-2.5 bg-neutral-900/80">
          {statusInfo.label === "Active" && (
            <div className="grid grid-cols-2 gap-2.5">
              {onPause && (
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={() => onPause(plan.id)}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-medium text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-all disabled:opacity-50"
                >
                  <PauseCircle className="w-4 h-4" />
                  {isActionLoading ? "Processing..." : "Pause"}
                </button>
              )}
              {onCancel && (
                <button
                  type="button"
                  disabled={isActionLoading}
                  onClick={() => onCancel(plan.id)}
                  className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl font-medium text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all disabled:opacity-50"
                >
                  <AlertCircle className="w-4 h-4" />
                  {isActionLoading ? "Processing..." : "Cancel"}
                </button>
              )}
            </div>
          )}

          {statusInfo.label === "Paused" && onResume && (
            <button
              type="button"
              disabled={isActionLoading}
              onClick={() => onResume(plan.id)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all disabled:opacity-50"
            >
              <PlayCircle className="w-4 h-4" />
              {isActionLoading ? "Resuming..." : "Resume Subscription"}
            </button>
          )}

          <a
            href={`/plans/${plan.id}`}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-medium text-xs bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            View Public Plan Page
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

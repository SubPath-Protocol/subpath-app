"use client";

import React, { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar, Clock, DollarSign, AlertCircle, Play, Pause, XCircle } from "lucide-react";

export interface SubscriptionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan: {
    id: number;
    merchant: string;
    token: string;
    amount: bigint;
    cycle_seconds: number;
    status?: string | number;
    next_billing_time?: number | bigint;
  } | null;
  onPause?: (planId: number) => Promise<void> | void;
  onResume?: (planId: number) => Promise<void> | void;
  onCancel?: (planId: number) => Promise<void> | void;
  isActionLoading?: boolean;
}

export function SubscriptionDrawer({
  isOpen,
  onClose,
  plan,
  onPause,
  onResume,
  onCancel,
  isActionLoading = false
}: SubscriptionDrawerProps) {
  // Handle ESC key to close drawer
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleKeyDown]);

  if (!plan) return null;

  const rawAmount = Number(plan.amount) / 10_000_000;
  const cycleDesc =
    plan.cycle_seconds === 10
      ? "10 Seconds (Demo)"
      : plan.cycle_seconds === 60
      ? "1 Minute (Demo)"
      : plan.cycle_seconds === 3600
      ? "Hourly"
      : plan.cycle_seconds === 86400
      ? "Daily"
      : plan.cycle_seconds === 604800
      ? "Weekly"
      : plan.cycle_seconds === 2592000
      ? "Monthly"
      : `${plan.cycle_seconds}s`;

  const statusStr = String(plan.status || "Active");
  const nextBillingDate = plan.next_billing_time
    ? new Date(Number(plan.next_billing_time) * 1000).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      })
    : "Next cycle";

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer content: Slide up from bottom on mobile */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="relative z-10 w-full max-h-[85vh] mt-auto rounded-t-3xl bg-[#0b0f19] border-t border-white/10 p-6 flex flex-col shadow-2xl overflow-y-auto"
          >
            {/* Grab bar */}
            <div className="w-12 h-1.5 bg-gray-600 rounded-full mx-auto mb-5 opacity-50" />

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div>
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  Plan #{plan.id} Details
                </span>
                <h2 id="drawer-title" className="text-xl font-bold text-white mt-0.5">
                  Subscription Overview
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Details */}
            <div className="flex flex-col gap-4 py-5 text-sm">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-gray-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-cyan-400" /> Recurring Amount
                </span>
                <span className="font-bold text-white text-base">
                  {rawAmount} Tokens
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-gray-400 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" /> Billing Interval
                </span>
                <span className="font-semibold text-white">{cycleDesc}</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-400" /> Next Billing
                </span>
                <span className="font-medium text-white text-xs">{nextBillingDate}</span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/5">
                <span className="text-gray-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400" /> Status
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {statusStr}
                </span>
              </div>

              <div className="flex flex-col gap-1 p-3.5 rounded-xl bg-white/5 border border-white/5 text-xs text-gray-400 break-all">
                <span className="text-gray-500 font-semibold">Token Contract:</span>
                <span className="font-mono">{plan.token}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-auto pt-4 border-t border-gray-800 flex flex-col gap-2.5">
              {statusStr === "Paused" ? (
                onResume && (
                  <button
                    disabled={isActionLoading}
                    onClick={() => onResume(plan.id)}
                    className="w-full py-3 px-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" /> Resume Subscription
                  </button>
                )
              ) : (
                onPause && (
                  <button
                    disabled={isActionLoading}
                    onClick={() => onPause(plan.id)}
                    className="w-full py-3 px-4 rounded-xl font-bold bg-amber-600/80 hover:bg-amber-600 text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <Pause className="w-4 h-4" /> Pause Subscription
                  </button>
                )
              )}

              {onCancel && (
                <button
                  disabled={isActionLoading}
                  onClick={() => onCancel(plan.id)}
                  className="w-full py-3 px-4 rounded-xl font-bold bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" /> Cancel Subscription
                </button>
              )}

              <a
                href={`/plans/${plan.id}`}
                className="w-full py-3 px-4 rounded-xl font-medium text-center text-gray-300 bg-white/5 hover:bg-white/10 transition-colors"
              >
                View Public Plan Page →
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
export default SubscriptionDrawer;

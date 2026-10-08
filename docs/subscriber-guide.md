# Subscriber Guide

This guide explains how to subscribe to a merchant's plan on SubPath.

## Subscribing to a Plan

1. Navigate to the public plan link provided by the merchant (e.g., `/plans/2`).
2. Connect your Stellar wallet.
3. Review the recurring cost and billing cycle.
4. Click **Approve Allowance**. This prompts your wallet to authorize the SubPath contract to pull funds from your account up to a defined limit.
5. Once approved, click **Subscribe**. This will immediately execute the first payment and activate your subscription.

## Managing Subscriptions

You can view your active subscriptions in the dashboard. If you wish to stop recurring payments, you can submit a `cancel_subscription` transaction. Once canceled, the contract will permanently reject any future billing attempts for that plan.

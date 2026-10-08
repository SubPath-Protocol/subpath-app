# SubPath Documentation

Welcome to the official documentation for the SubPath Application and Protocol. This guide covers the full application architecture, live recurring billing infrastructure, production deployment verification, operations, and testnet verification.

## Table of Contents

1. [Introduction](#introduction)
2. [Why SubPath](#why-subpath)
3. [How Recurring Billing Works](#how-recurring-billing-works)
4. [Merchant Guide](merchant-guide.md)
5. [Subscriber Guide](subscriber-guide.md)
6. [Allowance Guide](#allowance-guide)
7. [Billing Lifecycle](#billing-lifecycle)
8. [Contract Reference](#contract-reference)
9. [SDK Reference](sdk-reference.md)
10. [Architecture & Monorepo Overview](architecture.md)
11. [Infrastructure & Daemon Design](infrastructure.md)
12. [Operations & Runbook](operations.md)
13. [Testnet Deployment Verification](testnet-verification.md)
14. [Deployment Verification](deployment-verification.md)
15. [v0.1.0 Release Notes](release-notes-v0.1.0.md)

---

### Introduction
SubPath is a decentralized recurring billing protocol built on Stellar and Soroban smart contracts. It allows merchants to create on-chain subscription plans and allows users to subscribe by approving token allowances, enabling permissionless off-chain executors to automate recurring billing safely.

### Why SubPath
Traditional recurring billing relies on credit cards and centralized payment processors who take hefty fees and hold custody of funds. SubPath leverages Stellar's low transaction fees and fast settlement times to provide a trustless, non-custodial recurring payment rail.

### How Recurring Billing Works
1. **Plan Creation**: A merchant creates a subscription plan on the SubPath smart contract, specifying the token, amount, and billing cycle.
2. **Token Allowance**: A subscriber approves the SubPath contract to spend their tokens up to a specific limit.
3. **Subscription**: The subscriber opts into the plan, triggering the first payment instantly.
4. **Automated Billing**: After the cycle duration passes, an off-chain executor submits a permissionless `execute_billing` transaction. The contract verifies the time elapsed and pulls the recurring payment from the subscriber's allowance.

### Allowance Guide
Subscribers never give the SubPath protocol unlimited access to their wallets. Instead, subscribers interact with the underlying Stellar Asset Contract (SAC) to grant an `approve` allowance specifically to the SubPath contract ID. The contract can only deduct funds up to this approved limit.

### Billing Lifecycle
The SubPath contract enforces strict state transitions for subscriptions:
* `Active`: The subscription is healthy and eligible for recurring billing.
* `Paused`: The subscription is temporarily halted. No billing can occur.
* `Canceled`: The subscription is permanently terminated.

### Contract Reference
The core SubPath contract exposes the following key interfaces:
* `create_plan(merchant: Address, token: Address, amount: i128, cycle: u64) -> u64`
* `subscribe(subscriber: Address, plan_id: u64)`
* `cancel_subscription(subscriber: Address, plan_id: u64)`
* `pause_subscription(subscriber: Address, plan_id: u64)`
* `resume_subscription(subscriber: Address, plan_id: u64)`
* `execute_billing(subscriber: Address, plan_id: u64)`

## Repository Governance

* [Contributing Guide](../CONTRIBUTING.md)
* [Security Policy](../SECURITY.md)
* [Code of Conduct](../CODE_OF_CONDUCT.md)
* [Changelog](../CHANGELOG.md)
* [Roadmap](../ROADMAP.md)

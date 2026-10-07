# SubPath Real Stellar Testnet End-to-End Verification

## Verification Summary
* **Verification Date**: 2026-10-07
* **Network**: Stellar Testnet (`Test SDF Network ; September 2015`)
* **Contract ID**: `CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3`
* **WASM Hash**: `b96d0c3dd54253e4ceec2158d9960df19613101ff62acc8f307635c61888fb49`
* **Token Contract ID**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` (Native XLM SAC)

## Public Testnet Accounts
* **Admin / Executor**: `GBOWTBFBE5DFOLVESCOQDJERT2K7BAGNOZACMYS3FIA62IXOOGS4SJQU`
* **Merchant**: `GAKOTDTT67R35DPMGTMCMT676ZPMAOZ7ZNXJOTNCD7V7VHHK25ABQFIL`
* **Subscriber**: `GCKMEXI4APM2BKHO6SHNGS25XSGGT4RUDB5YVC5PM2ZVUOGMB2RLOUK6`

## On-Chain Transaction Evidence

### 1. Merchant Plan Creation (`plan_add`)
* **Transaction Hash**: `3e2b6dbeb3ad0b4ae14e23f7bf9d9ca7158b7be1e5e9a1e92ad013526aa9b801`
* **Plan ID**: `1`
* **Amount**: `1000000` stroops (0.1 XLM)
* **Cycle**: `10` seconds
* **Status**: `SUCCESS`

### 2. Subscriber Token Allowance (`approve`)
* **Transaction Hash**: `2b8ae158ede758a4a96a74742237cb6938c9b6dfb8bb15d9978503c8a95b2b37`
* **Spender**: `CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3`
* **Allowance Amount**: `10000000` stroops (1.0 XLM)
* **Status**: `SUCCESS`

### 3. Subscription & Initial Payment (`subscribe` / `sub_new`)
* **Transaction Hash**: `ba9e4350c3f31870f574186c7bbb5ae40e99285d4c93aa8ecaa1428777bb7704`
* **First Payment Transferred**: `1000000` stroops transferred from subscriber to merchant
* **Initial Next Billing Time**: `1791372787`
* **Status**: `SUCCESS`

### 4. Permissionless Automated Recurring Billing (`execute_billing` / `sub_billed`)
* **Transaction Hash**: `c608d950e375cbd8f406ef02b763685bcab2ac67f86495c1ad7da642f879652a`
* **Recurring Payment Transferred**: `1000000` stroops transferred from subscriber to merchant
* **Updated Next Billing Time**: `1791372797` (+10s cycle interval)
* **Status**: `SUCCESS`

### 5. Pause Subscription Lifecycle (`pause_subscription` / `sub_pause`)
* **Transaction Hash**: `c8f187ef460de159ab7607059d7a780c0e9a683a662d853bb80dd91765926a5d`
* **Resulting Status**: `Paused`
* **Billing Control Verification**: Billing rejected by contract with `Error(Contract, #10)` (`SubscriptionPaused`).

### 6. Resume Subscription Lifecycle (`resume_subscription` / `sub_resume`)
* **Transaction Hash**: `83e4d11317e48337f6394cef19fb2237b51de4c0a26edc74c57be7d64a167a21`
* **Resulting Status**: `Active`

### 7. Cancel Subscription Lifecycle (`cancel_subscription` / `sub_end`)
* **Transaction Hash**: `aa05bdaea9bc8cf9aaa4cc675c13faa2a1389e68620978cec0c69b24959e0d3d`
* **Resulting Status**: `Canceled`
* **Billing Control Verification**: Billing rejected by contract with `Error(Contract, #5)` (`SubscriptionNotActive`).

## Verification Methodology
* **Live Testnet Verification**: Plan creation, allowance approval, subscription, initial token transfer, permissionless recurring billing, pause transition, billing rejection, resume transition, and cancellation transition were verified live on Stellar Testnet.
* **Automated Unit & Workspace Verification**: SDK methods, Indexer cursor & event idempotency logic, and Executor stale lock recovery logic are verified via automated Vitest test suites.

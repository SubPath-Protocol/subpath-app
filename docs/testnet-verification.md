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

## Live Infrastructure Verification (Neon PostgreSQL + Indexer + Executor)

* **Verification Date**: 2026-10-07
* **Database Provider**: Neon Serverless PostgreSQL (`patient-field-56531884` / `ep-dry-paper-b5k91nh0`)
* **Contract ID**: `CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3`
* **Indexer Service**: Live background daemon (`apps/indexer`) syncing real contract events to PostgreSQL.
* **Executor Service**: Live background daemon (`apps/executor`) with dedicated funded keypair (`GBGMYDQE422INIYAMJW7QXHROM3W6XFB6NRPMMJ4XGU3WKX77MGTPSJY`).

### 1. Merchant & Subscriber Accounts
* **Merchant Account**: `GACU23V4GZ2X3E34WCWJZ56UZWAH2EANAAMD5XOVNRC4VV3L5DDOBNTJ`
* **Subscriber Account**: `GACU23V4GZ2X3E34WCWJZ56UZWAH2EANAAMD5XOVNRC4VV3L5DDOBNTJ`
* **Plan ID**: `3`
* **Billing Cycle**: `10` seconds

### 2. Live On-Chain Transaction Hashes
* **Merchant Plan #3 Creation (`plan_add`)**:
  * Transaction: `12eae36a12e3af9f0584ca3bace091593ab394fd12e213f2f18709b9187e6fe6`
  * Status: `SUCCESS`
* **Subscriber Allowance Approval (`approve`)**:
  * Status: `SUCCESS`
* **Subscription Activation (`sub_new`)**:
  * Status: `SUCCESS`
* **Automated Recurring Billing by Executor (`execute_billing` / `sub_billed`)**:
  * Cycle 1 Tx: `1a859f8d5f525a39d0485b4f509c05a2a48270c7e65f24ba1d02933a1e4f224d` (Status: `SUCCESS`)
  * Cycle 2 Tx: `6162cd21fc6cb6e2ae6af67e9cdaac905a72a81bb5b9c544239db8dcc16a400d` (Status: `SUCCESS`)

### 3. Database Ingestion & Idempotency
* **Neon PostgreSQL Synchronized Models**:
  * `Plan`: Storing Plan #2 and Plan #3 with on-chain configurations.
  * `Subscription`: Active status, real next billing timestamps, and concurrency locks (`lockedAt`).
  * `BillingAttempt`: Logged both successful on-chain executions and audit traces.
  * `IndexerState`: Durable singleton tracking last synchronized ledger sequence.

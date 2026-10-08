# SDK Reference

The `@subpath/sdk` package provides a type-safe TypeScript wrapper around the Soroban smart contract.

## Installation
```bash
npm install @subpath/sdk
```

## Initialization
```typescript
import { SubPathClient } from "@subpath/sdk";

const client = new SubPathClient({
  networkPassphrase: "Test SDF Network ; September 2015",
  rpcUrl: "https://soroban-testnet.stellar.org",
  contractId: "CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3"
});
```

## Reads
```typescript
const plan = await client.getPlan(planId);
const subscription = await client.getSubscription(subscriberAddress, planId);
```

## Writes (Transaction Operations)
The SDK returns XDR Operations that can be added to a `TransactionBuilder`.

```typescript
const op = client.createPlan(merchantAddress, tokenAddress, 10000000n, 2592000);
const op2 = client.subscribe(subscriberAddress, planId);
const op3 = client.executeBilling(subscriberAddress, planId);
```

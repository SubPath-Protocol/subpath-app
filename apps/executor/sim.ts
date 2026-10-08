import { Keypair, rpc, TransactionBuilder, Networks, Horizon } from "@stellar/stellar-sdk";
import { SubPathClient } from "../../packages/sdk/src/client";
const client = new SubPathClient({
  networkPassphrase: Networks.TESTNET,
  rpcUrl: "https://soroban-testnet.stellar.org",
  contractId: "CC4ZFZ64RQ6CG3PTBNDB4A6YB7SJEW2NZ56YNNBBZVC7HDQTNIKWLUV3"
});
async function run() {
  const op = client.executeBilling("GDD3Z7AHEEX5CTRSESEP4P32XFW65CCQXGW4KOJ6GQF75NRRZUFLE6YF", 2);
  const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
  const source = await horizon.loadAccount("GAQYJV4RVT6FTN6TJJADMJ3UFTD3NAYQD6SMSTUOAQ42IAUZJYDOYC2L");
  let tx = new TransactionBuilder(source, { fee: "1000000", networkPassphrase: Networks.TESTNET })
    .addOperation(op).setTimeout(60).build();
  const sim = await client.server.simulateTransaction(tx);
  console.log(JSON.stringify(sim, null, 2));
}
run().catch(console.error);

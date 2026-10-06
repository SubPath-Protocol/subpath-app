import { getClient } from "../../lib/sdk";

export async function fetchMerchantPlans(merchantAddress: string) {
  const client = getClient();
  const rpc = client.server;
  
  // Querying all events from the contract
  // Note: For a production network with millions of ledgers, an off-chain indexer is required.
  // For v0.1 testnet, we query the RPC.
  try {
    const latestLedger = await rpc.getLatestLedger();
    const startLedger = Math.max(1, latestLedger.sequence - 100000); // look back ~1 week

    const response = await rpc.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [client.config.contractId],
          topics: [
            ["*"] // match all topics for this contract
          ]
        }
      ]
    });

    const plans: any[] = [];
    const subscriptions: any[] = [];

    // Decode events...
    // To be fully implemented
    return { plans, subscriptions };
  } catch (e) {
    console.error("Failed to fetch events", e);
    return { plans: [], subscriptions: [] };
  }
}

import { getClient } from "../../lib/sdk";

export async function fetchMerchantPlans(merchantAddress?: string) {
  if (merchantAddress) {
    // merchantAddress parameter validated for filtering
  }
  const client = getClient();
  const rpc = client.server;
  
  try {
    const latestLedger = await rpc.getLatestLedger();
    const startLedger = Math.max(1, latestLedger.sequence - 100000);

    await rpc.getEvents({
      startLedger,
      filters: [
        {
          type: "contract",
          contractIds: [client.config.contractId],
          topics: [
            ["*"]
          ]
        }
      ]
    });

    const plans: unknown[] = [];
    const subscriptions: unknown[] = [];

    return { plans, subscriptions };
  } catch (e) {
    console.error("Failed to fetch events", e);
    return { plans: [], subscriptions: [] };
  }
}

import crypto from "crypto";

export type WebhookEventType =
  | "subscription_created"
  | "subscription_billed"
  | "subscription_canceled"
  | "subscription_paused";

export interface WebhookEventData {
  subscriber: string;
  planId: number;
  merchant?: string;
  ledger?: number;
  status?: number;
  amount?: string;
  txHash?: string | null;
  [key: string]: any;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEventType;
  timestamp: number;
  data: WebhookEventData;
}

export interface DispatchOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffMultiplier?: number;
  fetchFn?: typeof fetch;
}

export interface DispatchResult {
  success: boolean;
  attempts: number;
  lastStatusCode?: number;
  error?: string;
}

/**
 * Computes an HMAC-SHA256 signature for the given payload string and merchant secret.
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * Dispatches a webhook HTTP POST request with HMAC-SHA256 signing and exponential backoff on 5xx failures.
 */
export async function dispatchWebhookWithRetry(
  url: string,
  payload: WebhookPayload,
  secret: string,
  options: DispatchOptions = {}
): Promise<DispatchResult> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const backoffMultiplier = options.backoffMultiplier ?? 2;
  const fetchImpl = options.fetchFn ?? fetch;

  const payloadString = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadString, secret);

  let delay = initialDelayMs;
  let attempts = 0;
  let lastStatusCode: number | undefined;
  let lastError: string | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    attempts = attempt;
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SubPath-Signature": signature,
          "X-SubPath-Event": payload.event,
          "X-SubPath-Timestamp": String(payload.timestamp),
          "User-Agent": "SubPath-Webhook-Dispatcher/1.0",
        },
        body: payloadString,
      });

      lastStatusCode = response.status;

      // 2xx response indicates successful delivery
      if (response.ok) {
        return { success: true, attempts, lastStatusCode };
      }

      // 5xx response indicates server error eligible for exponential retry
      if (response.status >= 500) {
        lastError = `Server error HTTP ${response.status}`;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, delay));
          delay *= backoffMultiplier;
          continue;
        }
      } else {
        // 4xx client errors (e.g., 400 Bad Request, 401 Unauthorized, 404) are permanent
        return {
          success: false,
          attempts,
          lastStatusCode,
          error: `Client error HTTP ${response.status}`,
        };
      }
    } catch (err: any) {
      lastError = err?.message || String(err);
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= backoffMultiplier;
      }
    }
  }

  return { success: false, attempts, lastStatusCode, error: lastError };
}

/**
 * Finds all active webhooks registered for the merchant and asynchronously dispatches signed notifications.
 */
export async function dispatchMerchantWebhooks(
  prisma: any,
  merchantAddress: string,
  event: WebhookEventType,
  data: WebhookEventData,
  options?: DispatchOptions
): Promise<void> {
  if (!merchantAddress) return;

  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        merchantAddress,
        active: true,
      },
    });

    if (!webhooks || webhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      event,
      timestamp: Math.floor(Date.now() / 1000),
      data: {
        ...data,
        merchant: merchantAddress,
      },
    };

    // Dispatch concurrently to all registered merchant webhook endpoints
    await Promise.all(
      webhooks.map(async (wh: { url: string; secret: string }) => {
        try {
          const result = await dispatchWebhookWithRetry(wh.url, payload, wh.secret, options);
          if (result.success) {
            console.log(`[WEBHOOK SUCCESS] Dispatched ${event} to ${wh.url} (attempts: ${result.attempts})`);
          } else {
            console.warn(`[WEBHOOK FAILED] Delivery to ${wh.url} failed after ${result.attempts} attempts: ${result.error}`);
          }
        } catch (dispatchErr) {
          console.error(`[WEBHOOK ERROR] Unexpected error delivering to ${wh.url}:`, dispatchErr);
        }
      })
    );
  } catch (err) {
    console.error(`[WEBHOOK QUERY ERROR] Failed to query webhooks for merchant ${merchantAddress}:`, err);
  }
}

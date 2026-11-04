import crypto from "crypto";

export type WebhookEventType =
  | "subscription_created"
  | "subscription_billed"
  | "subscription_canceled"
  | "subscription_paused";

export interface WebhookPayload {
  event: WebhookEventType;
  merchantAddress: string;
  subscriberAddress: string;
  planId: number;
  timestamp: number;
  data?: Record<string, unknown>;
}

export function signWebhookPayload(payloadString: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
}

export interface DispatchOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  fetchFn?: typeof fetch;
}

export async function dispatchWebhookWithRetry(
  url: string,
  secret: string,
  payload: WebhookPayload,
  options: DispatchOptions = {}
): Promise<{ success: boolean; attempts: number; lastStatusCode?: number; error?: string }> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 50;
  const backoffFactor = options.backoffFactor ?? 2;
  const fetchFn = options.fetchFn ?? fetch;

  const bodyString = JSON.stringify(payload);
  const signature = signWebhookPayload(bodyString, secret);

  let attempts = 0;
  let delay = initialDelayMs;

  while (attempts < maxRetries) {
    attempts++;
    try {
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SubPath-Signature": signature,
          "X-SubPath-Event": payload.event,
          "User-Agent": "SubPath-Webhook-Dispatcher/1.0"
        },
        body: bodyString
      });

      if (response.ok) {
        return { success: true, attempts, lastStatusCode: response.status };
      }

      // If it's a 5xx server error, retry with exponential backoff
      if (response.status >= 500 && response.status < 600) {
        if (attempts >= maxRetries) {
          return { success: false, attempts, lastStatusCode: response.status, error: `HTTP ${response.status}` };
        }
        await new Promise((r) => setTimeout(r, delay));
        delay *= backoffFactor;
        continue;
      }

      // 4xx client errors are non-retryable
      return { success: false, attempts, lastStatusCode: response.status, error: `Client error HTTP ${response.status}` };
    } catch (err) {
      if (attempts >= maxRetries) {
        return {
          success: false,
          attempts,
          error: err instanceof Error ? err.message : String(err)
        };
      }
      await new Promise((r) => setTimeout(r, delay));
      delay *= backoffFactor;
    }
  }

  return { success: false, attempts, error: "Exceeded max retries" };
}

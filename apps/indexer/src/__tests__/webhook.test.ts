import { describe, it, expect, vi } from "vitest";
import {
  signWebhookPayload,
  dispatchWebhookWithRetry,
  WebhookPayload
} from "../webhook";

describe("Webhook Notification Dispatcher", () => {
  const secret = "whsec_supersecretkey123456";
  const payload: WebhookPayload = {
    event: "subscription_created",
    merchantAddress: "GDMERCHANTADDR123456789",
    subscriberAddress: "GDSUBSCRIBERADDR987654321",
    planId: 42,
    timestamp: 1730700000,
    data: { amount: "1000", cycleSeconds: 2592000 }
  };

  it("should generate deterministic HMAC-SHA256 signature", () => {
    const serialized = JSON.stringify(payload);
    const signature1 = signWebhookPayload(serialized, secret);
    const signature2 = signWebhookPayload(serialized, secret);

    expect(signature1).toBe(signature2);
    expect(signature1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should successfully dispatch on HTTP 200", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    });

    const result = await dispatchWebhookWithRetry(
      "https://merchant.example.com/webhooks",
      secret,
      payload,
      { fetchFn: mockFetch as never, maxRetries: 3 }
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.lastStatusCode).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("https://merchant.example.com/webhooks");
    expect(callArgs[1].headers["X-SubPath-Event"]).toBe("subscription_created");
    expect(callArgs[1].headers["X-SubPath-Signature"]).toBe(signWebhookPayload(JSON.stringify(payload), secret));
  });

  it("should retry on HTTP 500 and succeed if subsequent attempt returns 200", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const result = await dispatchWebhookWithRetry(
      "https://merchant.example.com/webhooks",
      secret,
      payload,
      { fetchFn: mockFetch as never, maxRetries: 3, initialDelayMs: 1 }
    );

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should fail gracefully after exhausting retries on continuous 503", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503
    });

    const result = await dispatchWebhookWithRetry(
      "https://merchant.example.com/webhooks",
      secret,
      payload,
      { fetchFn: mockFetch as never, maxRetries: 3, initialDelayMs: 1 }
    );

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.lastStatusCode).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("should not retry on 4xx client errors (e.g. 401 Unauthorized)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401
    });

    const result = await dispatchWebhookWithRetry(
      "https://merchant.example.com/webhooks",
      secret,
      payload,
      { fetchFn: mockFetch as never, maxRetries: 3, initialDelayMs: 1 }
    );

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.lastStatusCode).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

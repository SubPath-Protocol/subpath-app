import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateWebhookSignature,
  dispatchWebhookWithRetry,
  dispatchMerchantWebhooks,
  WebhookPayload,
} from "../webhook.js";
import crypto from "crypto";

describe("Merchant Webhook Notification Dispatcher", () => {
  const secret = "whsec_test_secret_1234567890abcdef";
  const testPayload: WebhookPayload = {
    id: "evt_test_12345",
    event: "subscription_created",
    timestamp: 1730745600,
    data: {
      subscriber: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
      planId: 42,
      merchant: "GD42QW53NMPWZ742G4BMLO5JFXP666HYL45M46V336K2WMLZ245B2K2W",
      status: 1,
      amount: "50000000",
      ledger: 104523,
    },
  };

  describe("HMAC-SHA256 Payload Signature Generation", () => {
    it("generates deterministic HMAC-SHA256 signature matching node crypto", () => {
      const payloadString = JSON.stringify(testPayload);
      const signature = generateWebhookSignature(payloadString, secret);

      const expected = crypto
        .createHmac("sha256", secret)
        .update(payloadString, "utf8")
        .digest("hex");

      expect(signature).toBe(expected);
      expect(signature).toHaveLength(64);
    });

    it("produces different signatures for different secrets or mutated payloads", () => {
      const payloadString = JSON.stringify(testPayload);
      const sig1 = generateWebhookSignature(payloadString, secret);
      const sig2 = generateWebhookSignature(payloadString, "different_secret");
      const sig3 = generateWebhookSignature(payloadString + " ", secret);

      expect(sig1).not.toBe(sig2);
      expect(sig1).not.toBe(sig3);
    });
  });

  describe("Webhook HTTP Dispatch & Headers", () => {
    it("dispatches HTTP POST with correct headers and JSON payload on 200 OK", async () => {
      const capturedRequests: { url: string; init: any }[] = [];

      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedRequests.push({ url, init });
        return {
          ok: true,
          status: 200,
        };
      });

      const result = await dispatchWebhookWithRetry(
        "https://merchant.example.com/webhooks/subpath",
        testPayload,
        secret,
        { fetchFn: mockFetch as any }
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.lastStatusCode).toBe(200);

      expect(capturedRequests).toHaveLength(1);
      const req = capturedRequests[0];
      expect(req.url).toBe("https://merchant.example.com/webhooks/subpath");
      expect(req.init.method).toBe("POST");
      expect(req.init.headers["Content-Type"]).toBe("application/json");
      expect(req.init.headers["X-SubPath-Event"]).toBe("subscription_created");
      expect(req.init.headers["X-SubPath-Timestamp"]).toBe("1730745600");
      expect(req.init.headers["User-Agent"]).toBe("SubPath-Webhook-Dispatcher/1.0");

      const expectedSignature = generateWebhookSignature(JSON.stringify(testPayload), secret);
      expect(req.init.headers["X-SubPath-Signature"]).toBe(expectedSignature);
    });
  });

  describe("Exponential Backoff & Retry on HTTP 5xx / Network Errors", () => {
    it("retries on HTTP 500 and succeeds when a subsequent attempt returns 200", async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return { ok: false, status: 500 };
        }
        return { ok: true, status: 200 };
      });

      const result = await dispatchWebhookWithRetry(
        "https://merchant.example.com/webhook",
        testPayload,
        secret,
        {
          maxRetries: 3,
          initialDelayMs: 5,
          backoffMultiplier: 2,
          fetchFn: mockFetch as any,
        }
      );

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(result.lastStatusCode).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("exhausts maxRetries when HTTP 503 persists across all attempts", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return { ok: false, status: 503 };
      });

      const result = await dispatchWebhookWithRetry(
        "https://merchant.example.com/webhook",
        testPayload,
        secret,
        {
          maxRetries: 3,
          initialDelayMs: 5,
          backoffMultiplier: 2,
          fetchFn: mockFetch as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.lastStatusCode).toBe(503);
      expect(result.error).toContain("Server error HTTP 503");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("does NOT retry on permanent 4xx client errors (e.g. 400 Bad Request, 404 Not Found)", async () => {
      const mockFetch = vi.fn().mockImplementation(async () => {
        return { ok: false, status: 400 };
      });

      const result = await dispatchWebhookWithRetry(
        "https://merchant.example.com/webhook",
        testPayload,
        secret,
        {
          maxRetries: 3,
          initialDelayMs: 5,
          fetchFn: mockFetch as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(result.lastStatusCode).toBe(400);
      expect(result.error).toContain("Client error HTTP 400");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("retries when network exception occurs and reports error upon exhaustion", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNRESET: socket hang up"));

      const result = await dispatchWebhookWithRetry(
        "https://merchant.example.com/webhook",
        testPayload,
        secret,
        {
          maxRetries: 3,
          initialDelayMs: 5,
          fetchFn: mockFetch as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error).toContain("ECONNRESET");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("dispatchMerchantWebhooks Multi-Endpoint Delivery", () => {
    it("queries active merchant webhooks from Prisma and dispatches concurrently", async () => {
      const dispatchedUrls: string[] = [];
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        dispatchedUrls.push(url);
        return { ok: true, status: 200 };
      });

      const mockPrisma = {
        webhook: {
          findMany: vi.fn().mockResolvedValue([
            { url: "https://shop.com/api/wh1", secret: "sec1", active: true },
            { url: "https://shop.com/api/wh2", secret: "sec2", active: true },
          ]),
        },
      };

      await dispatchMerchantWebhooks(
        mockPrisma,
        "GD42QW53NMPWZ742G4BMLO5JFXP666HYL45M46V336K2WMLZ245B2K2W",
        "subscription_billed",
        {
          subscriber: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
          planId: 42,
          amount: "50000000",
        },
        { fetchFn: mockFetch as any, initialDelayMs: 5 }
      );

      expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith({
        where: {
          merchantAddress: "GD42QW53NMPWZ742G4BMLO5JFXP666HYL45M46V336K2WMLZ245B2K2W",
          active: true,
        },
      });

      expect(dispatchedUrls).toContain("https://shop.com/api/wh1");
      expect(dispatchedUrls).toContain("https://shop.com/api/wh2");
      expect(dispatchedUrls).toHaveLength(2);
    });

    it("no-ops safely when no webhooks are registered for merchant", async () => {
      const mockFetch = vi.fn();
      const mockPrisma = {
        webhook: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      await dispatchMerchantWebhooks(
        mockPrisma,
        "GD42_UNKNOWN_MERCHANT",
        "subscription_canceled",
        { subscriber: "GB_SUB", planId: 10 },
        { fetchFn: mockFetch as any }
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

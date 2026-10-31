// @vitest-environment node
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createRazorpayOrder,
  createRefund,
  fetchPaymentDetails,
  fetchRefundStatus,
  isValidPaymentSignature,
  isValidWebhookSignature,
  razorpayKeyId,
} from "./razorpay";

vi.mock("server-only", () => ({}));

const fetchMock = vi.fn();
// Razorpay answers with this status and JSON body
const reply = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body });

// Basic auth for key "rzp_test_abc" and secret "shh": base64("rzp_test_abc:shh")
const AUTH = `Basic ${Buffer.from("rzp_test_abc:shh").toString("base64")}`;

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_abc");
  vi.stubEnv("RAZORPAY_KEY_SECRET", "shh");
  vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "hook-secret");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const sentBody = () => JSON.parse(fetchMock.mock.calls[0][1].body);

describe("createRazorpayOrder", () => {
  test("creates an INR order in paise and returns its id", async () => {
    reply(200, { id: "order_123" });
    expect(await createRazorpayOrder(1550, "ML-ABC")).toBe("order_123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(AUTH);
    // ₹1,550 = 155,000 paise
    expect(sentBody()).toEqual({ amount: 155000, currency: "INR", receipt: "ML-ABC", notes: { order: "ML-ABC" } });
  });

  test("rounds rupee amounts with paise to whole paise", async () => {
    reply(200, { id: "order_123" });
    await createRazorpayOrder(19.99, "ML-ABC"); // 19.99 × 100 = 1998.9999… in floating point → 1999
    expect(sentBody().amount).toBe(1999);
  });

  test("passes on Razorpay's error message", async () => {
    reply(400, { error: { description: "Amount exceeds maximum" } });
    await expect(createRazorpayOrder(1550, "ML-ABC")).rejects.toThrow("Razorpay order failed: Amount exceeds maximum");
  });

  test("uses the HTTP status when Razorpay sends no readable error", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => Promise.reject(new Error("not JSON")) });
    await expect(createRazorpayOrder(1550, "ML-ABC")).rejects.toThrow("Razorpay order failed: 502");
  });

  test("a success reply without an order id is treated as a failure", async () => {
    reply(200, {});
    await expect(createRazorpayOrder(1550, "ML-ABC")).rejects.toThrow("Razorpay order failed");
  });

  test("refuses to call Razorpay when the keys are missing", async () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    await expect(createRazorpayOrder(1550, "ML-ABC")).rejects.toThrow("is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchPaymentDetails", () => {
  test("asks Razorpay about the payment, with card details expanded", async () => {
    reply(200, { method: "card" });
    await fetchPaymentDetails("pay_1/2");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/payments/pay_1%2F2?expand[]=card");
    expect(init.headers.Authorization).toBe(AUTH);
  });

  test("a UPI payment records the UPI ID, the app and the reference number", async () => {
    reply(200, { method: "upi", vpa: "9876543210@ybl", acquirer_data: { rrn: "412345678901" } });
    expect(await fetchPaymentDetails("pay_1")).toEqual({
      method: "upi",
      vpa: "9876543210@ybl",
      app: "PhonePe",
      utr: "412345678901",
    });
  });

  test("works out the common UPI apps from the UPI ID ending", async () => {
    const cases: [string, string][] = [
      ["anjali@okhdfcbank", "Google Pay"],
      ["anjali@paytm", "Paytm"],
      ["anjali@ptyes", "Paytm"],
      ["anjali@apl", "Amazon Pay"],
      ["anjali@upi", "BHIM"],
      ["anjali@waicici", "WhatsApp Pay"],
      ["anjali@axisb", "CRED"],
      ["ANJALI@YBL", "PhonePe"], // capital letters don't matter
    ];
    for (const [vpa, app] of cases) {
      reply(200, { method: "upi", vpa });
      expect((await fetchPaymentDetails("pay_1")).app).toBe(app);
    }
  });

  test("an unknown UPI ID ending keeps the UPI ID but names no app", async () => {
    reply(200, { method: "upi", vpa: "anjali@somebank" });
    expect(await fetchPaymentDetails("pay_1")).toEqual({ method: "upi", vpa: "anjali@somebank" });
  });

  test("uses the bank transaction id as the reference when there is no RRN", async () => {
    reply(200, { method: "netbanking", bank: "HDFC", acquirer_data: { rrn: null, bank_transaction_id: "HDF998877" } });
    expect(await fetchPaymentDetails("pay_1")).toEqual({ method: "netbanking", bank: "HDFC", utr: "HDF998877" });
  });

  test("a card payment records only the network and last 4 digits", async () => {
    reply(200, { method: "card", card: { network: "Visa", last4: "4242", name: "Anjali", id: "card_1" } });
    expect(await fetchPaymentDetails("pay_1")).toEqual({ method: "card", card: { network: "Visa", last4: "4242" } });
  });

  test("a wallet payment records the wallet", async () => {
    reply(200, { method: "wallet", wallet: "paytm", vpa: null, card: null });
    expect(await fetchPaymentDetails("pay_1")).toEqual({ method: "wallet", wallet: "paytm" });
  });

  test("fails when Razorpay doesn't answer with a payment method", async () => {
    reply(404, { error: { description: "not found" } });
    await expect(fetchPaymentDetails("pay_1")).rejects.toThrow("Razorpay payment lookup failed: 404");
  });

  test("refuses to call Razorpay when the keys are missing", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    await expect(fetchPaymentDetails("pay_1")).rejects.toThrow("is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("createRefund", () => {
  test("refunds the amount in paise at normal speed, with the receipt", async () => {
    reply(200, { id: "rfnd_1", status: "pending" });
    expect(await createRefund("pay_1", 500.5, "ML-ABC-r1")).toEqual({ id: "rfnd_1", status: "pending" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.razorpay.com/v1/payments/pay_1/refund");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(AUTH);
    // ₹500.50 = 50,050 paise
    expect(sentBody()).toEqual({ amount: 50050, speed: "normal", receipt: "ML-ABC-r1" });
  });

  test("passes on Razorpay's error message", async () => {
    reply(400, { error: { description: "The refund amount exceeds the payment" } });
    await expect(createRefund("pay_1", 99999, "r")).rejects.toThrow("The refund amount exceeds the payment");
  });

  test("uses the HTTP status when Razorpay sends no error message", async () => {
    reply(500, null);
    await expect(createRefund("pay_1", 100, "r")).rejects.toThrow("Razorpay refund failed (500)");
  });

  test("refuses to call Razorpay when the keys are missing", async () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    await expect(createRefund("pay_1", 100, "r")).rejects.toThrow("is not set");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchRefundStatus", () => {
  test("returns the refund's current status", async () => {
    reply(200, { id: "rfnd_1", status: "processed" });
    expect(await fetchRefundStatus("rfnd_1")).toBe("processed");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.razorpay.com/v1/refunds/rfnd_1");
  });

  test("fails when Razorpay can't be asked", async () => {
    reply(401, { error: { description: "auth" } });
    await expect(fetchRefundStatus("rfnd_1")).rejects.toThrow("Razorpay refund lookup failed: 401");
  });
});

describe("isValidPaymentSignature", () => {
  // What Razorpay sends the browser: HMAC-SHA256 of "<order id>|<payment id>" with the key secret
  const signed = createHmac("sha256", "shh").update("order_123|pay_456").digest("hex");

  test("accepts Razorpay's signature", () => {
    expect(isValidPaymentSignature("order_123", "pay_456", signed)).toBe(true);
  });

  test("rejects a signature for a different payment", () => {
    expect(isValidPaymentSignature("order_123", "pay_999", signed)).toBe(false);
  });

  test("rejects a signature made with another secret", () => {
    const forged = createHmac("sha256", "guess").update("order_123|pay_456").digest("hex");
    expect(isValidPaymentSignature("order_123", "pay_456", forged)).toBe(false);
  });

  test("rejects signatures of the wrong length or type without crashing", () => {
    expect(isValidPaymentSignature("order_123", "pay_456", signed.slice(0, 10))).toBe(false);
    expect(isValidPaymentSignature("order_123", "pay_456", "")).toBe(false);
    expect(isValidPaymentSignature("order_123", "pay_456", undefined)).toBe(false);
    expect(isValidPaymentSignature("order_123", "pay_456", 12345)).toBe(false);
  });

  test("rejects everything when the key secret isn't set", () => {
    vi.stubEnv("RAZORPAY_KEY_SECRET", "");
    expect(isValidPaymentSignature("order_123", "pay_456", signed)).toBe(false);
  });
});

describe("isValidWebhookSignature", () => {
  const body = '{"event":"payment.captured"}';
  const signed = createHmac("sha256", "hook-secret").update(body).digest("hex");

  test("accepts a body signed with the webhook secret", () => {
    expect(isValidWebhookSignature(body, signed)).toBe(true);
  });

  test("rejects a body that was changed after signing", () => {
    expect(isValidWebhookSignature('{"event":"refund.processed"}', signed)).toBe(false);
  });

  test("is signed with the webhook secret, not the key secret", () => {
    const withKeySecret = createHmac("sha256", "shh").update(body).digest("hex");
    expect(isValidWebhookSignature(body, withKeySecret)).toBe(false);
  });

  test("rejects a missing signature", () => {
    expect(isValidWebhookSignature(body, null)).toBe(false);
  });

  test("rejects everything when the webhook secret isn't set", () => {
    vi.stubEnv("RAZORPAY_WEBHOOK_SECRET", "");
    expect(isValidWebhookSignature(body, signed)).toBe(false);
  });
});

describe("razorpayKeyId", () => {
  test("is empty when not set", () => {
    vi.stubEnv("RAZORPAY_KEY_ID", undefined);
    expect(razorpayKeyId()).toBe("");
  });
});

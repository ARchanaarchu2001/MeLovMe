import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Razorpay payment gateway (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/).
// Keys: Razorpay Dashboard -> Account & Settings -> API Keys. Test keys (rzp_test_...) take
// fake payments only; swap in live keys (rzp_live_...) once the account is activated.
export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID ?? "";

const safeEqualHex = (expected: string, actual: unknown) =>
  typeof actual === "string" &&
  actual.length === expected.length &&
  timingSafeEqual(Buffer.from(expected), Buffer.from(actual));

// Creates the Razorpay order the customer pays against. `amount` is in rupees.
export async function createRazorpayOrder(amount: number, receipt: string) {
  const keyId = razorpayKeyId();
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET is not set");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    // Razorpay amounts are in paise
    body: JSON.stringify({ amount: Math.round(amount * 100), currency: "INR", receipt, notes: { order: receipt } }),
  });
  const data = (await res.json().catch(() => null)) as { id?: string; error?: { description?: string } } | null;
  if (!res.ok || !data?.id) throw new Error(`Razorpay order failed: ${data?.error?.description ?? res.status}`);
  return data.id;
}

// Proof from the browser that the customer paid: Razorpay signs "<order id>|<payment id>"
// with our key secret, which only Razorpay and our server know.
export function isValidPaymentSignature(razorpayOrderId: string, paymentId: string, signature: unknown) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${razorpayOrderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

// Webhooks are signed over the raw request body with the webhook secret set in the Razorpay Dashboard
export function isValidWebhookSignature(rawBody: string, signature: unknown) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

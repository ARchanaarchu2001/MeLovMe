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

// How an order was paid, saved on the order for the admin panel
export type PaymentDetails = {
  method: string; // "upi" | "card" | "netbanking" | "wallet" | "emi" | "paylater" ...
  app?: string; // UPI app, worked out from the UPI ID (e.g. "PhonePe")
  vpa?: string; // UPI ID that paid, e.g. "98xxxxxx@ybl"
  utr?: string; // UPI/bank reference number (RRN), the one shown in the customer's UPI app
  bank?: string; // netbanking bank code, e.g. "HDFC"
  wallet?: string; // e.g. "paytm"
  card?: { network?: string; last4?: string };
};

// UPI ID endings ("handles") of the common UPI apps
const upiApps: [RegExp, string][] = [
  [/@(ybl|ibl|axl)$/, "PhonePe"],
  [/@ok(axis|hdfcbank|icici|sbi)$/, "Google Pay"],
  [/@(paytm|pt(yes|axis|hdfc|sbi))$/, "Paytm"],
  [/@(apl|yapl|rapl)$/, "Amazon Pay"],
  [/@upi$/, "BHIM"],
  [/@naviaxis$/, "Navi"],
  [/@superyes$/, "super.money"],
  [/@(waicici|waaxis|wahdfcbank|wasbi)$/, "WhatsApp Pay"],
  [/@(fam|famx|famaxis)$/, "FamPay"],
  [/@(axisb)$/, "CRED"],
];
const upiAppFor = (vpa: string) => upiApps.find(([re]) => re.test(vpa.toLowerCase()))?.[1];

// Asks Razorpay how a payment was made (method, UPI app and reference, card type...)
export async function fetchPaymentDetails(paymentId: string): Promise<PaymentDetails> {
  const keyId = razorpayKeyId();
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET is not set");

  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}?expand[]=card`, {
    headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}` },
  });
  const p = (await res.json().catch(() => null)) as {
    method?: string;
    vpa?: string | null;
    bank?: string | null;
    wallet?: string | null;
    acquirer_data?: { rrn?: string | null; bank_transaction_id?: string | null };
    card?: { network?: string; last4?: string } | null;
  } | null;
  if (!res.ok || !p?.method) throw new Error(`Razorpay payment lookup failed: ${res.status}`);

  const details: PaymentDetails = { method: p.method };
  if (p.vpa) {
    details.vpa = p.vpa;
    const app = upiAppFor(p.vpa);
    if (app) details.app = app;
  }
  const utr = p.acquirer_data?.rrn ?? p.acquirer_data?.bank_transaction_id;
  if (utr) details.utr = utr;
  if (p.bank) details.bank = p.bank;
  if (p.wallet) details.wallet = p.wallet;
  if (p.card) details.card = { network: p.card.network, last4: p.card.last4 };
  return details;
}

function authHeader() {
  const keyId = razorpayKeyId();
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) throw new Error("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET is not set");
  return `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`;
}

type RazorpayRefund = { id?: string; status?: "pending" | "processed" | "failed"; error?: { description?: string } };

// Refunds part or all of a payment (https://razorpay.com/docs/api/refunds/create-normal/).
// `amount` is in rupees. The money comes from the Razorpay balance and reaches the customer in
// 5–7 working days; `receipt` stops the same refund being made twice.
export async function createRefund(paymentId: string, amount: number, receipt: string) {
  const res = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ amount: Math.round(amount * 100), speed: "normal", receipt }),
  });
  const data = (await res.json().catch(() => null)) as RazorpayRefund | null;
  if (!res.ok || !data?.id || !data.status) throw new Error(data?.error?.description ?? `Razorpay refund failed (${res.status})`);
  return { id: data.id, status: data.status };
}

// The latest status of a refund, for when the webhook hasn't reported it (e.g. while testing locally)
export async function fetchRefundStatus(refundId: string) {
  const res = await fetch(`https://api.razorpay.com/v1/refunds/${encodeURIComponent(refundId)}`, {
    headers: { Authorization: authHeader() },
  });
  const data = (await res.json().catch(() => null)) as RazorpayRefund | null;
  if (!res.ok || !data?.status) throw new Error(`Razorpay refund lookup failed: ${res.status}`);
  return data.status;
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

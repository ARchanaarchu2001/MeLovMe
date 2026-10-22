import { markOrderPaid } from "@/lib/server/orders";
import { isValidWebhookSignature } from "@/lib/server/razorpay";

type PaymentEvent = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string } };
    order?: { entity?: { id?: string } };
  };
};

// Razorpay calls this when a payment completes, so the order is marked paid even if the
// customer closed the page before checkout could confirm it.
// Set up in Razorpay Dashboard -> Account & Settings -> Webhooks, with the URL ending in a
// slash (https://<your-domain>/api/razorpay/webhook/), the events `payment.captured` and
// `order.paid`, and the same secret as RAZORPAY_WEBHOOK_SECRET.
export async function POST(request: Request) {
  // The signature covers the exact bytes Razorpay sent, so read the raw text before parsing
  const body = await request.text();
  if (!isValidWebhookSignature(body, request.headers.get("x-razorpay-signature"))) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: PaymentEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const payment = event.payload?.payment?.entity;
    const razorpayOrderId = event.payload?.order?.entity?.id ?? payment?.order_id;
    // Razorpay may send the same event more than once; markOrderPaid only acts the first time
    if (razorpayOrderId && payment?.id) await markOrderPaid(razorpayOrderId, payment.id);
  }
  return Response.json({ ok: true });
}

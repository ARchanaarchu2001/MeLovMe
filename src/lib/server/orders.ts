import "server-only";
import { after } from "next/server";
import { site } from "@/data/site";
import { getDb } from "./db";

// Marks the order for this Razorpay order as paid. Called both from checkout (after the
// browser reports the payment) and from Razorpay's webhook, in either order and possibly
// more than once; only the first call changes anything.
export async function markOrderPaid(razorpayOrderId: string, paymentId: string) {
  const { orders } = await getDb();
  const order = await orders.findOneAndUpdate(
    { razorpayOrderId, status: "awaiting_payment" },
    { $set: { status: "paid", paymentId, paidAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!order) return;

  // Optional notification to the shop (e.g. Formspree), sent after the response so the customer
  // isn't kept waiting. `after` keeps serverless hosts (Vercel) running until it finishes.
  // The order is already saved, so failures are only logged.
  if (site.orderEndpoint) {
    const endpoint = site.orderEndpoint;
    after(() =>
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ subject: `New order ${order._id} — ${order.address.name}`, order }),
      }).catch((err) => console.error("Order notification failed", err)),
    );
  }
}

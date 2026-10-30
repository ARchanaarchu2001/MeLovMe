import "server-only";
import { after } from "next/server";
import { site } from "@/data/site";
import type { Refund } from "@/lib/order";
import { getDb, type OrderDoc } from "./db";
import { adjustStock } from "./products";
import { fetchPaymentDetails, fetchRefundStatus } from "./razorpay";

// Marks the order for this Razorpay order as paid. Called both from checkout (after the
// browser reports the payment) and from Razorpay's webhook, in either order and possibly
// more than once; only the first call changes anything.
export async function markOrderPaid(razorpayOrderId: string, paymentId: string) {
  const { orders } = await getDb();
  const order = await orders.findOneAndUpdate(
    { razorpayOrderId, status: "awaiting_payment" },
    { $set: { status: "paid", paymentId, paidAt: new Date(), fulfillment: "placed", stockTaken: true } },
    { returnDocument: "after" },
  );
  if (!order) return;
  // Once per order, since only the first call gets here
  await adjustStock(order.items, -1).catch((err) => console.error("Updating stock failed", order._id, err));

  // After the response, so the customer isn't kept waiting. `after` keeps serverless hosts
  // (Vercel) running until it finishes. The order is already paid, so failures are only logged.
  after(async () => {
    // How they paid (PhonePe, Google Pay, card...), for the admin panel
    try {
      const payment = await fetchPaymentDetails(paymentId);
      await orders.updateOne({ _id: order._id }, { $set: { payment } });
      order.payment = payment;
    } catch (err) {
      console.error("Saving payment details failed", err);
    }
    await notifyShop(order);
  });
}

// Optional notification to the shop for each new order (e.g. Formspree), see site.orderEndpoint
export async function notifyShop(order: OrderDoc) {
  if (!site.orderEndpoint) return;
  const how = order.status === "cod" ? " (cash on delivery)" : "";
  await fetch(site.orderEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ subject: `New order ${order._id}${how} — ${order.address.name}`, order }),
  }).catch((err) => console.error("Order notification failed", err));
}

// Records a refund's new status (from Razorpay's webhook, or a lookup)
export async function setRefundStatus(refundId: string, status: Refund["status"]) {
  await (await getDb()).orders.updateOne(
    { "refunds.id": refundId },
    { $set: { "refunds.$.status": status, "refunds.$.updatedAt": new Date() } },
  );
}

// Asks Razorpay about refunds still "pending" on these orders and saves any change. Only run when
// the admin presses "Check refund status" (the webhook updates them by itself on the live site).
// Returns each refund checked with what Razorpay says now (null: Razorpay couldn't be reached).
export async function syncPendingRefunds(orders: OrderDoc[]) {
  const pending = orders.flatMap((o) => (o.refunds ?? []).filter((r) => r.status === "pending").map((r) => ({ orderId: o._id, refund: r })));
  return Promise.all(
    pending.map(async ({ orderId, refund: r }) => {
      let status: Refund["status"] | null = null;
      try {
        status = await fetchRefundStatus(r.id);
        if (status !== r.status) await setRefundStatus(r.id, status);
      } catch (err) {
        console.error("Checking refund failed", r.id, err);
      }
      return { orderId, refundId: r.id, amount: r.amount, status };
    }),
  );
}

// For revenue totals ($group … $sum): an order's total less what has been refunded (or is on its way)
export const netOfRefunds = {
  $subtract: [
    "$total",
    {
      $sum: {
        $map: {
          input: { $filter: { input: { $ifNull: ["$refunds", []] }, cond: { $ne: ["$$this.status", "failed"] } } },
          in: "$$this.amount",
        },
      },
    },
  ],
};

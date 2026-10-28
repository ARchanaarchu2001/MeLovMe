import "server-only";
import { after } from "next/server";
import { site } from "@/data/site";
import { getDb } from "./db";
import { adjustStock } from "./products";
import { fetchPaymentDetails } from "./razorpay";

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

    // Optional notification to the shop (e.g. Formspree)
    if (site.orderEndpoint) {
      await fetch(site.orderEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ subject: `New order ${order._id} — ${order.address.name}`, order }),
      }).catch((err) => console.error("Order notification failed", err));
    }
  });
}

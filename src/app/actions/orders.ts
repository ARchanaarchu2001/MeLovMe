"use server";

import { getTranslations } from "next-intl/server";
import { placedStatuses } from "@/lib/order";
import { getDb } from "@/lib/server/db";
import { adjustStock } from "@/lib/server/products";
import { requireUser } from "@/lib/server/session";

// The customer cancels their own order, allowed until it ships (Order placed or Packed).
// The items go back in stock. Any refund of an online payment is made by the shop from /admin/orders.
export async function cancelOrder(orderId: string): Promise<{ error: string } | { ok: true }> {
  const user = await requireUser("/orders/");
  const now = new Date();
  const { orders } = await getDb();
  // One update that checks and cancels together, so it can't slip through as the shop ships it
  const before = await orders.findOneAndUpdate(
    {
      _id: String(orderId),
      userId: user._id,
      status: { $in: [...placedStatuses] },
      $or: [{ fulfillment: { $in: ["placed", "packed"] } }, { fulfillment: { $exists: false } }],
    },
    {
      $set: { fulfillment: "cancelled", cancelledBy: "customer", updatedAt: now },
      $push: { statusHistory: { status: "cancelled", at: now } },
    },
    { returnDocument: "before" },
  );
  if (!before) return { error: (await getTranslations("account.order"))("cantCancel") };
  if (before.stockTaken) await adjustStock(before.items, 1).catch((err) => console.error("Restocking failed", before._id, err));
  return { ok: true };
}

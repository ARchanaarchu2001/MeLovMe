import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import CancelOrderButton from "@/components/CancelOrderButton";
import OrderSummary from "@/components/OrderSummary";
import OrderTracker from "@/components/OrderTracker";
import { formatPrice } from "@/lib/format";
import { customerCancellable, isPlaced, refundState } from "@/lib/order";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.order");
  return { title: t("metaTitle"), robots: { index: false } };
}

// Where checkout sends the customer after paying. Only the customer who placed the order can see it.
export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/orders/${encodeURIComponent(id)}/`);
  const order = await (await getDb()).orders.findOne({ _id: id, userId: user._id });
  if (!order) notFound();

  // Paid online, or placed with cash on delivery (still "cod" until the cash is collected)
  const placed = isPlaced(order.status);
  const cod = order.paymentMethod === "cod";
  const a = order.address;
  const t = await getTranslations("account");
  const refund = refundState(order);

  return (
    <section className="mx-auto max-w-2xl px-5 py-12 md:py-20">
      <div className="text-center">
        <p className="eyebrow">{placed ? t("order.eyebrowPaid") : t("order.eyebrowPending")}</p>
        <h1 className="mt-4 text-4xl font-light md:text-5xl">
          {cod ? t("order.titleCod") : placed ? t("order.titlePaid") : t("order.titlePending")}
        </h1>
        <p className="mt-6 text-sm uppercase tracking-[0.2em] text-chocolate/60">{t("order.orderId")}</p>
        <p className="mt-1 text-2xl font-medium text-gold">{order._id}</p>
        <p className="mt-6 leading-relaxed text-chocolate/75">
          {order.status === "cod"
            ? t("order.codText", { amount: formatPrice(order.total), phone: a.phone })
            : placed
              ? t(cod ? "order.codPaidText" : "order.paidText", { amount: formatPrice(order.total), phone: a.phone })
              : t("order.pendingText")}
        </p>
        {refund.refunded > 0 && (
          <p className="mx-auto mt-4 max-w-md rounded-2xl bg-sky-700/10 px-5 py-3 text-sm text-sky-900">
            {refund.pending
              ? t("order.refundInitiated", { amount: formatPrice(refund.refunded) })
              : t("order.refunded", { amount: formatPrice(refund.refunded) })}
          </p>
        )}
      </div>

      {placed && (
        <OrderTracker
          status={order.fulfillment ?? "placed"}
          // COD orders are placed when created; online ones when the payment came in
          placedAt={order.paidAt && !cod ? order.paidAt : order.createdAt}
          history={order.statusHistory ?? []}
          courier={order.courier}
          trackingNumber={order.trackingNumber}
        />
      )}
      {/* Until it ships, the customer can cancel it themselves */}
      {placed && customerCancellable(order.fulfillment) && <CancelOrderButton orderId={order._id} paidOnline={order.status === "paid" && !cod} />}

      <div className="mt-12 grid gap-8 rounded-[2rem] bg-ivory p-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-4 text-sm uppercase tracking-[0.2em]">{t("order.items")}</h2>
          <ul className="space-y-3 text-sm">
            {order.items.map((i) => (
              <li key={i.slug} className="flex justify-between gap-4">
                <span>
                  {i.name} <span className="text-chocolate/60">× {i.qty}</span>
                </span>
                <span>{formatPrice(i.total)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 border-t border-chocolate/15 pt-6">
            <OrderSummary subtotal={order.subtotal} shipping={order.shipping} total={order.total} />
          </div>
        </div>
        <div className="text-sm leading-relaxed">
          <h2 className="mb-4 text-sm uppercase tracking-[0.2em]">{t("order.deliveringTo")}</h2>
          <p className="font-medium">{a.name}</p>
          <p className="text-chocolate/75">
            {a.address}, {a.city}, {a.state} - {a.pincode}
          </p>
          <p className="text-chocolate/75">{t("order.phone", { phone: a.phone })}</p>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-6">
        <Link href="/products/" className="btn btn-primary">{t("order.continueShopping")}</Link>
        <Link href="/orders/" className="text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold">
          {t("order.allOrders")}
        </Link>
      </div>
    </section>
  );
}

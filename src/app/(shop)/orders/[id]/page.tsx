import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import OrderSummary from "@/components/OrderSummary";
import { formatPrice } from "@/lib/format";
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

  const paid = order.status === "paid";
  const a = order.address;
  const t = await getTranslations("account");

  return (
    <section className="mx-auto max-w-2xl px-5 py-12 md:py-20">
      <div className="text-center">
        <p className="eyebrow">{paid ? t("order.eyebrowPaid") : t("order.eyebrowPending")}</p>
        <h1 className="mt-4 text-4xl font-light md:text-5xl">{paid ? t("order.titlePaid") : t("order.titlePending")}</h1>
        <p className="mt-6 text-sm uppercase tracking-[0.2em] text-chocolate/60">{t("order.orderId")}</p>
        <p className="mt-1 text-2xl font-medium text-gold">{order._id}</p>
        <p className="mt-6 leading-relaxed text-chocolate/75">
          {paid
            ? t("order.paidText", { amount: formatPrice(order.total), phone: a.phone })
            : t("order.pendingText")}
        </p>
        {paid && (
          <div className="mt-8 inline-block rounded-2xl border border-chocolate/15 px-6 py-4 text-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-chocolate/60">{t("order.status")}</p>
            <p className={`mt-1 font-medium ${order.fulfillment === "cancelled" ? "text-red-700" : ""}`}>
              {t(`status.${order.fulfillment ?? "placed"}`)}
            </p>
            {order.trackingNumber && (
              <p className="mt-2 text-chocolate/75">
                {order.courier ? `${order.courier} · ` : ""}
                {t("order.tracking", { number: order.trackingNumber })}
              </p>
            )}
          </div>
        )}
      </div>

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

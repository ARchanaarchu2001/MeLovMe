import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { placedStatuses } from "@/lib/order";
import { getDb } from "@/lib/server/db";
import { getCatalog } from "@/lib/server/products";
import { requireUser } from "@/lib/server/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account.orders");
  return { title: t("metaTitle"), robots: { index: false } };
}

const orderDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

// The customer's paid orders, newest first. Unpaid ones (payment window closed) are left out.
export default async function OrdersPage() {
  const user = await requireUser("/orders/");
  const orders = await (await getDb()).orders
    .find({ userId: user._id, status: { $in: [...placedStatuses] } })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  const catalog = await getCatalog();
  const t = await getTranslations("account");

  return (
    <section className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
      <p className="eyebrow">{t("eyebrow")}</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">{t("orders.title")}</h1>

      {orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-chocolate/70">{t("orders.empty")}</p>
          <Link href="/products/" className="btn btn-primary mt-8">{t("orders.shopProducts")}</Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {orders.map((o) => {
            // Orders keep their own image; older ones fall back to the current product image
            const image = o.items[0]?.image ?? catalog.find((p) => p.slug === o.items[0]?.slug)?.images[0];
            const status = o.fulfillment ?? "placed";
            const count = o.items.reduce((sum, i) => sum + i.qty, 0);
            return (
              <li key={o._id}>
                <Link
                  href={`/orders/${o._id}/`}
                  className="flex items-center gap-5 rounded-[2rem] border border-chocolate/15 p-5 transition-colors hover:border-gold"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-ivory">
                    {image && <Image src={image} alt="" fill sizes="80px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="font-medium">{o._id}</p>
                      <p className="font-medium text-gold">{formatPrice(o.total)}</p>
                    </div>
                    <p className="mt-1 truncate text-sm text-chocolate/70">
                      {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-chocolate/60">
                      <span>{orderDate.format(o.paidAt ?? o.createdAt)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t("orders.itemCount", { count })}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 uppercase tracking-[0.15em] ${
                          status === "cancelled" ? "bg-red-700/10 text-red-800" : "bg-gold/15 text-chocolate"
                        }`}
                      >
                        {t(`status.${status}`)}
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

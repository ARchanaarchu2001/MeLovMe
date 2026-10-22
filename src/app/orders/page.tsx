import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getProduct } from "@/data/products";
import { formatPrice } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "My Orders",
  robots: { index: false },
};

const orderDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

// The customer's paid orders, newest first. Unpaid ones (payment window closed) are left out.
export default async function OrdersPage() {
  const user = await requireUser("/orders/");
  const orders = await (await getDb()).orders
    .find({ userId: user._id, status: "paid" })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return (
    <section className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
      <p className="eyebrow">My Account</p>
      <h1 className="mb-10 mt-4 text-4xl font-light md:text-5xl">My Orders</h1>

      {orders.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-chocolate/70">You haven&apos;t placed any orders yet.</p>
          <Link href="/products/" className="btn btn-primary mt-8">Shop Products</Link>
        </div>
      ) : (
        <ul className="space-y-5">
          {orders.map((o) => {
            const first = getProduct(o.items[0]?.slug ?? "");
            const count = o.items.reduce((sum, i) => sum + i.qty, 0);
            return (
              <li key={o._id}>
                <Link
                  href={`/orders/${o._id}/`}
                  className="flex items-center gap-5 rounded-[2rem] border border-chocolate/15 p-5 transition-colors hover:border-gold"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-ivory">
                    {first && <Image src={first.images[0]} alt="" fill sizes="80px" className="object-cover" />}
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
                      <span>
                        {count} item{count === 1 ? "" : "s"}
                      </span>
                      <span className="rounded-full bg-gold/15 px-2.5 py-0.5 uppercase tracking-[0.15em] text-chocolate">Paid</span>
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

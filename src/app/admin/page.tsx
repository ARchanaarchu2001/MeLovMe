import type { Metadata } from "next";
import Link from "next/link";
import { FulfillmentBadge, Stat, daysAgo, formatDateTime, startOfTodayIndia } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { getDb, type OrderDoc } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Dashboard" };

// Where admins land after logging in: today's numbers, what needs shipping, latest orders
export default async function AdminDashboard() {
  const me = await requireAdmin();
  const { orders, users, products } = await getDb();
  const today = startOfTodayIndia();
  const monthAgo = daysAgo(30);
  // Paid orders that count as sales (cancelled ones don't)
  const sales = { status: "paid" as const, fulfillment: { $ne: "cancelled" as const } };
  const sumTotal = (since: Date) =>
    orders
      .aggregate<{ total: number; count: number }>([
        { $match: { ...sales, paidAt: { $gte: since } } },
        { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
      ])
      .toArray()
      .then((r) => r[0] ?? { total: 0, count: 0 });

  const [todaySales, monthSales, toShip, newCustomers, totalCustomers, productsOn, productsAll, recent] = await Promise.all([
    sumTotal(today),
    sumTotal(monthAgo),
    orders.find({ status: "paid", fulfillment: { $in: ["placed", "packed"] } }).sort({ paidAt: 1 }).limit(10).toArray(),
    users.countDocuments({ createdAt: { $gte: daysAgo(7) } }),
    users.countDocuments(),
    products.countDocuments({ enabled: true }),
    products.countDocuments(),
    orders.find({ status: "paid" }).sort({ paidAt: -1 }).limit(8).toArray(),
  ]);
  const toShipCount = await orders.countDocuments({ status: "paid", fulfillment: { $in: ["placed", "packed"] } });

  return (
    <div className="grid gap-8">
      <p className="text-chocolate/70">Welcome back, {me.name}.</p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="To ship" value={String(toShipCount)} note="Paid, not yet shipped" href="/admin/orders/?view=paid" />
        <Stat label="Today" value={formatPrice(todaySales.total)} note={`${todaySales.count} order${todaySales.count === 1 ? "" : "s"}`} />
        <Stat label="Last 30 days" value={formatPrice(monthSales.total)} note={`${monthSales.count} order${monthSales.count === 1 ? "" : "s"}`} />
        <Stat label="Customers" value={String(totalCustomers)} note={`${newCustomers} new this week`} href="/admin/customers/" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-chocolate/15 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-chocolate/60">Needs shipping (oldest first)</h2>
            <Link href="/admin/orders/?view=paid" className="text-xs uppercase tracking-[0.15em] text-gold hover:underline">All orders</Link>
          </div>
          {toShip.length === 0 ? (
            <p className="py-6 text-center text-sm text-chocolate/60">Nothing to ship right now.</p>
          ) : (
            <OrderRows orders={toShip} />
          )}
        </section>

        <section className="rounded-2xl border border-chocolate/15 p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xs uppercase tracking-[0.2em] text-chocolate/60">Latest orders</h2>
            <Link href="/admin/orders/" className="text-xs uppercase tracking-[0.15em] text-gold hover:underline">View all</Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-chocolate/60">No orders yet.</p>
          ) : (
            <OrderRows orders={recent} />
          )}
        </section>
      </div>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ivory px-6 py-5">
        <p className="text-sm">
          <strong>{productsOn}</strong> of {productsAll} product{productsAll === 1 ? "" : "s"} shown in the shop
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/products/" className="btn btn-outline !px-5 !py-2.5">Manage products</Link>
          <Link href="/admin/products/new/" className="btn btn-primary !px-5 !py-2.5">+ Add product</Link>
        </div>
      </section>
    </div>
  );
}

function OrderRows({ orders }: { orders: OrderDoc[] }) {
  return (
    <ul className="divide-y divide-chocolate/10 text-sm">
      {orders.map((o) => (
        <li key={o._id}>
          <Link href={`/admin/orders/${o._id}/`} className="flex flex-wrap items-center justify-between gap-3 py-3 hover:text-gold">
            <span>
              <span className="font-medium">{o._id}</span>
              <span className="block text-xs text-chocolate/60">
                {o.address.name} · {formatDateTime(o.paidAt ?? o.createdAt)}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="font-medium">{formatPrice(o.total)}</span>
              <FulfillmentBadge status={o.fulfillment ?? "placed"} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

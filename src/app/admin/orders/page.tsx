import type { Metadata } from "next";
import Link from "next/link";
import type { Filter } from "mongodb";
import RefundStatusButton from "@/components/admin/RefundStatusButton";
import { FulfillmentBadge, Pagination, PaymentBadge, RefundBadge, SearchBox, Stat, formatDateTime, paymentLabel, searchRegex } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { isPlaced, placedStatuses } from "@/lib/order";
import { getDb, type OrderDoc } from "@/lib/server/db";
import { netOfRefunds } from "@/lib/server/orders";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Orders" };

const placed = { $in: [...placedStatuses] };
// Tabs go by the order's status (paid / cash on delivery / awaiting payment), not how it was paid:
// a COD order moves from "Cash on delivery" to "Paid" once the cash is marked as received.
const views = [
  // Every order, whatever its status
  { key: "orders", label: "Orders", filter: {} },
  // Money received (online, or COD cash collected), not cancelled
  { key: "paid", label: "Paid", filter: { status: "paid", fulfillment: { $ne: "cancelled" } } },
  // Cash still to collect: cancelled ones are left out, as there's nothing to collect
  { key: "cod", label: "Cash on delivery", filter: { status: "cod", fulfillment: { $ne: "cancelled" } } },
  { key: "awaiting", label: "Awaiting payment", filter: { status: "awaiting_payment" } },
  { key: "cancelled", label: "Cancelled", filter: { status: placed, fulfillment: "cancelled" } },
  { key: "refunds", label: "Refunds", filter: { "refunds.0": { $exists: true } } },
] as const satisfies readonly { key: string; label: string; filter: Filter<OrderDoc> }[];

const PAGE_SIZE = 10;

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin("/admin/orders/");
  const sp = await searchParams;
  const view = views.find((v) => v.key === sp.view) ?? views[0];
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);

  // Search by order ID, customer name or phone
  const filter: Filter<OrderDoc> = { ...view.filter };
  if (q) {
    const re = searchRegex(q);
    filter.$or = [{ _id: re }, { "address.name": re }, { "address.phone": re }];
  }

  const { orders, users } = await getDb();
  const [list, total, counts, revenue, pendingRefunds] = await Promise.all([
    orders.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    orders.countDocuments(filter),
    Promise.all(views.map((v) => orders.countDocuments(v.filter))),
    // Money received: paid orders, not cancelled, less refunds
    orders
      .aggregate<{ total: number }>([
        { $match: { status: "paid", fulfillment: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: netOfRefunds } } },
      ])
      .toArray(),
    // Orders with a refund Razorpay hasn't finished, for "Check refund status"
    view.key === "refunds" ? orders.countDocuments({ "refunds.status": "pending" }) : 0,
  ]);
  // The account (login phone) behind each order
  const customers = new Map(
    (await users.find({ _id: { $in: list.map((o) => o.userId) } }, { projection: { name: 1, phone: 1 } }).toArray()).map((u) => [
      u._id.toHexString(),
      u,
    ]),
  );
  const href = (params: Record<string, string | number>) =>
    `/admin/orders/?${new URLSearchParams({ view: view.key, ...(q && { q }), ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })}`;

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:mb-6 md:gap-4 [&>:last-child]:col-span-2 sm:[&>:last-child]:col-span-1">
        <Stat label="Paid orders" value={String(counts[1])} note="Paid online, or cash collected" href={href({ view: "paid" })} />
        <Stat label="Cash to collect" value={String(counts[2])} note="Cash on delivery, not collected yet" href={href({ view: "cod" })} />
        <Stat label="Revenue" value={formatPrice(revenue[0]?.total ?? 0)} note="Money received, less refunds" />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 md:mb-6 md:gap-4">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {views.map((v, i) => (
            <Link
              key={v.key}
              href={`/admin/orders/?view=${v.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.15em] ${
                v.key === view.key ? "bg-gold/25 text-chocolate" : "text-chocolate/60 hover:text-gold"
              }`}
            >
              {v.label} ({counts[i]})
            </Link>
          ))}
        </div>
        <SearchBox action="/admin/orders/" q={q} placeholder="Order ID, name or phone" hidden={{ view: view.key }} />
      </div>

      {view.key === "refunds" && (
        <div className="mb-6 rounded-2xl bg-ivory/70 px-5 py-4">
          <RefundStatusButton pending={pendingRefunds} />
          <p className="mt-2 text-xs text-chocolate/60">
            Asks Razorpay for the latest status of refunds still shown as &ldquo;Refund initiated&rdquo;. On the live site Razorpay also
            updates them by itself.
          </p>
        </div>
      )}

      {list.length === 0 ? (
        <p className="py-16 text-center text-chocolate/60">No orders found.</p>
      ) : (
        <>
        {/* Phones: one card per order */}
        <ul className="grid gap-3 md:hidden">
          {list.map((o) => {
            const account = customers.get(o.userId.toHexString());
            return (
              <li key={o._id}>
                <Link href={`/admin/orders/${o._id}/`} className="block rounded-2xl border border-chocolate/15 p-4 text-sm active:bg-ivory/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gold">{o._id}</p>
                      <p className="text-xs text-chocolate/60">{formatDateTime(o.createdAt)}</p>
                    </div>
                    <p className="shrink-0 font-medium">{formatPrice(o.total)}</p>
                  </div>
                  <p className="mt-2">
                    {o.address.name}
                    <span className="text-xs text-chocolate/60"> · {account ? `+91 ${account.phone}` : o.address.phone}</span>
                  </p>
                  <p className="text-xs text-chocolate/60">
                    {o.items.reduce((n, i) => n + i.qty, 0)} item(s){o.payment && <> · {paymentLabel(o.payment)}</>}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <PaymentBadge status={o.status} />
                    <RefundBadge order={o} />
                    {isPlaced(o.status) && <FulfillmentBadge status={o.fulfillment ?? "placed"} />}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto rounded-2xl border border-chocolate/15 md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-ivory text-xs uppercase tracking-[0.15em] text-chocolate/60">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chocolate/10">
              {list.map((o) => {
                const account = customers.get(o.userId.toHexString());
                return (
                  <tr key={o._id} className="hover:bg-ivory/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${o._id}/`} className="font-medium text-gold hover:underline">
                        {o._id}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-chocolate/75">{formatDateTime(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p>{o.address.name}</p>
                      <p className="text-xs text-chocolate/60">{account ? `+91 ${account.phone}` : o.address.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-chocolate/75">{o.items.reduce((n, i) => n + i.qty, 0)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatPrice(o.total)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <PaymentBadge status={o.status} />
                        <RefundBadge order={o} />
                      </div>
                      {o.payment && <p className="mt-1 whitespace-nowrap text-xs text-chocolate/70">{paymentLabel(o.payment)}</p>}
                    </td>
                    <td className="px-4 py-3">{isPlaced(o.status) ? <FulfillmentBadge status={o.fulfillment ?? "placed"} /> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => href({ page: p })} />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import type { Filter } from "mongodb";
import { FulfillmentBadge, Pagination, PaymentBadge, SearchBox, Stat, formatDateTime, paymentLabel, searchRegex } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { getDb, type OrderDoc } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Orders" };

const views = [
  { key: "paid", label: "Paid", filter: { status: "paid", fulfillment: { $ne: "cancelled" } } },
  { key: "awaiting", label: "Awaiting payment", filter: { status: "awaiting_payment" } },
  { key: "cancelled", label: "Cancelled", filter: { status: "paid", fulfillment: "cancelled" } },
  { key: "all", label: "All", filter: {} },
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
  const [list, total, counts, revenue] = await Promise.all([
    orders.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    orders.countDocuments(filter),
    Promise.all(views.map((v) => orders.countDocuments(v.filter))),
    orders.aggregate<{ total: number }>([{ $match: { status: "paid", fulfillment: { $ne: "cancelled" } } }, { $group: { _id: null, total: { $sum: "$total" } } }]).toArray(),
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
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Paid orders" value={String(counts[0])} />
        <Stat label="Awaiting payment" value={String(counts[1])} />
        <Stat label="Revenue (paid, not cancelled)" value={formatPrice(revenue[0]?.total ?? 0)} />
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {views.map((v, i) => (
            <Link
              key={v.key}
              href={`/admin/orders/?view=${v.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.15em] ${
                v.key === view.key ? "bg-gold/25 text-chocolate" : "text-chocolate/60 hover:text-gold"
              }`}
            >
              {v.label} ({counts[i]})
            </Link>
          ))}
        </div>
        <SearchBox action="/admin/orders/" q={q} placeholder="Order ID, name or phone" hidden={{ view: view.key }} />
      </div>

      {list.length === 0 ? (
        <p className="py-16 text-center text-chocolate/60">No orders found.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-chocolate/15">
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
                      <PaymentBadge status={o.status} />
                      {o.payment && <p className="mt-1 whitespace-nowrap text-xs text-chocolate/70">{paymentLabel(o.payment)}</p>}
                    </td>
                    <td className="px-4 py-3">{o.status === "paid" ? <FulfillmentBadge status={o.fulfillment ?? "placed"} /> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={(p) => href({ page: p })} />
    </div>
  );
}

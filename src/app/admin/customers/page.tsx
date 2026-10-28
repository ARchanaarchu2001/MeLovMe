import type { Metadata } from "next";
import Link from "next/link";
import type { Filter } from "mongodb";
import { AdminBadge, Pagination, SearchBox, daysAgo, formatDate, searchRegex } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { getDb, type UserDoc } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 10;

// Everyone who has an account, newest first, with what they've bought. "Admins" lists users with superAdmin: true.
export default async function AdminCustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin("/admin/customers/");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const admins = sp.view === "admins";

  const filter: Filter<UserDoc> = {
    ...(q && { $or: [{ name: searchRegex(q) }, { phone: searchRegex(q) }] }),
    ...(admins && { superAdmin: true }),
  };
  const { users, orders } = await getDb();
  const [list, total, newThisWeek] = await Promise.all([
    users.find(filter, { projection: { name: 1, phone: 1, superAdmin: 1, createdAt: 1, addresses: 1 } }).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).toArray(),
    users.countDocuments(filter),
    users.countDocuments({ createdAt: { $gte: daysAgo(7) } }),
  ]);

  // Paid orders and spend per customer on this page
  const stats = new Map(
    (
      await orders
        .aggregate<{ _id: UserDoc["_id"]; count: number; spent: number; last: Date }>([
          { $match: { userId: { $in: list.map((u) => u._id) }, status: "paid" } },
          { $group: { _id: "$userId", count: { $sum: 1 }, spent: { $sum: "$total" }, last: { $max: "$paidAt" } } },
        ])
        .toArray()
    ).map((s) => [s._id.toHexString(), s]),
  );
  const href = (p: number) =>
    `/admin/customers/?${new URLSearchParams({ ...(q && { q }), ...(admins && { view: "admins" }), page: String(p) })}`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex gap-2">
            {[
              { label: "Everyone", href: "/admin/customers/", active: !admins },
              { label: "Admins", href: "/admin/customers/?view=admins", active: admins },
            ].map((t) => (
              <Link
                key={t.label}
                href={t.href}
                className={`rounded-full px-4 py-1.5 text-xs uppercase tracking-[0.15em] ${
                  t.active ? "bg-gold/25 text-chocolate" : "text-chocolate/60 hover:text-gold"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <p className="text-sm text-chocolate/70">
            <strong className="text-chocolate">{total}</strong> {admins ? "admin" : "customer"}
            {total === 1 ? "" : "s"}
            {!q && !admins && <> · {newThisWeek} new in the last 7 days</>}
          </p>
        </div>
        <SearchBox action="/admin/customers/" q={q} placeholder="Name or phone" hidden={admins ? { view: "admins" } : {}} />
      </div>

      {list.length === 0 ? (
        <p className="py-16 text-center text-chocolate/60">No customers found.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-chocolate/15">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-ivory text-xs uppercase tracking-[0.15em] text-chocolate/60">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 text-right font-medium">Orders</th>
                <th className="px-4 py-3 text-right font-medium">Spent</th>
                <th className="px-4 py-3 font-medium">Last order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-chocolate/10">
              {list.map((u) => {
                const s = stats.get(u._id.toHexString());
                const city = u.addresses.at(-1)?.city;
                return (
                  <tr key={u._id.toHexString()} className="hover:bg-ivory/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${u._id.toHexString()}/`} className="font-medium text-gold hover:underline">
                        {u.name}
                      </Link>
                      {u.superAdmin && (
                        <span className="ml-2">
                          <AdminBadge />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">+91 {u.phone}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-chocolate/75">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-chocolate/75">{city ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{s?.count ?? 0}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatPrice(s?.spent ?? 0)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-chocolate/75">{s?.last ? formatDate(s.last) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} href={href} />
    </div>
  );
}

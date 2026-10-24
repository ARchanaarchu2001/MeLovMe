import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { AdminBadge, FulfillmentBadge, PaymentBadge, formatDate, formatDateTime } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Customer" };

const box = "rounded-2xl border border-chocolate/15 p-6";
const heading = "mb-4 text-xs uppercase tracking-[0.2em] text-chocolate/60";

export default async function AdminCustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/customers/${encodeURIComponent(id)}/`);
  if (!ObjectId.isValid(id) || id.length !== 24) notFound();

  const { users, orders } = await getDb();
  const user = await users.findOne({ _id: new ObjectId(id) });
  if (!user) notFound();
  const list = await orders.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100).toArray();
  const paid = list.filter((o) => o.status === "paid");

  return (
    <div>
      <Link href="/admin/customers/" className="text-xs uppercase tracking-[0.15em] text-chocolate/60 hover:text-gold">
        ← All customers
      </Link>
      <div className="mb-8 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-medium">{user.name}</h2>
          {user.superAdmin && <AdminBadge />}
        </div>
        <p className="mt-1 text-sm text-chocolate/70">
          <a href={`tel:+91${user.phone}`} className="text-gold hover:underline">+91 {user.phone}</a> · Joined {formatDate(user.createdAt)} ·{" "}
          {paid.length} paid order{paid.length === 1 ? "" : "s"} · {formatPrice(paid.reduce((n, o) => n + o.total, 0))} spent
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className={`${box} h-fit`}>
          <h3 className={heading}>Orders</h3>
          {list.length === 0 ? (
            <p className="text-sm text-chocolate/60">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-chocolate/10 text-sm">
              {list.map((o) => (
                <li key={o._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/admin/orders/${o._id}/`} className="font-medium text-gold hover:underline">{o._id}</Link>
                    <p className="text-xs text-chocolate/60">
                      {formatDateTime(o.createdAt)} · {o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatPrice(o.total)}</span>
                    <PaymentBadge status={o.status} />
                    {o.status === "paid" && <FulfillmentBadge status={o.fulfillment ?? "placed"} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid h-fit gap-6">
          <div className={`${box} text-sm leading-relaxed`}>
            <h3 className={heading}>Saved addresses</h3>
            {user.addresses.length === 0 ? (
              <p className="text-chocolate/60">None yet.</p>
            ) : (
              <ul className="space-y-4">
                {user.addresses.map((a) => (
                  <li key={a._id.toHexString()}>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-chocolate/75">{a.address}, {a.city}, {a.state} - {a.pincode}</p>
                    <p className="text-chocolate/75">Phone: {a.phone}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

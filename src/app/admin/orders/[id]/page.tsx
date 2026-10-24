import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OrderSummary from "@/components/OrderSummary";
import OrderUpdateForm from "@/components/admin/OrderUpdateForm";
import { PaymentBadge, formatDateTime, paymentLabel } from "@/components/admin/ui";
import { formatPrice } from "@/lib/format";
import { getDb } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Order" };

const box = "rounded-2xl border border-chocolate/15 p-6";
const heading = "mb-4 text-xs uppercase tracking-[0.2em] text-chocolate/60";

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const { id } = await params;
  await requireAdmin(`/admin/orders/${encodeURIComponent(id)}/`);
  const { orders, users } = await getDb();
  const order = await orders.findOne({ _id: id });
  if (!order) notFound();
  const customer = await users.findOne({ _id: order.userId }, { projection: { name: 1, phone: 1 } });
  const a = order.address;

  return (
    <div>
      <Link href="/admin/orders/" className="text-xs uppercase tracking-[0.15em] text-chocolate/60 hover:text-gold">
        ← All orders
      </Link>
      <div className="mb-8 mt-4 flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-medium">{order._id}</h2>
        <PaymentBadge status={order.status} />
        <span className="text-sm text-chocolate/60">Placed {formatDateTime(order.createdAt)}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="grid h-fit gap-6">
          <div className={box}>
            <h3 className={heading}>Items</h3>
            <ul className="mb-6 space-y-3 border-b border-chocolate/15 pb-6 text-sm">
              {order.items.map((i) => (
                <li key={i.slug} className="flex justify-between gap-4">
                  <span>
                    {i.name} <span className="text-chocolate/60">({i.size}) × {i.qty} @ {formatPrice(i.price)}</span>
                  </span>
                  <span>{formatPrice(i.total)}</span>
                </li>
              ))}
            </ul>
            <OrderSummary subtotal={order.subtotal} shipping={order.shipping} total={order.total} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className={`${box} text-sm leading-relaxed`}>
              <h3 className={heading}>Ship to</h3>
              <p className="font-medium">{a.name}</p>
              <p className="text-chocolate/75">{a.address}</p>
              <p className="text-chocolate/75">
                {a.city}, {a.state} - {a.pincode}
              </p>
              <p className="mt-2">
                Phone: <a href={`tel:+91${a.phone}`} className="text-gold hover:underline">{a.phone}</a>
              </p>
            </div>
            <div className={`${box} text-sm leading-relaxed`}>
              <h3 className={heading}>Customer account</h3>
              {customer ? (
                <>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-chocolate/75">+91 {customer.phone}</p>
                  <Link href={`/admin/customers/${customer._id.toHexString()}/`} className="mt-2 inline-block text-gold hover:underline">
                    View customer →
                  </Link>
                </>
              ) : (
                <p className="text-chocolate/60">Account deleted</p>
              )}
            </div>
          </div>

          <div className={`${box} text-sm leading-relaxed`}>
            <h3 className={heading}>Payment</h3>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="text-chocolate/60">Status</dt>
              <dd><PaymentBadge status={order.status} /></dd>
              <dt className="text-chocolate/60">Paid at</dt>
              <dd>{order.paidAt ? formatDateTime(order.paidAt) : "—"}</dd>
              {order.payment && (
                <>
                  <dt className="text-chocolate/60">Paid with</dt>
                  <dd className="font-medium">{paymentLabel(order.payment)}</dd>
                  {order.payment.vpa && (
                    <>
                      <dt className="text-chocolate/60">UPI ID</dt>
                      <dd className="break-all">{order.payment.vpa}</dd>
                    </>
                  )}
                  {order.payment.utr && (
                    <>
                      <dt className="text-chocolate/60">UPI / bank ref (UTR)</dt>
                      <dd className="break-all font-mono text-xs">{order.payment.utr}</dd>
                    </>
                  )}
                </>
              )}
              <dt className="text-chocolate/60">Razorpay payment ID</dt>
              <dd className="break-all font-mono text-xs">{order.paymentId ?? "—"}</dd>
              <dt className="text-chocolate/60">Razorpay order ID</dt>
              <dd className="break-all font-mono text-xs">{order.razorpayOrderId ?? "—"}</dd>
            </dl>
            {order.paymentId && (
              <a
                href={`https://dashboard.razorpay.com/app/payments/${order.paymentId}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-gold hover:underline"
              >
                Open in Razorpay Dashboard ↗
              </a>
            )}
          </div>
        </div>

        <div className={`${box} h-fit`}>
          <h3 className={heading}>Update order</h3>
          {order.status === "paid" ? (
            <OrderUpdateForm
              orderId={order._id}
              initial={{
                fulfillment: order.fulfillment ?? "placed",
                courier: order.courier ?? "",
                trackingNumber: order.trackingNumber ?? "",
                adminNote: order.adminNote ?? "",
              }}
            />
          ) : (
            <p className="text-sm text-chocolate/70">
              This order hasn&apos;t been paid, so there&apos;s nothing to ship. It stays here as a record of the attempt.
            </p>
          )}
          {order.updatedAt && <p className="mt-4 text-xs text-chocolate/50">Last updated {formatDateTime(order.updatedAt)}</p>}
        </div>
      </div>
    </div>
  );
}

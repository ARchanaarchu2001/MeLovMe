"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { updateOrder } from "@/app/actions/admin";
import { fulfillmentLabels, fulfillments, type Fulfillment } from "@/lib/order";

const input = "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold";
const label = "mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60";

// Delivery status, courier/tracking (shown to the customer) and a private note
export default function OrderUpdateForm({
  orderId,
  initial,
}: {
  orderId: string;
  initial: { fulfillment: Fulfillment; courier: string; trackingNumber: string; adminNote: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues({ ...values, [k]: e.target.value });
    setMessage(null);
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (values.fulfillment === "cancelled" && initial.fulfillment !== "cancelled" &&
      !window.confirm("Mark this order as cancelled? Remember to refund the payment in the Razorpay Dashboard.")) return;
    startTransition(async () => {
      const res = await updateOrder(orderId, values);
      if ("error" in res) return setMessage({ text: res.error, error: true });
      setMessage({ text: "Saved." });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div>
        <label htmlFor="fulfillment" className={label}>Status</label>
        <select id="fulfillment" value={values.fulfillment} onChange={set("fulfillment")} className={input}>
          {fulfillments.map((f) => (
            <option key={f} value={f}>{fulfillmentLabels[f]}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="courier" className={label}>Courier</label>
          <input id="courier" value={values.courier} onChange={set("courier")} placeholder="e.g. Delhivery" className={input} />
        </div>
        <div>
          <label htmlFor="tracking" className={label}>Tracking number</label>
          <input id="tracking" value={values.trackingNumber} onChange={set("trackingNumber")} className={input} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-chocolate/60">The status, courier and tracking number are shown to the customer.</p>
      <div>
        <label htmlFor="note" className={label}>Private note</label>
        <textarea id="note" value={values.adminNote} onChange={set("adminNote")} rows={3} placeholder="Only visible to admins" className={input} />
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        {message && (
          <p className={`text-sm ${message.error ? "text-red-700" : "text-green-800"}`} role="status">{message.text}</p>
        )}
      </div>
    </form>
  );
}

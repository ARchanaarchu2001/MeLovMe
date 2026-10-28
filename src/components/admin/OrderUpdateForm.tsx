"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { updateOrder } from "@/app/actions/admin";
import { orderLimits, validateOrderUpdate, type OrderUpdateErrors } from "@/lib/admin-validation";
import { fulfillmentLabels, type Fulfillment } from "@/lib/order";
import Spinner from "@/components/Spinner";

const input =
  "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold aria-invalid:border-red-700";
const label = "mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60";

// The delivery steps, in order; "cancelled" is offered separately below them
const steps: { value: Exclude<Fulfillment, "cancelled">; hint: string }[] = [
  { value: "placed", hint: "Paid, waiting to be packed" },
  { value: "packed", hint: "Packed, ready for the courier" },
  { value: "shipped", hint: "Handed to the courier" },
  { value: "delivered", hint: "Received by the customer" },
];

const check = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

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
  const [errors, setErrors] = useState<OrderUpdateErrors>({});
  const [pending, startTransition] = useTransition();
  const set = (k: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues({ ...values, [k]: e.target.value });
    setErrors({ ...errors, [k]: undefined, ...(k === "trackingNumber" && { courier: undefined }) });
    setMessage(null);
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validateOrderUpdate(values);
    setErrors(found);
    if (Object.keys(found).length) return setMessage({ text: "Please fix the highlighted fields.", error: true });
    if (values.fulfillment === "cancelled" && initial.fulfillment !== "cancelled" &&
      !window.confirm("Mark this order as cancelled? Remember to refund the payment in the Razorpay Dashboard.")) return;
    startTransition(async () => {
      const res = await updateOrder(orderId, values);
      if ("error" in res) {
        setErrors(res.errors ?? {});
        return setMessage({ text: res.error, error: true });
      }
      setMessage({ text: "Saved." });
      router.refresh();
    });
  }

  const error = (k: keyof OrderUpdateErrors) => errors[k] && <p className="mt-1.5 text-xs text-red-700">{errors[k]}</p>;

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <fieldset>
        <legend className={label}>Status</legend>
        <StatusPicker
          value={values.fulfillment}
          onChange={(fulfillment) => {
            setValues({ ...values, fulfillment });
            setMessage(null);
          }}
        />
        {values.fulfillment !== initial.fulfillment && (
          <p className="mt-2 text-xs text-gold">
            Changing from {fulfillmentLabels[initial.fulfillment]} to {fulfillmentLabels[values.fulfillment]} — click Save changes.
          </p>
        )}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="courier" className={label}>Courier</label>
          <input id="courier" value={values.courier} onChange={set("courier")} maxLength={orderLimits.courier} placeholder="e.g. Delhivery" aria-invalid={!!errors.courier} className={input} />
          {error("courier")}
        </div>
        <div>
          <label htmlFor="tracking" className={label}>Tracking number</label>
          <input id="tracking" value={values.trackingNumber} onChange={set("trackingNumber")} maxLength={orderLimits.trackingNumber} aria-invalid={!!errors.trackingNumber} className={input} />
          {error("trackingNumber")}
        </div>
      </div>
      <p className="-mt-2 text-xs text-chocolate/60">The status, courier and tracking number are shown to the customer.</p>
      <div>
        <label htmlFor="note" className={label}>Private note</label>
        <textarea id="note" value={values.adminNote} onChange={set("adminNote")} rows={3} maxLength={orderLimits.adminNote} placeholder="Only visible to admins" aria-invalid={!!errors.adminNote} className={input} />
        {error("adminNote")}
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />}
          {pending ? "Saving…" : "Save changes"}
        </button>
        {message && (
          <p className={`text-sm ${message.error ? "text-red-700" : "text-green-800"}`} role="status">{message.text}</p>
        )}
      </div>
    </form>
  );
}

// A progress track: steps up to the chosen one are ticked, the chosen one is highlighted.
// Each row is a radio button, so it works with the keyboard and screen readers too.
function StatusPicker({ value, onChange }: { value: Fulfillment; onChange: (f: Fulfillment) => void }) {
  const cancelled = value === "cancelled";
  const current = steps.findIndex((s) => s.value === value);

  return (
    <div className="grid gap-3">
      <ol className={`relative grid gap-1 ${cancelled ? "opacity-45" : ""}`}>
        {steps.map((step, i) => {
          const done = !cancelled && i < current;
          const active = !cancelled && i === current;
          return (
            <li key={step.value} className="relative">
              {/* connector to the next step */}
              {i < steps.length - 1 && (
                <span
                  className={`absolute left-[1.1875rem] top-9 h-[calc(100%-1.25rem)] w-0.5 ${done || active ? "bg-gold" : "bg-chocolate/15"}`}
                  aria-hidden="true"
                />
              )}
              <label
                className={`relative flex cursor-pointer items-center gap-3 rounded-xl px-1.5 py-2 transition-colors ${
                  active ? "bg-gold/15" : "hover:bg-chocolate/5"
                }`}
              >
                <input
                  type="radio"
                  name="fulfillment"
                  value={step.value}
                  checked={value === step.value}
                  onChange={() => onChange(step.value)}
                  className="peer sr-only"
                />
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2 ${
                    done
                      ? "border-gold bg-gold text-espresso"
                      : active
                        ? "border-chocolate bg-chocolate text-ivory"
                        : "border-chocolate/25 bg-white/60 text-chocolate/50"
                  }`}
                  aria-hidden="true"
                >
                  {done ? check : i + 1}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm ${active ? "font-semibold" : "font-medium"}`}>{fulfillmentLabels[step.value]}</span>
                  <span className="block text-xs text-chocolate/60">{step.hint}</span>
                </span>
                {active && (
                  <span className="ml-auto rounded-full bg-chocolate px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ivory">
                    Current
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ol>

      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
          cancelled ? "border-red-700/40 bg-red-700/10 text-red-800" : "border-chocolate/15 text-chocolate/70 hover:border-red-700/40 hover:text-red-800"
        }`}
      >
        <input
          type="radio"
          name="fulfillment"
          value="cancelled"
          checked={cancelled}
          onChange={() => onChange("cancelled")}
          className="peer sr-only"
        />
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-red-700 peer-focus-visible:ring-offset-2 ${
            cancelled ? "border-red-700 bg-red-700 text-white" : "border-current"
          }`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </span>
        <span>
          <span className="block font-medium">{cancelled ? "Cancelled" : "Cancel order"}</span>
          <span className="block text-xs opacity-80">Refund the payment in the Razorpay Dashboard</span>
        </span>
      </label>
    </div>
  );
}

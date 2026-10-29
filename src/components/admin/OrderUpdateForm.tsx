"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { updateOrder } from "@/app/actions/admin";
import { orderLimits, validateOrderUpdate, type OrderUpdateErrors } from "@/lib/admin-validation";
import { fulfillmentLabels, type Fulfillment } from "@/lib/order";
import Spinner from "@/components/Spinner";

const input =
  "w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold aria-invalid:border-red-700";
const label = "mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60";

// The delivery steps, in order; "cancelled" is offered separately
const steps: { value: Exclude<Fulfillment, "cancelled">; hint: string }[] = [
  { value: "placed", hint: "Paid, waiting to be packed" },
  { value: "packed", hint: "Packed, ready for the courier" },
  { value: "shipped", hint: "Handed to the courier" },
  { value: "delivered", hint: "Received by the customer" },
];
const stepIndex = (f: Fulfillment) => steps.findIndex((s) => s.value === f);
// Everything the status dropdown offers
const choices: { value: Fulfillment; hint: string }[] = [...steps, { value: "cancelled", hint: "Items go back in stock" }];

const check = (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);

// Delivery status, courier/tracking (shown to the customer) and a private note
export default function OrderUpdateForm({
  orderId,
  initial,
  paidOnline,
}: {
  orderId: string;
  initial: { fulfillment: Fulfillment; courier: string; trackingNumber: string; adminNote: string };
  // Paid through Razorpay, so cancelling means a refund is due
  paidOnline: boolean;
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
      !window.confirm(`Cancel this order? Its items go back in stock.${paidOnline ? " Refund the customer from the Payment section afterwards." : ""}`)) return;
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
      <div>
        <p className={label}>Current status</p>
        <StatusTrack status={initial.fulfillment} />
      </div>
      <div>
        <p id="fulfillment-label" className={label}>Change status to</p>
        <StatusSelect
          value={values.fulfillment}
          current={initial.fulfillment}
          onChange={(fulfillment) => {
            setValues({ ...values, fulfillment });
            setMessage(null);
          }}
        />
        <StatusChangeNote from={initial.fulfillment} to={values.fulfillment} paidOnline={paidOnline} />
      </div>
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
          {pending
            ? "Saving…"
            : values.fulfillment !== initial.fulfillment
              ? `Save as ${fulfillmentLabels[values.fulfillment]}`
              : "Save changes"}
        </button>
        {message && (
          <p className={`text-sm ${message.error ? "text-red-700" : "text-green-800"}`} role="status">{message.text}</p>
        )}
      </div>
    </form>
  );
}

// Where the order stands now (as saved): a small read-only progress track
function StatusTrack({ status }: { status: Fulfillment }) {
  if (status === "cancelled") {
    return (
      <p className="inline-flex items-center gap-2 rounded-full bg-red-700/10 px-3 py-1 text-sm font-medium text-red-800">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
        Cancelled
      </p>
    );
  }
  const current = stepIndex(status);
  return (
    <div>
      <p className="mb-3 text-sm">
        <span className="font-semibold">{fulfillmentLabels[status]}</span>
        <span className="text-chocolate/60"> · {steps[current].hint}</span>
      </p>
      <ol className="grid grid-cols-4" aria-label="Delivery progress">
        {steps.map((step, i) => {
          const reached = i <= current;
          return (
            <li key={step.value} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={i === current ? "step" : undefined}>
              {/* line from the previous step */}
              {i > 0 && (
                <span
                  className={`absolute right-1/2 top-2.5 h-0.5 w-full -translate-y-1/2 ${reached ? "bg-gold" : "bg-chocolate/15"}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                  reached ? "border-gold bg-gold text-espresso" : "border-chocolate/25 bg-ivory"
                }`}
                aria-hidden="true"
              >
                {reached && check}
              </span>
              <span className={`text-[0.7rem] leading-tight ${i === current ? "font-semibold text-chocolate" : reached ? "text-chocolate/70" : "text-chocolate/45"}`}>
                {fulfillmentLabels[step.value]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// A status's round marker in the dropdown: its step number, or a cross for cancelled
function StatusDot({ value, active }: { value: Fulfillment; active: boolean }) {
  const cancelled = value === "cancelled";
  const colors = cancelled
    ? active ? "border-red-700 bg-red-700 text-white" : "border-red-700/40 text-red-700"
    : active ? "border-chocolate bg-chocolate text-ivory" : "border-chocolate/25 text-chocolate/60";
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[0.65rem] font-semibold ${colors}`} aria-hidden="true">
      {cancelled ? (
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      ) : (
        stepIndex(value) + 1
      )}
    </span>
  );
}

const currentTag = (
  <span className="shrink-0 rounded-full bg-chocolate/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-chocolate/70">
    Current
  </span>
);

// Brand-styled status dropdown: the native <select> popup can't be themed and cuts off the hints.
// Keyboard works like Select.tsx: arrows move, Enter/Space picks, Escape closes.
function StatusSelect({ value, current, onChange }: { value: Fulfillment; current: Fulfillment; onChange: (f: Fulfillment) => void }) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selected = choices.findIndex((c) => c.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function toggle(next = !open) {
    if (next) setHighlight(selected);
    setOpen(next);
  }

  function choose(i: number) {
    onChange(choices[i].value);
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return toggle(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setHighlight((h) => (h + step + choices.length) % choices.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) choose(highlight);
      else toggle(true);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="fulfillment-listbox"
        aria-labelledby="fulfillment-label"
        onClick={() => toggle()}
        onKeyDown={onKeyDown}
        className={`flex w-full items-center gap-3 rounded-xl border bg-white/60 px-3 py-2.5 text-left outline-none transition-colors ${
          open ? "border-gold" : "border-chocolate/20 hover:border-gold/60 focus-visible:border-gold"
        }`}
      >
        <StatusDot value={value} active />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium ${value === "cancelled" ? "text-red-800" : ""}`}>{fulfillmentLabels[value]}</span>
          <span className="block truncate text-xs text-chocolate/60">{choices[selected].hint}</span>
        </span>
        {value === current && currentTag}
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-gold transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      <ul
        id="fulfillment-listbox"
        role="listbox"
        aria-labelledby="fulfillment-label"
        className={`absolute left-0 right-0 top-full z-20 mt-2 origin-top rounded-xl border border-chocolate/15 bg-cream p-1.5 shadow-xl shadow-chocolate/15 transition-all duration-150 ${
          open ? "visible scale-100 opacity-100" : "invisible scale-95 opacity-0"
        }`}
      >
        {choices.map((c, i) => {
          const cancelled = c.value === "cancelled";
          return (
            <li
              key={c.value}
              role="option"
              aria-selected={c.value === value}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                cancelled ? "mt-1.5 border-t border-chocolate/10" : ""
              } ${i === highlight ? (cancelled ? "bg-red-700/10" : "bg-gold/15") : ""}`}
            >
              <StatusDot value={c.value} active={c.value === value} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${cancelled ? "text-red-800" : ""}`}>{fulfillmentLabels[c.value]}</span>
                <span className="block text-xs text-chocolate/60">{c.hint}</span>
              </span>
              {c.value === current && currentTag}
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 shrink-0 text-gold ${c.value === value ? "" : "invisible"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                aria-hidden="true"
              >
                <path d="m5 12 5 5 9-10" />
              </svg>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Says what saving will do, before the admin clicks Save
function StatusChangeNote({ from, to, paidOnline }: { from: Fulfillment; to: Fulfillment; paidOnline: boolean }) {
  if (from === to) return <p className="mt-1.5 text-xs text-chocolate/60">Pick the new status, then save. The customer sees it on their order.</p>;
  if (to === "cancelled") {
    return (
      <p className="mt-2 rounded-xl bg-red-700/10 px-3 py-2 text-xs text-red-800">
        Saving cancels the order and puts its items back in stock.
        {paidOnline && " The money isn't refunded automatically: use Refund in the Payment section."}
      </p>
    );
  }
  const back = from !== "cancelled" && stepIndex(to) < stepIndex(from);
  return (
    <p className={`mt-2 rounded-xl px-3 py-2 text-xs ${back ? "bg-amber-600/10 text-amber-900" : "bg-gold/15 text-chocolate"}`}>
      {fulfillmentLabels[from]} → <strong>{fulfillmentLabels[to]}</strong> when you save.
      {back && " This moves the order back a step."}
      {from === "cancelled" && " The items are taken out of stock again."}
    </p>
  );
}

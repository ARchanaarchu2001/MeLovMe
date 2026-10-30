"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { savePaymentSettings } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";
import { canBuy, type PaymentSettings } from "@/lib/payments";

// Switches for how customers can buy at checkout: Razorpay and cash on delivery. At least one must be on.
export default function PaymentSettingsForm({ initial }: { initial: PaymentSettings }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const valid = canBuy(v);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof PaymentSettings>(k: K, value: PaymentSettings[K]) => {
    setV((prev) => ({ ...prev, [k]: value }));
    setSaved(false);
    setError("");
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    startTransition(async () => {
      const res = await savePaymentSettings(v);
      if ("error" in res) return setError(res.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid max-w-3xl gap-5">
      <p className="text-sm text-chocolate/70">Choose how customers can pay. Changes show in the shop as soon as you save.</p>

      <MethodCard
        title="Online payment (Razorpay)"
        text="UPI (Google Pay, PhonePe, Paytm), cards and netbanking at checkout. Paid orders can be refunded from the order page."
        icon={<path d="M3 7h18v10H3zM3 10h18M7 15h3" />}
        checked={v.razorpay}
        onChange={(on) => set("razorpay", on)}
      />
      <MethodCard
        title="Cash on delivery"
        text="Customers place the order and pay in cash when it arrives. Mark it paid on the order page once the cash is collected."
        icon={<path d="M2 7h20v10H2zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 12h.01M18 12h.01" />}
        checked={v.cod}
        onChange={(on) => set("cod", on)}
      />

      {(!valid || error) && (
        <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
          {error || "Switch on at least one payment method (Razorpay or cash on delivery) to save."}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending || !valid}>
          {pending && <Spinner />}
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && <p className="text-sm text-green-800" role="status">Saved. The shop is updated.</p>}
      </div>
    </form>
  );
}

// One payment method: icon, name, what it does and an on/off switch
function MethodCard({ title, text, icon, checked, onChange, children }: {
  title: string;
  text: string;
  icon: ReactNode;
  checked: boolean;
  onChange: (on: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-5 transition-colors ${checked ? "border-gold/60 bg-white/50" : "border-chocolate/15"}`}>
      <label className="flex cursor-pointer items-center gap-4">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${checked ? "bg-gold/20 text-gold" : "bg-chocolate/5 text-chocolate/50"}`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {icon}
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-chocolate/60">{text}</span>
        </span>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" role="switch" />
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-gold peer-focus-visible:ring-offset-2 ${checked ? "bg-green-700" : "bg-chocolate/25"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[1.375rem]" : "left-0.5"}`} />
        </span>
      </label>
      {children}
    </div>
  );
}

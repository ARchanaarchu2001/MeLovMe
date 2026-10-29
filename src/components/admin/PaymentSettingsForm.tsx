"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { savePaymentSettings } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";
import { WHATSAPP_MESSAGE_MAX, validatePaymentSettings, whatsappProductMessage, type PaymentSettings, type PaymentSettingsErrors } from "@/lib/payments";

// Switches for how customers can buy: Razorpay and cash on delivery at checkout, and a
// "Buy on WhatsApp" button on product pages with a message the shop writes
type Sample = { name: string; size: string; price: string; url: string; image?: string; description: string };

const fallbackSample: Sample = {
  name: "Signature Body Lotion",
  size: "50 ml",
  price: "₹699",
  url: "https://melovme.in/products/signature-body-lotion/",
  description: "A silky, fast-absorbing lotion.",
};

export default function PaymentSettingsForm({ initial, sample = fallbackSample }: { initial: PaymentSettings; sample?: Sample }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<PaymentSettingsErrors>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof PaymentSettings>(k: K, value: PaymentSettings[K]) => {
    setV((prev) => ({ ...prev, [k]: value }));
    setErrors({});
    setSaved(false);
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validatePaymentSettings(v);
    if (Object.keys(found).length) return setErrors(found);
    startTransition(async () => {
      const res = await savePaymentSettings(v);
      if ("errors" in res) return setErrors(res.errors);
      setSaved(true);
      router.refresh();
    });
  }

  const preview = whatsappProductMessage(v.whatsappMessage || "…", sample);

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
      <MethodCard
        title="Buy on WhatsApp"
        text="A button on every product page that opens WhatsApp with your message and the product's details, so customers can ask or order by chat."
        icon={<path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3L3 21Zm6-12.5c0 3.6 2.9 6.5 6.5 6.5l1-1.6-2-1-1 .9a5 5 0 0 1-2.8-2.8l.9-1-1-2-1.6 1Z" />}
        checked={v.whatsapp}
        onChange={(on) => set("whatsapp", on)}
      >
        {v.whatsapp && (
          <div className="mt-5 grid gap-4 border-t border-chocolate/10 pt-5 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60">Message</span>
              <textarea
                value={v.whatsappMessage}
                onChange={(e) => set("whatsappMessage", e.target.value)}
                maxLength={WHATSAPP_MESSAGE_MAX}
                rows={4}
                aria-invalid={!!errors.whatsappMessage}
                className="w-full rounded-xl border border-chocolate/20 bg-white/60 px-4 py-2.5 text-sm outline-none focus:border-gold aria-invalid:border-red-700"
              />
              {errors.whatsappMessage ? (
                <span className="mt-1.5 block text-xs text-red-700">{errors.whatsappMessage}</span>
              ) : (
                <span className="mt-1.5 block text-xs text-chocolate/60">The product&apos;s name, size, price and link are added below it.</span>
              )}
            </label>
            <div>
              <span className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-chocolate/60">What the customer sends</span>
              {/* A WhatsApp message bubble: the link's preview card (photo, name, site) above the text */}
              <div className="overflow-hidden rounded-xl rounded-tr-sm bg-[#dcf8c6] p-1 text-[#111b21] shadow-sm">
                <div className="overflow-hidden rounded-lg bg-[#cfe9ba]">
                  {sample.image && (
                    <div className="relative aspect-[1.6] w-full bg-white">
                      <Image src={sample.image} alt="" fill sizes="320px" className="object-cover" />
                    </div>
                  )}
                  <div className="px-3 py-2">
                    <p className="truncate text-sm font-medium">{sample.name}</p>
                    <p className="line-clamp-2 text-xs text-[#111b21]/70">{sample.description}</p>
                    <p className="mt-0.5 truncate text-[0.7rem] text-[#111b21]/50">{hostOf(sample.url)}</p>
                  </div>
                </div>
                <p className="whitespace-pre-line break-words px-3 py-2 text-sm">{preview}</p>
              </div>
              <p className="mt-1.5 text-xs text-chocolate/60">
                WhatsApp adds the product photo as a preview of the link. It only appears once the shop is live on its own
                domain, not while testing on localhost.
              </p>
            </div>
          </div>
        )}
      </MethodCard>

      {errors.form && (
        <p className="rounded-xl bg-red-700/10 px-4 py-3 text-sm text-red-800" role="alert">
          {errors.form}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />}
          {pending ? "Saving…" : "Save changes"}
        </button>
        {saved && <p className="text-sm text-green-800" role="status">Saved. The shop is updated.</p>}
      </div>
    </form>
  );
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

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

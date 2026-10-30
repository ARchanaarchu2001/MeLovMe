"use client";

import { useTranslations } from "next-intl";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import Spinner from "./Spinner";

// Small round badges for the UPI apps Razorpay offers, drawn inline (no image files)
function UpiBadges({ small = false }: { small?: boolean }) {
  const badge = `flex ${small ? "h-6 w-6" : "h-7 w-7"} items-center justify-center rounded-full border-2 border-espresso bg-white`;
  return (
    <span className="flex -space-x-2" aria-hidden="true">
      {/* Google Pay */}
      <span className={badge}>
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" fill="#4285F4" />
          <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" fill="#34A853" />
          <path d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z" fill="#FBBC05" />
          <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1Z" fill="#EA4335" />
        </svg>
      </span>
      {/* PhonePe */}
      <span className={`${badge} !bg-[#5f259f]`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <text x="12" y="17" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">
            पे
          </text>
        </svg>
      </span>
      {/* Paytm */}
      <span className={badge}>
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <text x="12" y="15.5" textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="Arial, sans-serif" fill="#00b9f1">
            pay
          </text>
        </svg>
      </span>
    </span>
  );
}

// The checkout button: a dark bar with the label. With `razorpay` (online payment switched on) it
// also shows UPI app badges and "Secured by Razorpay" in the corner; without it, just the label.
// `tag` adds a small label on the top-left (e.g. "Limited offer").
// `compact`: a pill the same size as the other buttons beside it (the product page), without the
// "Secured by Razorpay" corner note, and without the UPI badges on phones (it's half-width there).
export default function PayButton({
  children,
  pending,
  tag,
  razorpay = true,
  compact = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; pending?: boolean; tag?: string; razorpay?: boolean; compact?: boolean }) {
  const t = useTranslations("checkout.flow");
  const shape = compact
    ? "h-11 rounded-full px-3 shadow-md md:px-4"
    : `min-h-14 max-w-sm rounded-2xl px-6 ${razorpay ? "pb-4 pt-3" : "py-3"} shadow-lg hover:shadow-xl`;
  return (
    <button
      type="button"
      {...props}
      className={`group relative flex w-full items-center justify-center overflow-hidden bg-espresso ${shape} text-ivory shadow-espresso/20 transition-all hover:-translate-y-0.5 hover:bg-chocolate disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {tag && (
        <span className="absolute left-0 top-0 rounded-br-xl bg-red-600 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-white">
          {tag}
        </span>
      )}
      <span className="flex items-center gap-3">
        {pending && <Spinner />}
        <span className={`whitespace-nowrap font-semibold uppercase ${compact ? "text-xs tracking-[0.1em] md:tracking-[0.15em]" : "text-sm tracking-[0.2em]"}`}>{children}</span>
        {razorpay && !pending && (compact ? <span className="hidden md:flex"><UpiBadges small /></span> : <UpiBadges />)}
      </span>
      {razorpay && !compact && (
        <span className="absolute bottom-1.5 right-3 flex items-center gap-1 text-[0.6rem] text-ivory/60">
          {t("securedBy")} <strong className="font-semibold text-ivory/80">Razorpay</strong>
        </span>
      )}
    </button>
  );
}

// Reassurance under the button when paying online: a shield with "100% Secure Payment"
export function SecurePaymentBadge({ className = "" }: { className?: string }) {
  const t = useTranslations("checkout.flow");
  return (
    <p className={`flex max-w-sm items-center justify-center gap-1 whitespace-nowrap text-[0.7rem] text-chocolate/65 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-green-700" fill="currentColor" aria-hidden="true">
        <path d="M12 2 4 5.2v6c0 5 3.4 9.4 8 10.8 4.6-1.4 8-5.8 8-10.8v-6L12 2Z" />
        <path d="m8.5 12 2.4 2.4 4.6-4.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>
        <span className="font-semibold text-green-800">{t("secureTitle")}</span> · {t("secureText")}
      </span>
    </p>
  );
}

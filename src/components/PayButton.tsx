"use client";

import { useTranslations } from "next-intl";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import Spinner from "./Spinner";

// Small round badges for the UPI apps Razorpay offers, drawn inline (no image files)
function UpiBadges() {
  const badge = "flex h-7 w-7 items-center justify-center rounded-full border-2 border-espresso bg-white";
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

// The Razorpay checkout button: dark bar with the amount, UPI app badges, and "Secured by
// Razorpay" in the corner. `tag` adds a small label on the top-left (e.g. "Limited offer").
export default function PayButton({
  children,
  pending,
  tag,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; pending?: boolean; tag?: string }) {
  const t = useTranslations("checkout.flow");
  return (
    <button
      type="button"
      {...props}
      className={`group relative flex min-h-16 w-full max-w-md items-center justify-center overflow-hidden rounded-2xl bg-espresso px-6 pb-5 pt-4 text-ivory shadow-lg shadow-espresso/20 transition-all hover:-translate-y-0.5 hover:bg-chocolate hover:shadow-xl disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {tag && (
        <span className="absolute left-0 top-0 rounded-br-xl bg-red-600 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-white">
          {tag}
        </span>
      )}
      <span className="flex items-center gap-3">
        {pending && <Spinner />}
        <span className="text-sm font-semibold uppercase tracking-[0.2em]">{children}</span>
        {!pending && <UpiBadges />}
      </span>
      <span className="absolute bottom-1.5 right-3 flex items-center gap-1 text-[0.6rem] text-ivory/60">
        {t("securedBy")} <strong className="font-semibold text-ivory/80">Razorpay</strong>
      </span>
    </button>
  );
}

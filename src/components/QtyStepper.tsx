"use client";

import { useTranslations } from "next-intl";
import { MAX_QTY } from "@/lib/cart";

export default function QtyStepper({
  qty,
  onChange,
  min = 1,
}: {
  qty: number;
  onChange: (qty: number) => void;
  min?: number;
}) {
  const t = useTranslations("products.qty");
  const button = "flex h-10 w-10 items-center justify-center text-lg transition-colors hover:text-gold disabled:opacity-30";

  return (
    <div className="inline-flex items-center rounded-full border border-chocolate/20">
      <button type="button" className={button} onClick={() => onChange(qty - 1)} disabled={qty <= min} aria-label={t("decrease")}>
        −
      </button>
      <span className="w-8 text-center text-sm" aria-live="polite">{qty}</span>
      <button type="button" className={button} onClick={() => onChange(qty + 1)} disabled={qty >= MAX_QTY} aria-label={t("increase")}>
        +
      </button>
    </div>
  );
}

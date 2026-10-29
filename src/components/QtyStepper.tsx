"use client";

import { useTranslations } from "next-intl";
import { MAX_QTY } from "@/lib/cart";

export default function QtyStepper({
  qty,
  onChange,
  min = 1,
  max = MAX_QTY,
}: {
  qty: number;
  onChange: (qty: number) => void;
  min?: number;
  max?: number; // fewer than MAX_QTY when stock is low
}) {
  const t = useTranslations("products.qty");
  const button = "flex h-10 w-10 items-center justify-center text-lg transition-colors hover:text-gold disabled:opacity-30";

  return (
    <div className="inline-flex items-center justify-between rounded-full border border-chocolate/20">
      <button type="button" className={button} onClick={() => onChange(qty - 1)} disabled={qty <= min} aria-label={t("decrease")}>
        −
      </button>
      <span className="w-8 text-center text-sm" aria-live="polite">{qty}</span>
      <button type="button" className={button} onClick={() => onChange(qty + 1)} disabled={qty >= max} aria-label={t("increase")}>
        +
      </button>
    </div>
  );
}

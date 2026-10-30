"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { createStore } from "@/lib/store";

// Product listing grid with a "per row" switcher. Phones pick 1 or 2 cards per row (default 2),
// larger screens 2, 3 or 4 (default 3). The choice is saved in the visitor's browser.
const MOBILE = [1, 2] as const;
const DESKTOP = [2, 3, 4] as const;
type Mobile = (typeof MOBILE)[number];
type Desktop = (typeof DESKTOP)[number];

// Stored as [mobile, desktop]; stored data is untrusted, so anything unexpected falls back to the defaults
const store = createStore<number>("melovme-grid", (raw) => {
  const [m, d] = raw;
  return [
    MOBILE.includes(m as Mobile) ? (m as Mobile) : 2,
    DESKTOP.includes(d as Desktop) ? (d as Desktop) : 3,
  ];
});

// Full class names so Tailwind can see them
const MOBILE_COLS: Record<Mobile, string> = {
  1: "grid-cols-1 gap-y-8",
  2: "grid-cols-2 gap-x-3 gap-y-6",
};
const DESKTOP_COLS: Record<Desktop, string> = {
  2: "md:grid-cols-2 md:gap-x-10 md:gap-y-14",
  3: "md:grid-cols-3 md:gap-x-8 md:gap-y-12",
  4: "md:grid-cols-4 md:gap-x-6 md:gap-y-10",
};

export default function ProductGrid({ count, children }: { count: number; children: ReactNode }) {
  const t = useTranslations("products.grid");
  const stored = store.useItems();
  const mobile = (stored[0] ?? 2) as Mobile;
  const desktop = (stored[1] ?? 3) as Desktop;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-chocolate/10 pb-3 md:mb-8 md:pb-4">
        <p className="text-xs uppercase tracking-[0.2em] text-chocolate/60">{t("count", { count })}</p>
        <Switcher options={MOBILE} value={mobile} onChange={(m) => store.set([m, desktop])} className="md:hidden" />
        <Switcher options={DESKTOP} value={desktop} onChange={(d) => store.set([mobile, d])} className="hidden md:flex" />
      </div>
      <div className={`grid ${MOBILE_COLS[mobile]} ${DESKTOP_COLS[desktop]}`}>{children}</div>
    </>
  );
}

function Switcher<N extends number>({
  options,
  value,
  onChange,
  className,
}: {
  options: readonly N[];
  value: N;
  onChange: (n: N) => void;
  className: string;
}) {
  const t = useTranslations("products.grid");

  return (
    <div role="group" aria-label={t("label")} className={`flex items-center gap-1 rounded-full bg-chocolate/[0.07] p-1 ${className}`}>
      {options.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-pressed={value === n}
          aria-label={t("perRow", { count: n })}
          title={t("perRow", { count: n })}
          className={`flex h-8 items-center gap-[3px] rounded-full px-3 transition-colors ${
            value === n ? "bg-chocolate text-ivory" : "text-chocolate/60 hover:text-chocolate"
          }`}
        >
          {/* One little column per card */}
          {Array.from({ length: n }, (_, i) => (
            <span key={i} className="h-3.5 w-1.5 rounded-[2px] bg-current" aria-hidden="true" />
          ))}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { setProductStock } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";
import { onlyDigits } from "@/lib/admin-validation";
import { StockBadge } from "./ui";

// Units on hand for one product in the product list, editable in place (e.g. after restocking)
export default function StockEditor({ slug, name, stock }: { slug: string; name: string; stock: number | null }) {
  const router = useRouter();
  const [value, setValue] = useState(stock === null ? "" : String(stock));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const changed = value.trim() !== (stock === null ? "" : String(stock));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await setProductStock(slug, value.trim() === "" ? NaN : Number(value));
      setError("error" in res ? res.error : "");
      if ("ok" in res) router.refresh();
    });
  }

  return (
    // Fixed width, so the badge and box line up the same on every row
    <form onSubmit={handleSubmit} className="grid w-36 justify-items-start gap-1.5">
      <StockBadge stock={stock} />
      <div className="flex w-full items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(onlyDigits(e.target.value))}
          inputMode="numeric"
          placeholder="Units"
          aria-label={`${name}: units in stock`}
          className="w-20 rounded-lg border border-chocolate/20 bg-white/60 px-2.5 py-1.5 text-sm outline-none focus:border-gold"
        />
        {changed && (
          <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-gold hover:underline disabled:opacity-60">
            {pending && <Spinner className="h-3.5 w-3.5" />}
            Save
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </form>
  );
}

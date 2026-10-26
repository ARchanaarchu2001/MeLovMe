"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setProductEnabled } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";

// On/off switch: disabled products are hidden from the shop and can't be bought
export default function ProductToggle({ slug, name, enabled: initial }: { slug: string; name: string; enabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${name}: ${enabled ? "enabled" : "disabled"}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setEnabled(!enabled);
          await setProductEnabled(slug, !enabled);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] disabled:opacity-60"
    >
      <span className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? "bg-green-700" : "bg-chocolate/25"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
      <span className={enabled ? "text-green-800" : "text-chocolate/60"}>{enabled ? "Enabled" : "Disabled"}</span>
      {pending && <Spinner className="h-3.5 w-3.5 text-gold" />}
    </button>
  );
}

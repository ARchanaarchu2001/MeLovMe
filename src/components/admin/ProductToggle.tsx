"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setProductFlag } from "@/app/actions/admin";
import Spinner from "@/components/Spinner";

const labels = {
  // Disabled products are hidden from the shop and can't be bought
  enabled: { on: "Enabled", off: "Disabled" },
};

// On/off switch for one product setting
export default function ProductToggle({ slug, name, flag, value: initial }: {
  slug: string;
  name: string;
  flag: "enabled";
  value: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  const label = value ? labels[flag].on : labels[flag].off;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={`${name}: ${label.toLowerCase()}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setValue(!value);
          await setProductFlag(slug, flag, !value);
          router.refresh();
        })
      }
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.15em] disabled:opacity-60"
    >
      <span className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-green-700" : "bg-chocolate/25"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-[1.375rem]" : "left-0.5"}`} />
      </span>
      <span className={`w-24 ${value ? "text-green-800" : "text-chocolate/60"}`}>{label}</span>
      {pending && <Spinner className="h-3.5 w-3.5 text-gold" />}
    </button>
  );
}

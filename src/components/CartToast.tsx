"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCatalog } from "./CatalogProvider";
import { onAddedToCart } from "@/lib/cart";

const SHOW_FOR_MS = 4000;

// "Added to cart" pop-up with a View Cart button, shown whenever a product is added to the cart.
// Bottom of the screen on phones, top right (under the header) on larger screens.
export default function CartToast() {
  const t = useTranslations("products.toast");
  const pathname = usePathname();
  const catalog = useCatalog();
  // `key` restarts the entrance animation when another product is added while it's showing
  const [added, setAdded] = useState<{ slug: string; key: number } | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => onAddedToCart((slug) => setAdded({ slug, key: Date.now() })), []);

  // Hide after a few seconds, unless the pointer or keyboard focus is on it
  useEffect(() => {
    if (!added || paused) return;
    const timer = setTimeout(() => setAdded(null), SHOW_FOR_MS);
    return () => clearTimeout(timer);
  }, [added, paused]);

  // Close it when the customer moves to another page
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setAdded(null);
  }

  const product = added && catalog.get(added.slug);
  // Not needed on the cart, and Buy Now goes straight to checkout
  if (!product || pathname.startsWith("/cart") || pathname.startsWith("/checkout")) return null;

  return (
    <div
      key={added.key}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="animate-toast-in fixed inset-x-4 bottom-4 z-[60] flex items-center gap-4 rounded-2xl border border-chocolate/10 bg-cream p-4 shadow-[0_12px_40px_-12px_rgba(60,35,20,0.35)] md:inset-x-auto md:bottom-auto md:right-6 md:top-24 md:w-[24rem]"
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-ivory">
        <Image src={product.images[0]} alt="" fill sizes="56px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-green-800">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
          </svg>
          {t("added")}
        </p>
        <p className="mt-1 truncate text-sm font-medium">{product.name}</p>
      </div>
      <Link href="/cart/" className="btn btn-primary shrink-0 !px-5 !py-2.5 text-xs">
        {t("viewCart")}
      </Link>
      <button
        type="button"
        onClick={() => setAdded(null)}
        aria-label={t("close")}
        className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-chocolate/50 hover:bg-chocolate/5 hover:text-chocolate"
      >
        ×
      </button>
    </div>
  );
}

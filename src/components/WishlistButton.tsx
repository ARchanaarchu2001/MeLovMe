"use client";

import { useTranslations } from "next-intl";
import { Icon } from "./Icons";
import { toggleWishlist, useWishlist } from "@/lib/wishlist";

// Round heart toggle — filled when the product is saved to the wishlist
export default function WishlistButton({ slug, className = "" }: { slug: string; className?: string }) {
  const t = useTranslations("products.wishlist");
  const saved = useWishlist().has(slug);
  const label = saved ? t("remove") : t("add");

  return (
    <button
      type="button"
      onClick={() => toggleWishlist(slug)}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full border border-chocolate/20 bg-cream/90 transition-colors hover:border-gold hover:text-gold ${
        saved ? "text-gold" : "text-chocolate"
      } ${className}`}
    >
      <Icon name="heart" className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
    </button>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import CartButton from "./CartButton";
import { addToCart, useCart } from "@/lib/cart";

// Product page buttons: Add to Cart (a quantity stepper once it's in the cart) and Buy Now
export default function AddToCart({ slug }: { slug: string }) {
  const t = useTranslations("products");
  const router = useRouter();
  const inCart = useCart().lines.some((l) => l.product.slug === slug);

  return (
    <div className="mt-10 flex flex-wrap items-center gap-4">
      <CartButton slug={slug} />
      <button
        type="button"
        className="btn btn-outline"
        onClick={() => {
          // Don't double-add if it's already in the cart
          if (!inCart) addToCart(slug);
          router.push("/checkout/");
        }}
      >
        {t("buyNow")}
      </button>
    </div>
  );
}

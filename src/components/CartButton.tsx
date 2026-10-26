"use client";

import { useTranslations } from "next-intl";
import QtyStepper from "./QtyStepper";
import { addToCart, setQty, useCart } from "@/lib/cart";

// "Add to Cart" until the product is in the cart; then a stepper showing (and changing)
// how many are in the cart. Going down to 0 takes it out of the cart again.
export default function CartButton({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const t = useTranslations("products");
  const { lines } = useCart();
  const inCart = lines.find((l) => l.product.slug === slug)?.qty ?? 0;

  return inCart > 0 ? (
    <QtyStepper qty={inCart} min={0} onChange={(q) => setQty(slug, q)} />
  ) : (
    <button
      type="button"
      className={`btn btn-primary ${compact ? "!px-6 !py-3" : ""}`}
      onClick={() => addToCart(slug)}
    >
      {t("addToCart")}
    </button>
  );
}

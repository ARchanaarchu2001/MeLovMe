"use client";

import { useTranslations } from "next-intl";
import { useCatalog } from "./CatalogProvider";
import QtyStepper from "./QtyStepper";
import { MAX_QTY, addToCart, setQty, useCart } from "@/lib/cart";
import { maxQtyFor } from "@/lib/product";

// "Add to Cart" until the product is in the cart; then a stepper showing (and changing)
// how many are in the cart. Going down to 0 takes it out of the cart again.
// Out-of-stock products get a greyed-out "Out of Stock" button instead.
export default function CartButton({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const t = useTranslations("products");
  const { lines } = useCart();
  const product = useCatalog().get(slug);
  const inStock = product?.inStock ?? true;
  const inCart = lines.find((l) => l.product.slug === slug)?.qty ?? 0;

  if (!inStock) {
    return (
      <button type="button" disabled className={`btn btn-outline cursor-not-allowed opacity-50 ${compact ? "!px-6 !py-3" : ""}`}>
        {t("outOfStock")}
      </button>
    );
  }

  return inCart > 0 ? (
    <QtyStepper qty={inCart} min={0} max={product ? maxQtyFor(product, MAX_QTY) : MAX_QTY} onChange={(q) => setQty(slug, q)} />
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

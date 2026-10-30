"use client";

import { useTranslations } from "next-intl";
import { useCatalog } from "./CatalogProvider";
import QtyStepper from "./QtyStepper";
import { MAX_QTY, addToCart, setQty, useCart } from "@/lib/cart";
import { maxQtyFor } from "@/lib/product";

// "Add to Cart" until the product is in the cart; then a stepper showing (and changing)
// how many are in the cart. Going down to 0 takes it out of the cart again.
// Out-of-stock products get a greyed-out "Out of Stock" button instead.
// `compact` is for product cards: it fills a narrow card and goes back to normal width once
// the card's @container is wider (@xs).
const COMPACT =
  "h-9 min-h-0 w-full whitespace-nowrap !px-2 !py-0 !text-[0.6rem] !tracking-[0.1em] @xs:h-11 @xs:w-auto @xs:!px-6 @xs:!text-xs @xs:!tracking-[0.2em]";

export default function CartButton({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const t = useTranslations("products");
  const { lines } = useCart();
  const product = useCatalog().get(slug);
  const inStock = product?.inStock ?? true;
  const inCart = lines.find((l) => l.product.slug === slug)?.qty ?? 0;

  if (!inStock) {
    return (
      <button type="button" disabled className={`btn btn-outline cursor-not-allowed opacity-50 ${compact ? COMPACT : ""}`}>
        {t("outOfStock")}
      </button>
    );
  }

  return inCart > 0 ? (
    <QtyStepper qty={inCart} min={0} max={product ? maxQtyFor(product, MAX_QTY) : MAX_QTY} onChange={(q) => setQty(slug, q)} />
  ) : (
    <button
      type="button"
      className={`btn btn-primary ${compact ? COMPACT : ""}`}
      onClick={() => addToCart(slug)}
    >
      {t("addToCart")}
    </button>
  );
}

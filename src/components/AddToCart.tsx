"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import CartButton from "./CartButton";
import { useCatalog } from "./CatalogProvider";
import PayButton from "./PayButton";
import { whatsappUrl } from "@/data/site";
import { MAX_QTY, addToCart, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { whatsappProductMessage } from "@/lib/payments";
import { LOW_STOCK, activeCombos, maxQtyFor, priceOf, type Product } from "@/lib/product";

// Product page buttons: Add to Cart (a quantity stepper and Go to Cart once it's in the cart) and
// Buy Now, or an out-of-stock message instead. Above them: "In stock", or "Only 3 left" when low.
// Products with combo offers get a "1 Piece / 2 Pieces / 3 Pieces" picker instead of the stepper.
// `whatsappMessage`: the shop's WhatsApp message (from /admin/payments), or null when the
// "Buy on WhatsApp" button is switched off
export default function AddToCart({ slug, inStock, stock, whatsappMessage }: {
  slug: string;
  inStock: boolean;
  stock: number | null;
  whatsappMessage: string | null;
}) {
  const t = useTranslations("products");
  const router = useRouter();
  const product = useCatalog().get(slug);
  const inCart = useCart().lines.find((l) => l.product.slug === slug)?.qty ?? 0;
  // Combos the customer can actually buy (not more pieces than are in stock)
  const combos = product ? activeCombos(product).filter((c) => c.qty <= maxQtyFor(product, MAX_QTY)) : [];
  const [picked, setPicked] = useState(1);

  const whatsapp = product && whatsappMessage !== null && (
    <WhatsAppButton product={product} message={whatsappMessage} label={inStock ? t("buyOnWhatsapp") : t("askOnWhatsapp")} hint={t("whatsappHint")} />
  );

  if (!inStock) {
    return (
      <div className="mt-10">
        <span className="inline-block rounded-full bg-red-700/10 px-5 py-2 text-xs uppercase tracking-[0.2em] text-red-800">
          {t("outOfStock")}
        </span>
        <p className="mt-3 text-sm text-chocolate/70">{t("outOfStockText")}</p>
        {whatsapp && <div className="mt-5 max-w-md">{whatsapp}</div>}
      </div>
    );
  }

  const low = stock !== null && stock <= LOW_STOCK;
  // With combos, both buttons put exactly the picked number of pieces in the cart
  const buyNow = () => {
    // No "added" pop-up: we're off to checkout
    if (combos.length) addToCart(slug, picked, { exact: true, notify: false });
    // Don't double-add if it's already in the cart
    else if (!inCart) addToCart(slug, 1, { notify: false });
    router.push("/checkout/");
  };

  return (
    <div className="mt-10">
      <p className={`mb-4 flex items-center gap-2 text-sm font-medium ${low ? "text-amber-800" : "text-green-800"}`}>
        <span className={`h-2 w-2 rounded-full ${low ? "bg-amber-600" : "bg-green-700"}`} aria-hidden="true" />
        {low ? t("onlyLeft", { count: stock }) : t("inStock")}
      </p>
      {product && combos.length > 0 && <ComboPicker product={product} combos={combos} picked={picked} onPick={setPicked} />}
      {/* Add to Cart and WhatsApp side by side (stacked on very narrow phones), Buy Now under them */}
      <div className="grid max-w-md gap-3">
        <div className={`grid gap-3 *:w-full *:!px-4 *:!tracking-[0.12em] ${whatsapp ? "min-[400px]:grid-cols-2" : ""}`}>
          {combos.length ? (
            <button type="button" className="btn btn-primary" onClick={() => addToCart(slug, picked, { exact: true })}>
              {inCart && inCart !== picked ? t("combo.updateCart", { count: picked }) : t("addToCart")}
            </button>
          ) : (
            <CartButton slug={slug} />
          )}
          {whatsapp}
        </div>
        <PayButton onClick={buyNow}>{t("buyNow")}</PayButton>
        {inCart > 0 && (
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-chocolate/60">
            {combos.length > 0 && <span>{t("combo.inCart", { count: inCart })}</span>}
            <Link href="/cart/" className="uppercase tracking-[0.2em] text-gold hover:text-chocolate">
              {t("goToCart")} →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

// Opens WhatsApp with the shop's message and this product's name, size, today's price and link.
// `hint` is shown when hovering (it doesn't fit under a half-width button).
function WhatsAppButton({ product, message, label, hint }: { product: Product; message: string; label: string; hint: string }) {
  const open = () => {
    const text = whatsappProductMessage(message, {
      name: product.name,
      size: product.size,
      price: formatPrice(priceOf(product).price),
      url: `${window.location.origin}/products/${product.slug}/`,
    });
    window.open(whatsappUrl(text), "_blank", "noopener,noreferrer");
  };
  return (
    <button
      type="button"
      onClick={open}
      title={hint}
      className="btn w-full justify-center gap-2 whitespace-nowrap border border-[#25d366] bg-[#25d366]/10 !px-4 !tracking-[0.12em] text-[#075e54] hover:bg-[#25d366] hover:text-white"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.5 11.5 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
      </svg>
      {label}
    </button>
  );
}

// The "Combo offers" cards: one piece at the normal price, then each combo with what it saves
// against the regular price (MRP) of that many pieces
function ComboPicker({ product, combos, picked, onPick }: {
  product: Product;
  combos: Product["combos"];
  picked: number;
  onPick: (qty: number) => void;
}) {
  const t = useTranslations("products.combo");
  const { price, mrp } = priceOf(product);
  const options = [{ qty: 1, price, tag: undefined }, ...combos];

  return (
    <fieldset className="mb-8">
      <legend className="mb-5 flex w-full items-center gap-4 text-xs font-medium uppercase tracking-[0.25em]">
        <span className="h-px flex-1 bg-chocolate/25" aria-hidden="true" />
        {t("title")}
        <span className="h-px flex-1 bg-chocolate/25" aria-hidden="true" />
      </legend>
      <div className="grid gap-4">
        {options.map((o) => {
          const full = mrp * o.qty;
          const saving = full - o.price;
          const active = picked === o.qty;
          return (
            <label
              key={o.qty}
              className={`relative flex cursor-pointer items-center gap-4 rounded-2xl border px-5 py-4 transition-colors ${
                active ? "border-chocolate bg-ivory/70 ring-1 ring-chocolate" : "border-chocolate/20 hover:border-gold"
              }`}
            >
              <input type="radio" name={`combo-${product.slug}`} checked={active} onChange={() => onPick(o.qty)} className="peer sr-only" />
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-gold ${
                  active ? "border-chocolate" : "border-chocolate/40"
                }`}
                aria-hidden="true"
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-chocolate" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-medium">{t("pieces", { count: o.qty })}</span>
                  {o.qty > 1 && saving > 0 && (
                    <span className="rounded-md bg-gold/20 px-2 py-0.5 text-xs">{t("save", { amount: formatPrice(saving) })}</span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-chocolate/60">
                  {o.qty === 1 ? t("standard") : t("youSave", { percent: Math.round((saving / full) * 100) })}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-medium text-gold">{formatPrice(o.price)}</span>
                {saving > 0 && <s className="block text-xs text-chocolate/50">{formatPrice(full)}</s>}
              </span>
              {o.tag && (
                <span className="absolute -top-2.5 right-4 rounded-md bg-espresso px-2.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-ivory">
                  {t(`tags.${o.tag}`)}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

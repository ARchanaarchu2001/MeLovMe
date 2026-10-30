"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrashIcon } from "./Icons";
import OrderSummary from "./OrderSummary";
import PayButton, { SecurePaymentBadge } from "./PayButton";
import QtyStepper from "./QtyStepper";
import RemoveItemDialog from "./RemoveItemDialog";
import Price from "./Price";
import { maxQtyFor, offerStatus, type Product } from "@/lib/product";
import { MAX_QTY, setQty, setSelected, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { moveToWishlist } from "@/lib/wishlist";

// `razorpay`: online payment is switched on (/admin/payments), so the button shows Razorpay's badges
export default function CartView({ razorpay }: { razorpay: boolean }) {
  const t = useTranslations("cart");
  const router = useRouter();
  const { ready, lines, selected, outOfStock, subtotal, shipping, total } = useCart();
  // The product whose dustbin was clicked, while the "remove item?" dialog is open
  const [removing, setRemoving] = useState<Product | null>(null);

  // Cart is read from localStorage, so nothing to show until the browser has loaded it
  if (!ready) return <div className="min-h-[40vh]" />;

  if (lines.length === 0 && outOfStock.length === 0) {
    return (
      <div className="py-10 md:py-16 text-center">
        <p className="text-chocolate/70">{t("empty")}</p>
        <Link href="/products/" className="btn btn-primary mt-6 md:mt-8">{t("shopProducts")}</Link>
      </div>
    );
  }

  // Only when something in the cart is actually on offer (a running offer or a combo price)
  const tag = selected.some((l) => l.comboSaving > 0 || offerStatus(l.product.offer) === "active") ? t("limitedOffer") : undefined;
  const goToCheckout = () => router.push("/checkout/");

  return (
    // Bottom padding on phones keeps the last item clear of the sticky checkout bar
    <div className={`grid gap-8 md:gap-12 lg:grid-cols-[1fr_22rem] ${lines.length > 0 ? "pb-28 lg:pb-0" : ""}`}>
      <div>
        {lines.length > 0 && (
          <div className="flex items-center justify-between gap-4 pb-4 text-sm">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={selected.length === lines.length}
                // Shows a dash when only some are selected
                ref={(el) => {
                  if (el) el.indeterminate = selected.length > 0 && selected.length < lines.length;
                }}
                onChange={(e) => setSelected(lines.map((l) => l.product.slug), e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-gold"
              />
              {t("selectAll")}
            </label>
            <span className="text-chocolate/60">{t("selectedCount", { count: selected.length, total: lines.length })}</span>
          </div>
        )}
        <ul className="divide-y divide-chocolate/10 border-y border-chocolate/10">
          {lines.map(({ product, qty, total, comboSaving, selected: picked }) => (
            <li key={product.slug} className={`flex items-center gap-4 py-6 transition-opacity sm:gap-5 ${picked ? "" : "opacity-60"}`}>
              <input
                type="checkbox"
                checked={picked}
                onChange={(e) => setSelected([product.slug], e.target.checked)}
                aria-label={t("selectLabel", { name: product.name })}
                className="h-4 w-4 shrink-0 cursor-pointer accent-gold"
              />
              <Link
                href={`/products/${product.slug}/`}
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-ivory sm:h-28 sm:w-28"
              >
                <Image src={product.images[0]} alt={product.name} fill sizes="112px" className="object-cover" />
              </Link>
              <div className="flex flex-1 flex-col justify-between gap-3 self-stretch">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link href={`/products/${product.slug}/`} className="font-medium hover:text-gold">
                      {product.name}
                    </Link>
                    <p className="mt-1 text-sm text-chocolate/60">
                      {product.size} · <Price product={product} showBadge={false} />
                    </p>
                    {comboSaving > 0 && (
                      <p className="mt-1.5 inline-block rounded-full bg-green-700/10 px-2.5 py-0.5 text-xs text-green-800">
                        {t("comboSaving", { amount: formatPrice(comboSaving) })}
                      </p>
                    )}
                  </div>
                  <p className="text-right font-medium text-gold">
                    {formatPrice(total)}
                    {comboSaving > 0 && <s className="block text-xs font-normal text-chocolate/50">{formatPrice(total + comboSaving)}</s>}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <QtyStepper qty={qty} max={maxQtyFor(product, MAX_QTY)} onChange={(q) => setQty(product.slug, q)} />
                  <button
                    type="button"
                    onClick={() => setRemoving(product)}
                    aria-label={t("removeLabel", { name: product.name })}
                    title={t("remove")}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-chocolate/60 transition-colors hover:bg-red-700/10 hover:text-red-700"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
          {outOfStock.map((product) => (
            <li key={product.slug} className="flex gap-4 py-6 pl-8 sm:gap-5 sm:pl-9">
              <Link
                href={`/products/${product.slug}/`}
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-ivory opacity-50 sm:h-28 sm:w-28"
              >
                <Image src={product.images[0]} alt={product.name} fill sizes="112px" className="object-cover" />
              </Link>
              <div className="flex flex-1 flex-col justify-between gap-3">
                <div>
                  <Link href={`/products/${product.slug}/`} className="font-medium text-chocolate/60 hover:text-gold">
                    {product.name}
                  </Link>
                  <p className="mt-1 text-sm text-chocolate/60">{product.size}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-red-700/10 px-4 py-1.5 text-xs uppercase tracking-[0.15em] text-red-800">
                    {t("outOfStock")}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRemoving(product)}
                    aria-label={t("removeLabel", { name: product.name })}
                    title={t("remove")}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-chocolate/60 transition-colors hover:bg-red-700/10 hover:text-red-700"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <aside className="h-fit rounded-[2rem] bg-ivory p-6 md:p-8">
        <h2 className="mb-6 text-sm uppercase tracking-[0.2em]">{t("orderSummary")}</h2>
        <OrderSummary subtotal={subtotal} shipping={shipping} total={total} />
        {outOfStock.length > 0 && <p className="mt-6 text-xs text-chocolate/60">{t("outOfStockNote")}</p>}
        {lines.length > 0 && selected.length === 0 && <p className="mt-6 text-xs text-chocolate/60">{t("noneSelected")}</p>}
        {lines.length > 0 && (
          <PayButton className="mt-6 md:mt-8" tag={tag} onClick={goToCheckout} disabled={selected.length === 0} razorpay={razorpay}>
            {t("checkout")}
          </PayButton>
        )}
        {lines.length > 0 && razorpay && <SecurePaymentBadge className="mt-4" />}
      </aside>

      {/* Phones and tablets: the total and Checkout stay pinned to the bottom of the screen while
          scrolling. Large screens have the summary beside the list instead. */}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-chocolate/10 bg-cream/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_-12px_rgba(60,35,20,0.25)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-4">
            <div className="shrink-0">
              <p className="text-xs text-chocolate/60">{t("summary.total")}</p>
              <p className="text-lg font-semibold leading-tight">{formatPrice(total)}</p>
              <p className="text-[0.65rem] text-chocolate/55">{t("selectedCount", { count: selected.length, total: lines.length })}</p>
            </div>
            <PayButton
              className="!min-h-14 flex-1 !max-w-none"
              tag={tag}
              onClick={goToCheckout}
              disabled={selected.length === 0}
              razorpay={razorpay}
            >
              {t("checkout")}
            </PayButton>
          </div>
        </div>
      )}

      {removing && (
        <RemoveItemDialog
          product={removing}
          onMoveToWishlist={() => {
            moveToWishlist(removing.slug);
            setRemoving(null);
          }}
          onRemove={() => {
            setQty(removing.slug, 0);
            setRemoving(null);
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

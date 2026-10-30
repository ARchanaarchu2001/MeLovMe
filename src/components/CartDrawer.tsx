"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TrashIcon } from "./Icons";
import OrderSummary from "./OrderSummary";
import PayButton, { SecurePaymentBadge } from "./PayButton";
import Price from "./Price";
import QtyStepper from "./QtyStepper";
import RemoveItemDialog from "./RemoveItemDialog";
import { MAX_QTY, isMobileView, onAddedToCart, onOpenCartDrawer, setQty, setSelected, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { maxQtyFor, offerStatus, type Product } from "@/lib/product";
import { moveToWishlist } from "@/lib/wishlist";

// Phones only: the cart as a panel sliding in from the right, over the page. Opens from the header's cart icon
// and whenever a product is added; Checkout goes on from here. Not on the cart and checkout pages,
// which show the cart themselves. A native <dialog>: Escape closes it and focus stays inside.
// `razorpay`: online payment is switched on (/admin/payments), so Checkout shows Razorpay's badges.
export default function CartDrawer({ razorpay }: { razorpay: boolean }) {
  const t = useTranslations("cart");
  const router = useRouter();
  const pathname = usePathname();
  const { lines, selected, outOfStock, subtotal, shipping, total } = useCart();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  // The product whose dustbin was clicked, while the "remove item?" dialog is open
  const [removing, setRemoving] = useState<Product | null>(null);
  const onCartPages = /^\/(cart|checkout)/.test(pathname);

  useEffect(() => onOpenCartDrawer(() => setOpen(true)), []);
  // Open when something is added, except where the cart is already on screen
  useEffect(() => onAddedToCart(() => !onCartPages && isMobileView() && setOpen(true)), [onCartPages]);

  // Turning a tablet or widening the window past phone size: larger screens don't use the drawer
  useEffect(() => {
    if (!open) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const onChange = () => desktop.matches && setOpen(false);
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [open]);

  // Close when the customer moves to another page (Checkout, a product link...)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Show or hide the <dialog>, and keep the page behind from scrolling while it's open
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  const empty = lines.length === 0 && outOfStock.length === 0;
  // Only when something in the cart is actually on offer (a running offer or a combo price)
  const tag = selected.some((l) => l.comboSaving > 0 || offerStatus(l.product.offer) === "active") ? t("limitedOffer") : undefined;
  const close = () => setOpen(false);

  return (
    <dialog
      ref={ref}
      onClose={close}
      // A click on the dimmed backdrop lands on the <dialog> itself
      onClick={(e) => e.target === ref.current && close()}
      aria-labelledby="cart-drawer-title"
      className="animate-drawer-in fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-md bg-cream p-0 text-chocolate shadow-2xl backdrop:bg-espresso/50"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-chocolate/10 px-5 py-4">
          <h2 id="cart-drawer-title" className="text-sm font-medium uppercase tracking-[0.2em]">
            {t("drawer.title")}
            {lines.length > 0 && <span className="ml-2 text-chocolate/50">({lines.length})</span>}
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("drawer.close")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-chocolate/60 transition-colors hover:bg-chocolate/10 hover:text-chocolate"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="text-chocolate/70">{t("empty")}</p>
            <Link href="/products/" onClick={close} className="btn btn-primary mt-6 md:mt-8">{t("shopProducts")}</Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto bg-ivory/40 px-4 py-4">
              <ul className="grid gap-3">
                {lines.map(({ product, qty, total, comboSaving, selected: picked }) => (
                  <li
                    key={product.slug}
                    className={`flex gap-3 rounded-2xl bg-cream p-3 shadow-sm transition-opacity ${picked ? "" : "opacity-60"}`}
                  >
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={(e) => setSelected([product.slug], e.target.checked)}
                      aria-label={t("selectLabel", { name: product.name })}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-gold"
                    />
                    <Link
                      href={`/products/${product.slug}/`}
                      onClick={close}
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ivory"
                    >
                      <Image src={product.images[0]} alt={product.name} fill sizes="80px" className="object-cover" />
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link href={`/products/${product.slug}/`} onClick={close} className="line-clamp-2 text-sm font-medium hover:text-gold">
                            {product.name}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-chocolate/60">
                            {product.size} · <Price product={product} showBadge={false} />
                          </p>
                        </div>
                        <p className="shrink-0 text-right text-sm font-medium text-gold">
                          {formatPrice(total)}
                          {comboSaving > 0 && <s className="block text-[0.7rem] font-normal text-chocolate/50">{formatPrice(total + comboSaving)}</s>}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <QtyStepper qty={qty} max={maxQtyFor(product, MAX_QTY)} onChange={(q) => setQty(product.slug, q)} />
                        <button
                          type="button"
                          onClick={() => setRemoving(product)}
                          aria-label={t("removeLabel", { name: product.name })}
                          title={t("remove")}
                          className="flex h-9 w-9 items-center justify-center rounded-full text-chocolate/60 transition-colors hover:bg-red-700/10 hover:text-red-700"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
                {outOfStock.map((product) => (
                  <li key={product.slug} className="flex items-center gap-3 rounded-2xl bg-cream p-3 pl-10 shadow-sm">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ivory opacity-50">
                      <Image src={product.images[0]} alt="" fill sizes="64px" className="object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-chocolate/60">{product.name}</p>
                      <span className="mt-1 inline-block rounded-full bg-red-700/10 px-3 py-0.5 text-[0.65rem] uppercase tracking-[0.15em] text-red-800">
                        {t("outOfStock")}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRemoving(product)}
                      aria-label={t("removeLabel", { name: product.name })}
                      title={t("remove")}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-chocolate/60 transition-colors hover:bg-red-700/10 hover:text-red-700"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>

              {lines.length > 0 && (
                <div className="mt-4 rounded-2xl bg-cream p-4 shadow-sm">
                  <h3 className="mb-4 text-xs uppercase tracking-[0.2em]">{t("orderSummary")}</h3>
                  <OrderSummary subtotal={subtotal} shipping={shipping} total={total} />
                </div>
              )}
              {outOfStock.length > 0 && <p className="mt-3 text-xs text-chocolate/60">{t("outOfStockNote")}</p>}
              <Link
                href="/cart/"
                onClick={close}
                className="mt-4 block text-center text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold"
              >
                {t("drawer.viewCart")}
              </Link>
            </div>

            {lines.length > 0 && (
              <div className="border-t border-chocolate/10 bg-cream px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_-12px_rgba(60,35,20,0.25)]">
                {selected.length === 0 && <p className="mb-2 text-center text-xs text-chocolate/60">{t("noneSelected")}</p>}
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <p className="text-xs text-chocolate/60">{t("summary.total")}</p>
                    <p className="text-lg font-semibold leading-tight">{formatPrice(total)}</p>
                  </div>
                  <PayButton
                    className="!min-h-14 flex-1 !max-w-none"
                    tag={tag}
                    onClick={() => router.push("/checkout/")}
                    disabled={selected.length === 0}
                    razorpay={razorpay}
                  >
                    {t("checkout")}
                  </PayButton>
                </div>
                {razorpay && <SecurePaymentBadge className="mx-auto mt-2" />}
              </div>
            )}
          </>
        )}
      </div>

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
    </dialog>
  );
}

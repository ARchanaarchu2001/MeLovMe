"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { TrashIcon } from "./Icons";
import OrderSummary from "./OrderSummary";
import QtyStepper from "./QtyStepper";
import RemoveItemDialog from "./RemoveItemDialog";
import Price from "./Price";
import type { Product } from "@/lib/product";
import { setQty, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { moveToWishlist } from "@/lib/wishlist";

export default function CartView() {
  const t = useTranslations("cart");
  const { ready, lines, subtotal, shipping, total } = useCart();
  // The product whose dustbin was clicked, while the "remove item?" dialog is open
  const [removing, setRemoving] = useState<Product | null>(null);

  // Cart is read from localStorage, so nothing to show until the browser has loaded it
  if (!ready) return <div className="min-h-[40vh]" />;

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-chocolate/70">{t("empty")}</p>
        <Link href="/products/" className="btn btn-primary mt-8">{t("shopProducts")}</Link>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_22rem]">
      <ul className="divide-y divide-chocolate/10 border-y border-chocolate/10">
        {lines.map(({ product, qty, total }) => (
          <li key={product.slug} className="flex gap-5 py-6">
            <Link
              href={`/products/${product.slug}/`}
              className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-ivory sm:h-28 sm:w-28"
            >
              <Image src={product.images[0]} alt={product.name} fill sizes="112px" className="object-cover" />
            </Link>
            <div className="flex flex-1 flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Link href={`/products/${product.slug}/`} className="font-medium hover:text-gold">
                    {product.name}
                  </Link>
                  <p className="mt-1 text-sm text-chocolate/60">
                    {product.size} · <Price product={product} showBadge={false} />
                  </p>
                </div>
                <p className="font-medium text-gold">{formatPrice(total)}</p>
              </div>
              <div className="flex items-center justify-between">
                <QtyStepper qty={qty} onChange={(q) => setQty(product.slug, q)} />
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

      <aside className="h-fit rounded-[2rem] bg-ivory p-8">
        <h2 className="mb-6 text-sm uppercase tracking-[0.2em]">{t("orderSummary")}</h2>
        <OrderSummary subtotal={subtotal} shipping={shipping} total={total} />
        <Link href="/checkout/" className="btn btn-primary mt-8 w-full">{t("checkout")}</Link>
        <p className="mt-4 text-center text-xs text-chocolate/60">{t("securePayment")}</p>
      </aside>

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

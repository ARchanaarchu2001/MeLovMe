"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { TrashIcon } from "./Icons";
import Price from "./Price";
import { moveToCart, removeFromWishlist, useWishlist } from "@/lib/wishlist";

export default function WishlistView() {
  const t = useTranslations("cart.wishlist");
  const { ready, products } = useWishlist();

  // Wishlist is read from localStorage, so nothing to show until the browser has loaded it
  if (!ready) return <div className="min-h-[40vh]" />;

  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-chocolate/70">{t("empty")}</p>
        <Link href="/products/" className="btn btn-primary mt-8">{t("shopProducts")}</Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-chocolate/10 border-y border-chocolate/10">
      {products.map((product) => (
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
                <p className="mt-1 text-sm text-chocolate/60">{product.size}</p>
              </div>
              <Price product={product} className="justify-end" />
            </div>
            <div className="flex items-center justify-between gap-4">
              <button type="button" onClick={() => moveToCart(product.slug)} className="btn btn-primary !px-6 !py-3">
                {t("moveToCart")}
              </button>
              <button
                type="button"
                onClick={() => removeFromWishlist(product.slug)}
                aria-label={t("removeLabel", { name: product.name })}
                title={t("remove")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-chocolate/60 transition-colors hover:bg-red-700/10 hover:text-red-700"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

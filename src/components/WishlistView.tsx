"use client";

import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { moveToCart, removeFromWishlist, useWishlist } from "@/lib/wishlist";

export default function WishlistView() {
  const { ready, products } = useWishlist();

  // Wishlist is read from localStorage, so nothing to show until the browser has loaded it
  if (!ready) return <div className="min-h-[40vh]" />;

  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-chocolate/70">Your wishlist is empty.</p>
        <Link href="/products/" className="btn btn-primary mt-8">Shop Products</Link>
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
              <p className="font-medium text-gold">{formatPrice(product.price)}</p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button type="button" onClick={() => moveToCart(product.slug)} className="btn btn-primary !px-6 !py-3">
                Move to Cart
              </button>
              <button
                type="button"
                onClick={() => removeFromWishlist(product.slug)}
                className="text-xs uppercase tracking-[0.2em] text-chocolate/60 hover:text-gold"
              >
                Remove
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

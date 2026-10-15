"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { Product } from "@/data/products";

// Asks before taking an item out of the cart, offering to keep it in the wishlist instead.
// A native <dialog>: Escape closes it and focus stays inside while it's open.
export default function RemoveItemDialog({
  product,
  onMoveToWishlist,
  onRemove,
  onClose,
}: {
  product: Product;
  onMoveToWishlist: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      // A click on the dimmed backdrop lands on the <dialog> itself
      onClick={(e) => e.target === ref.current && ref.current.close()}
      aria-labelledby="remove-item-title"
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-[2rem] bg-cream p-0 text-chocolate backdrop:bg-espresso/50"
    >
      <div className="relative p-8">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-chocolate/60 transition-colors hover:bg-chocolate/10 hover:text-chocolate"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <div className="flex items-center gap-4 pr-8">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ivory">
            <Image src={product.images[0]} alt="" fill sizes="64px" className="object-cover" />
          </div>
          <div>
            <h2 id="remove-item-title" className="font-medium">Remove item?</h2>
            <p className="mt-1 text-sm text-chocolate/60">{product.name}</p>
          </div>
        </div>

        <p className="mt-6 text-sm text-chocolate/75">Save it to your wishlist to buy later, or remove it from your cart.</p>

        <div className="mt-6 grid gap-3">
          <button type="button" onClick={onMoveToWishlist} className="btn btn-primary w-full" autoFocus>
            Move to Wishlist
          </button>
          <button type="button" onClick={onRemove} className="btn btn-outline w-full">
            Remove
          </button>
        </div>
      </div>
    </dialog>
  );
}

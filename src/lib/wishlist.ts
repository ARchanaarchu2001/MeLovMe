import { useCatalog } from "@/components/CatalogProvider";
import type { Product } from "./product";
import { addToCart, setQty } from "./cart";
import { createStore, useReady } from "./store";

// Wishlist is a list of product slugs, saved in the visitor's browser like the cart.
// Stored data is untrusted: keep only strings, once each. Products that no longer exist or are
// disabled are skipped in useWishlist().
const store = createStore<string>("melovme-wishlist", (raw) => [
  ...new Set(raw.filter((s): s is string => typeof s === "string")),
]);

export function addToWishlist(slug: string) {
  const items = store.get();
  if (!items.includes(slug)) store.set([...items, slug]);
}

export function removeFromWishlist(slug: string) {
  store.set(store.get().filter((s) => s !== slug));
}

export function toggleWishlist(slug: string) {
  if (store.get().includes(slug)) removeFromWishlist(slug);
  else addToWishlist(slug);
}

// Take a product out of the cart but keep it saved for later
export function moveToWishlist(slug: string) {
  addToWishlist(slug);
  setQty(slug, 0);
}

export function moveToCart(slug: string) {
  addToCart(slug);
  removeFromWishlist(slug);
}

export function useWishlist() {
  const slugs = store.useItems();
  const ready = useReady();
  const catalog = useCatalog();
  const products = slugs.flatMap((s): Product[] => {
    const product = catalog.get(s);
    return product ? [product] : [];
  });

  return { ready, products, count: products.length, has: (slug: string) => slugs.includes(slug) };
}

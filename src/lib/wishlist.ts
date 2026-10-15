import { getProduct, type Product } from "@/data/products";
import { addToCart, setQty } from "./cart";
import { createStore, useReady } from "./store";

// Wishlist is a list of product slugs, saved in the visitor's browser like the cart.
// Stored data is untrusted: keep only known products, once each
const store = createStore<string>("melovme-wishlist", (raw) => [
  ...new Set(raw.filter((s): s is string => typeof s === "string" && !!getProduct(s))),
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
  const products = slugs.flatMap((s): Product[] => {
    const product = getProduct(s);
    return product ? [product] : [];
  });

  return { ready, products, count: products.length, has: (slug: string) => slugs.includes(slug) };
}

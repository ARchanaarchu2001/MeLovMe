import { useCatalog } from "@/components/CatalogProvider";
import { priceOf, type Product } from "./product";
import { MAX_QTY, shippingFor, type CartItem } from "./order";
import { createStore, useReady } from "./store";

export { MAX_QTY, shippingFor, type CartItem };
// `price` is the unit price right now (the offer price during an offer), `mrp` the regular price
export type CartLine = { product: Product; qty: number; price: number; mrp: number; total: number };

// Stored data is untrusted: keep only well-formed items with a sane quantity.
// Products that no longer exist or are disabled are skipped in useCart().
const store = createStore<CartItem>("melovme-cart", (raw) =>
  (raw as CartItem[])
    .filter((i) => typeof i?.slug === "string" && Number.isInteger(i.qty) && i.qty > 0)
    .map((i) => ({ slug: i.slug, qty: Math.min(i.qty, MAX_QTY) })),
);

export function addToCart(slug: string, qty = 1) {
  const items = store.get();
  const existing = items.find((i) => i.slug === slug);
  store.set(
    existing
      ? items.map((i) => (i.slug === slug ? { ...i, qty: Math.min(i.qty + qty, MAX_QTY) } : i))
      : [...items, { slug, qty: Math.min(qty, MAX_QTY) }],
  );
}

export function setQty(slug: string, qty: number) {
  const items = store.get();
  store.set(
    qty <= 0
      ? items.filter((i) => i.slug !== slug)
      : items.map((i) => (i.slug === slug ? { ...i, qty: Math.min(qty, MAX_QTY) } : i)),
  );
}

export function clearCart() {
  store.set([]);
}

export function useCart() {
  const items = store.useItems();
  const ready = useReady();
  const catalog = useCatalog();

  const lines: CartLine[] = items.flatMap((i) => {
    const product = catalog.get(i.slug);
    if (!product) return [];
    const { price, mrp } = priceOf(product);
    return [{ product, qty: i.qty, price, mrp, total: price * i.qty }];
  });
  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const shipping = shippingFor(subtotal);

  return {
    ready,
    lines,
    count: lines.reduce((sum, l) => sum + l.qty, 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}

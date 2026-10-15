import { getProduct, type Product } from "@/data/products";
import { MAX_QTY, shippingFor, type CartItem } from "./order";
import { createStore, useReady } from "./store";

export { MAX_QTY, shippingFor, type CartItem };
export type CartLine = { product: Product; qty: number; total: number };

// Stored data is untrusted: keep only known products with a sane quantity
const store = createStore<CartItem>("melovme-cart", (raw) =>
  (raw as CartItem[])
    .filter((i) => typeof i?.slug === "string" && getProduct(i.slug) && Number.isInteger(i.qty) && i.qty > 0)
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

  const lines: CartLine[] = items.flatMap((i) => {
    const product = getProduct(i.slug);
    return product ? [{ product, qty: i.qty, total: product.price * i.qty }] : [];
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

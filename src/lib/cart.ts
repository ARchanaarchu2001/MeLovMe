import { useCatalog } from "@/components/CatalogProvider";
import { lineTotal, maxQtyFor, priceOf, type Product } from "./product";
import { MAX_QTY, shippingFor, type CartItem } from "./order";
import { createStore, useReady } from "./store";

export { MAX_QTY, shippingFor, type CartItem };
// `price` is the unit price right now (the offer price during an offer), `mrp` the regular price.
// `total` uses combo offers where they apply; `comboSaving` is what they took off price × qty.
export type CartLine = { product: Product; qty: number; price: number; mrp: number; total: number; comboSaving: number };

// Stored data is untrusted: keep only well-formed items with a sane quantity.
// Products that no longer exist or are disabled are skipped in useCart(); out-of-stock ones are
// kept in the cart but left out of the order (see `outOfStock`).
const store = createStore<CartItem>("melovme-cart", (raw) =>
  (raw as CartItem[])
    .filter((i) => typeof i?.slug === "string" && Number.isInteger(i.qty) && i.qty > 0)
    .map((i) => ({ slug: i.slug, qty: Math.min(i.qty, MAX_QTY) })),
);

// The "added to cart" pop-up (CartToast) listens here
const addedListeners = new Set<(slug: string) => void>();

export function onAddedToCart(listener: (slug: string) => void) {
  addedListeners.add(listener);
  return () => {
    addedListeners.delete(listener);
  };
}

// Adds `qty` more, or with `exact` makes the cart hold exactly `qty` (picking a combo on the product page)
export function addToCart(slug: string, qty = 1, { notify = true, exact = false } = {}) {
  if (notify) addedListeners.forEach((l) => l(slug));
  const items = store.get();
  const existing = items.find((i) => i.slug === slug);
  store.set(
    existing
      ? items.map((i) => (i.slug === slug ? { ...i, qty: Math.min(exact ? qty : i.qty + qty, MAX_QTY) } : i))
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

  const outOfStock: Product[] = [];
  const lines: CartLine[] = items.flatMap((i) => {
    const product = catalog.get(i.slug);
    if (!product) return [];
    if (!product.inStock) {
      outOfStock.push(product);
      return [];
    }
    const { price, mrp } = priceOf(product);
    // Never more than are in stock (stock may have dropped since it was added)
    const qty = Math.min(i.qty, maxQtyFor(product, MAX_QTY));
    const { total, saving } = lineTotal(product, qty);
    return [{ product, qty, price, mrp, total, comboSaving: saving }];
  });
  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const shipping = shippingFor(subtotal);

  return {
    ready,
    lines,
    outOfStock, // in the cart but can't be bought right now
    count: lines.reduce((sum, l) => sum + l.qty, 0),
    subtotal,
    shipping,
    total: subtotal + shipping,
  };
}

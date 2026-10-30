// A product as the shop and the admin see it. Products live in MongoDB (`products` collection)
// and are managed from /admin/products.

// A discount on one product, optionally limited to a date range (dates are India time)
export type Offer = {
  type: "percent" | "flat"; // % off, or ₹ off
  value: number;
  startsAt?: string; // ISO date-time; the offer starts at the beginning of that day
  endsAt?: string; // ISO date-time; the offer ends at the end of that day
};

// A quantity deal on one product: `qty` pieces for `price` rupees in total, e.g. 2 for ₹3,000
export type Combo = {
  qty: number;
  price: number;
  tag?: "popular" | "best"; // shown on the card: "Most popular" / "Best value"
};

export const MAX_COMBOS = 4;

export type Product = {
  slug: string; // URL name, e.g. "signature-body-lotion" (fixed once created)
  name: string;
  categoryId: string; // see src/lib/category.ts ("" if its category was lost)
  category: string; // that category's name, for showing
  size: string;
  price: number; // regular price in rupees (MRP)
  shortDescription: string;
  description: string;
  images: string[]; // first one is the main image
  highlights: string[];
  ingredients: string[];
  howToUse: string;
  enabled: boolean; // disabled products are hidden from the shop and can't be bought
  // Units on hand, set in the admin; goes down as orders are paid. null = not counted (products
  // saved before stock counts existed), then the old in/out of stock switch decides.
  stock: number | null;
  inStock: boolean; // stock > 0. Out-of-stock products are still shown, but can't be added to the cart or bought
  offer?: Offer | null;
  combos: Combo[]; // sorted by qty; empty when there are none
};

// Where an offer is in its date range: running, not started yet, or over
export function offerStatus(offer: Offer | null | undefined, now = Date.now()) {
  if (!offer || !(offer.value > 0)) return null;
  if (offer.startsAt && now < Date.parse(offer.startsAt)) return "upcoming";
  if (offer.endsAt && now > Date.parse(offer.endsAt)) return "ended";
  return "active";
}

// What the customer pays right now: the offer price while an offer runs, otherwise the regular price.
// `mrp` is the regular price and `off` the rounded % saved (0 without an offer).
export function priceOf(p: Pick<Product, "price" | "offer">, now = Date.now()) {
  const offer = p.offer;
  if (!offer || offerStatus(offer, now) !== "active") return { price: p.price, mrp: p.price, off: 0 };
  const discount = offer.type === "percent" ? (p.price * offer.value) / 100 : offer.value;
  // Whole rupees, and never below ₹1 (Razorpay's minimum)
  const price = Math.max(1, Math.round(p.price - discount));
  return { price, mrp: p.price, off: Math.round(((p.price - price) / p.price) * 100) };
}

// Whole days until a running offer's last day, counted in India dates: 0 on the last day itself,
// 1 the day before... null when the offer has no end date or isn't running.
export function offerDaysLeft(offer: Offer | null | undefined, now = Date.now()) {
  if (!offer?.endsAt || offerStatus(offer, now) !== "active") return null;
  const indiaDay = (t: number) => Date.parse(new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  return Math.round((indiaDay(Date.parse(offer.endsAt)) - indiaDay(now)) / 864e5);
}

// At or below this many units the shop says "Only 3 left"
export const LOW_STOCK = 5;

// The most of this product one order can have: the cart limit, or fewer when stock is low
export const maxQtyFor = (p: Pick<Product, "stock">, cartLimit: number) =>
  p.stock == null ? cartLimit : Math.max(0, Math.min(cartLimit, p.stock));

// Combos worth showing right now: cheaper than buying that many single pieces at today's price
// (an offer can make single pieces cheaper than a combo)
export function activeCombos(p: Pick<Product, "price" | "offer" | "combos">, now = Date.now()) {
  const { price } = priceOf(p, now);
  return (p.combos ?? []).filter((c) => c.price < price * c.qty);
}

// What `qty` pieces cost, using combos where they help: the cheapest mix of combos and single
// pieces (5 pieces with 2- and 3-piece combos = one of each). `saving` is what combos took off
// buying them one by one at today's price.
export function lineTotal(p: Pick<Product, "price" | "offer" | "combos">, qty: number, now = Date.now()) {
  const { price } = priceOf(p, now);
  const combos = activeCombos(p, now);
  const best = [0];
  for (let n = 1; n <= qty; n++) {
    best[n] = best[n - 1] + price;
    for (const c of combos) if (c.qty <= n) best[n] = Math.min(best[n], best[n - c.qty] + c.price);
  }
  return { total: best[qty], saving: price * qty - best[qty] };
}

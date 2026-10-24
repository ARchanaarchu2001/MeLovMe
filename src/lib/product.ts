// A product as the shop and the admin see it. Products live in MongoDB (`products` collection)
// and are managed from /admin/products.

// A discount on one product, optionally limited to a date range (dates are India time)
export type Offer = {
  type: "percent" | "flat"; // % off, or ₹ off
  value: number;
  startsAt?: string; // ISO date-time; the offer starts at the beginning of that day
  endsAt?: string; // ISO date-time; the offer ends at the end of that day
};

export type Product = {
  slug: string; // URL name, e.g. "signature-body-lotion" (fixed once created)
  name: string;
  category: string;
  size: string;
  price: number; // regular price in rupees (MRP)
  shortDescription: string;
  description: string;
  images: string[]; // first one is the main image
  highlights: string[];
  ingredients: string[];
  howToUse: string;
  enabled: boolean; // disabled products are hidden from the shop and can't be bought
  offer?: Offer | null;
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

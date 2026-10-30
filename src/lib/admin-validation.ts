// Checks for the admin forms. The same functions run in the browser (errors show as soon as Save
// is pressed) and in the server actions (so nothing invalid is ever saved).

import { HEX_COLOR, type Announcement } from "@/lib/announcement";
import { MAX_QTY, fulfillments, type Fulfillment } from "@/lib/order";
import { MAX_COMBOS, type Offer, type Product } from "@/lib/product";
import { reviewLimits, type ReviewInput } from "@/lib/review";

// ---------- Products ----------

// What the product form sends. Offer dates are "YYYY-MM-DD" (India time). `stock` is null when
// editing and the count wasn't touched, so orders paid while the form was open aren't undone.
export type ProductInput = Omit<Product, "offer" | "inStock" | "category"> & {
  offer: { type: Offer["type"]; value: number; startDate: string; endDate: string } | null;
};
export type ProductErrors = Partial<Record<keyof ProductInput | "offerValue" | "offerDates", string>>;

export const productLimits = {
  slug: 60,
  name: 100,
  size: 50,
  shortDescription: 300,
  description: 5000,
  howToUse: 2000,
  images: 8,
  highlights: 20, // lines
  highlight: 200, // characters per line
  ingredients: 30,
  ingredient: 100,
  minShortDescription: 10,
  minDescription: 20,
  maxPrice: 1_000_000,
  maxStock: 1_000_000,
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_LETTER = /\p{L}/u;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

// The URL name made from a product name, e.g. "Rose Body Mist" → "rose-body-mist"
export const toSlug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, productLimits.slug).replace(/-+$/, "") ||
  "product";

// For number boxes (price, stock…): keeps only the digits of what's typed or pasted, up to `max` of them
export const onlyDigits = (s: string, max = String(productLimits.maxPrice).length) => s.replace(/\D/g, "").slice(0, max);

// Largest photo the admin can pick (it's shrunk in the browser before upload)
export const MAX_IMAGE_MB = 10;

// A real calendar date, e.g. not 2026-02-31
export const isDate = (s: string) => DATE.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
const tooLong = (max: number) => `Keep it under ${max} characters.`;
const filled = (v: string[]) => v.map((x) => x.trim()).filter(Boolean);

export function validateProduct(p: ProductInput): ProductErrors {
  const L = productLimits;
  const errors: ProductErrors = {};
  const name = p.name.trim();
  const size = p.size.trim();
  const shortDescription = p.shortDescription.trim();
  const description = p.description.trim();
  const price = p.price;

  if (!p.slug) errors.slug = "Enter a URL name.";
  else if (p.slug.length > L.slug) errors.slug = tooLong(L.slug);
  else if (!SLUG.test(p.slug)) errors.slug = "Use lowercase letters, numbers and dashes, e.g. rose-body-mist.";

  if (!name) errors.name = "Enter a name.";
  else if (name.length > L.name) errors.name = tooLong(L.name);
  else if (!HAS_LETTER.test(name)) errors.name = "The name must contain letters.";

  // Whether it exists and is a last-level category is checked on the server
  if (!p.categoryId) errors.categoryId = "Choose a category.";

  if (!size) errors.size = "Enter a size, e.g. 50 ml.";
  else if (size.length > L.size) errors.size = tooLong(L.size);
  else if (!HAS_LETTER_OR_DIGIT.test(size)) errors.size = "Enter a size, e.g. 50 ml.";

  if (!Number.isInteger(price) || price < 1 || price > L.maxPrice) {
    errors.price = "Enter a price in whole rupees (at least ₹1).";
  }
  if (p.stock !== null && !(Number.isInteger(p.stock) && p.stock >= 0 && p.stock <= L.maxStock)) {
    errors.stock = "Enter how many you have, in whole units (0 if none).";
  }

  if (!shortDescription) errors.shortDescription = "Enter a short description.";
  else if (shortDescription.length < L.minShortDescription) errors.shortDescription = `Write at least ${L.minShortDescription} characters.`;
  else if (shortDescription.length > L.shortDescription) errors.shortDescription = tooLong(L.shortDescription);

  if (!description) errors.description = "Enter a description.";
  else if (description.length < L.minDescription) errors.description = `Write at least ${L.minDescription} characters.`;
  else if (description.length > L.description) errors.description = tooLong(L.description);

  const highlights = filled(p.highlights);
  if (highlights.length > L.highlights) errors.highlights = `Up to ${L.highlights} highlights.`;
  else if (highlights.some((h) => h.length > L.highlight)) errors.highlights = `Keep each line under ${L.highlight} characters.`;

  const ingredients = filled(p.ingredients);
  if (ingredients.length > L.ingredients) errors.ingredients = `Up to ${L.ingredients} ingredients.`;
  else if (ingredients.some((h) => h.length > L.ingredient)) errors.ingredients = `Keep each line under ${L.ingredient} characters.`;

  if (p.howToUse.trim().length > L.howToUse) errors.howToUse = tooLong(L.howToUse);

  if (!p.images.length) errors.images = "Add at least one image.";
  else if (p.images.length > L.images) errors.images = `Up to ${L.images} images.`;

  const o = p.offer;
  if (o) {
    const value = o.value;
    if (o.type !== "percent" && o.type !== "flat") errors.offerValue = "Choose % off or ₹ off.";
    else if (!value) errors.offerValue = "Enter the discount."; // empty box: 0 or NaN
    else if (o.type === "percent" && !(Number.isInteger(value) && value >= 1 && value <= 90)) {
      errors.offerValue = "Enter a whole % between 1 and 90.";
    } else if (o.type === "flat" && !(Number.isInteger(value) && value >= 1 && (!Number.isInteger(price) || value < price))) {
      errors.offerValue = "Enter whole rupees, less than the price.";
    }
    const { startDate, endDate } = o;
    if ((startDate && !isDate(startDate)) || (endDate && !isDate(endDate))) errors.offerDates = "Enter valid dates.";
    else if (startDate && endDate && endDate < startDate) errors.offerDates = "The end date is before the start date.";
  }

  // Combos: 2 to MAX_QTY pieces, each quantity once, cheaper than buying them one by one
  if (p.combos.length > MAX_COMBOS) errors.combos = `Up to ${MAX_COMBOS} combos.`;
  const seen = new Set<number>();
  for (const { qty, price: total } of p.combos.slice(0, MAX_COMBOS)) {
    if (!(Number.isInteger(qty) && qty >= 2 && qty <= MAX_QTY)) {
      errors.combos = `Pieces must be a whole number from 2 to ${MAX_QTY}.`;
    } else if (seen.has(qty)) {
      errors.combos = `There are two combos for ${qty} pieces. Keep one.`;
    } else if (!(Number.isInteger(total) && total >= 1)) {
      errors.combos = `Enter the total price for ${qty} pieces in whole rupees.`;
    } else if (Number.isInteger(price) && total >= price * qty) {
      errors.combos = `${qty} pieces must cost less than ₹${price * qty} (${qty} × the price), or it isn't a deal.`;
    }
    if (errors.combos) break;
    seen.add(qty);
  }
  return errors;
}

export const stockError = (stock: number) =>
  Number.isInteger(stock) && stock >= 0 && stock <= productLimits.maxStock ? null : "Enter whole units (0 if none).";

// ---------- Orders ----------

export type OrderUpdateInput = { fulfillment: Fulfillment; courier: string; trackingNumber: string; adminNote: string };
export type OrderUpdateErrors = Partial<Record<keyof OrderUpdateInput, string>>;
export const orderLimits = { courier: 60, trackingNumber: 40, adminNote: 2000 };

export function validateOrderUpdate(input: OrderUpdateInput): OrderUpdateErrors {
  const errors: OrderUpdateErrors = {};
  const courier = input.courier.trim();
  const tracking = input.trackingNumber.trim();
  if (!fulfillments.includes(input.fulfillment)) errors.fulfillment = "Choose a valid status.";

  if (courier.length > orderLimits.courier) errors.courier = tooLong(orderLimits.courier);
  else if (courier && !/^[\p{L}\p{N}][\p{L}\p{N}\s&.'()-]*$/u.test(courier)) errors.courier = "Use letters and numbers only, e.g. Delhivery.";

  if (tracking.length > orderLimits.trackingNumber) errors.trackingNumber = tooLong(orderLimits.trackingNumber);
  else if (tracking && !/^[A-Za-z0-9-]{4,}$/.test(tracking)) errors.trackingNumber = "Use letters, numbers and dashes, at least 4.";
  // The customer can't use a tracking number without knowing the courier
  else if (tracking && !courier && !errors.courier) errors.courier = "Enter the courier for this tracking number.";

  if (input.adminNote.trim().length > orderLimits.adminNote) errors.adminNote = tooLong(orderLimits.adminNote);
  return errors;
}

// ---------- Announcement bar ----------

export type AnnouncementErrors = {
  form?: string;
  background?: string;
  textColor?: string;
  messages?: ({ text?: string; link?: string } | undefined)[]; // by row, as in the form
};
export const announcementLimits = { messages: 10, text: 120, link: 300 };
// A page of this shop ("/products/") or a secure link to another site
const LINK = /^(?:\/(?!\/)\S*|https:\/\/[^\s/]+\.[^\s/]+\S*)$/;

export function validateAnnouncement(a: Announcement): AnnouncementErrors {
  const L = announcementLimits;
  const errors: AnnouncementErrors = {};
  const rows = a.messages.map((m) => {
    const text = m.text.trim();
    const link = (m.link ?? "").trim();
    const e: { text?: string; link?: string } = {};
    if (!text && link) e.text = "Enter the message for this link, or remove the row.";
    else if (text.length > L.text) e.text = tooLong(L.text);
    if (link.length > L.link) e.link = tooLong(L.link);
    else if (link && !LINK.test(link)) e.link = "Start with / (a shop page) or https://";
    return e.text || e.link ? e : undefined;
  });
  if (rows.some(Boolean)) errors.messages = rows;

  const count = a.messages.filter((m) => m.text.trim()).length;
  if (count > L.messages) errors.form = `Up to ${L.messages} messages.`;
  else if (a.enabled && !count) errors.form = "Add at least one message, or switch the bar off.";
  if (!HEX_COLOR.test(a.background)) errors.background = "Enter a colour code like #2E1A11.";
  if (!HEX_COLOR.test(a.textColor)) errors.textColor = "Enter a colour code like #C9A36A.";
  if (!errors.background && !errors.textColor && a.background.toLowerCase() === a.textColor.toLowerCase()) {
    errors.textColor = "The text must be a different colour from the background.";
  }
  return errors;
}

export const hasAnnouncementErrors = (e: AnnouncementErrors) => Object.keys(e).length > 0;

// ---------- Reviews added by the shop ----------

export type AdminReviewErrors = Partial<Record<keyof ReviewInput | "productSlug", string>>;
// Letters, spaces and . ' - e.g. "Anjali R.", "D'Souza"
const PERSON_NAME = /^\p{L}[\p{L}\p{M}\s.'-]*$/u;

export function validateAdminReview(productSlug: string, r: ReviewInput): AdminReviewErrors {
  const errors: AdminReviewErrors = {};
  const name = r.name.trim();
  const title = r.title.trim();
  const text = r.text.trim();
  if (!productSlug) errors.productSlug = "Choose a product.";
  if (!(Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5)) errors.rating = "Choose a rating from 1 to 5 stars.";

  if (!name) errors.name = "Enter the name to show with the review.";
  else if (name.length < 2) errors.name = "Enter at least 2 letters.";
  else if (name.length > reviewLimits.name) errors.name = tooLong(reviewLimits.name);
  else if (!PERSON_NAME.test(name)) errors.name = "Use letters only, e.g. Anjali R.";

  if (title.length > reviewLimits.title) errors.title = tooLong(reviewLimits.title);

  if (!text) errors.text = "Write the review.";
  else if (text.length < reviewLimits.minText) errors.text = `Write at least ${reviewLimits.minText} characters.`;
  else if (text.length > reviewLimits.text) errors.text = tooLong(reviewLimits.text);
  return errors;
}

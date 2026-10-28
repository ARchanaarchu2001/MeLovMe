"use server";

import { ObjectId } from "mongodb";
import { HEX_COLOR, announcementSpeeds, type Announcement, type AnnouncementMessage } from "@/lib/announcement";
import { MAX_QTY, fulfillments, type Fulfillment } from "@/lib/order";
import { MAX_COMBOS, type Offer, type Product } from "@/lib/product";
import type { ReviewInput } from "@/lib/review";
import { refreshAnnouncement } from "@/lib/server/announcement";
import { cloudinaryCloudName } from "@/lib/server/cloudinary";
import { getDb } from "@/lib/server/db";
import { adjustStock, refreshCatalog } from "@/lib/server/products";
import { cleanReview, refreshReviews } from "@/lib/server/reviews";
import { requireAdmin } from "@/lib/server/session";

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// ---------- Orders ----------

export async function updateOrder(
  orderId: string,
  input: { fulfillment: Fulfillment; courier: string; trackingNumber: string; adminNote: string },
): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  if (!fulfillments.includes(input?.fulfillment)) return { error: "Choose a valid status." };

  const { orders } = await getDb();
  const before = await orders.findOneAndUpdate(
    // Only paid orders have a delivery status
    { _id: String(orderId), status: "paid" },
    {
      $set: {
        fulfillment: input.fulfillment,
        courier: str(input.courier, 60),
        trackingNumber: str(input.trackingNumber, 80),
        adminNote: str(input.adminNote, 2000),
        updatedAt: new Date(),
      },
    },
    { returnDocument: "before" },
  );
  if (!before) return { error: "Only paid orders can be updated." };
  // Cancelling puts the items back in stock; un-cancelling takes them out again
  const wasCancelled = before.fulfillment === "cancelled";
  const isCancelled = input.fulfillment === "cancelled";
  if (before.stockTaken && wasCancelled !== isCancelled) await adjustStock(before.items, isCancelled ? 1 : -1);
  return { ok: true };
}

// ---------- Products ----------

// What the product form sends. Offer dates are "YYYY-MM-DD" (India time). `stock` is null when
// editing and the count wasn't touched, so orders paid while the form was open aren't undone.
export type ProductInput = Omit<Product, "offer" | "inStock"> & {
  offer: { type: Offer["type"]; value: number; startDate: string; endDate: string } | null;
};
export type ProductErrors = Partial<Record<keyof ProductInput | "offerValue" | "offerDates", string>>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Only our own images: files in /public/images, or uploads in our Cloudinary account
const isOwnImage = (url: string) =>
  /^\/images\/[\w.-]+$/.test(url) ||
  (!!cloudinaryCloudName() && url.startsWith(`https://res.cloudinary.com/${cloudinaryCloudName()}/image/upload/`));
const lines = (v: unknown, maxItems: number, maxLength: number) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, maxLength)).filter(Boolean).slice(0, maxItems);

function cleanProduct(input: ProductInput): { product: Omit<Product, "inStock">; errors: ProductErrors } {
  const errors: ProductErrors = {};
  const price = Number(input?.price);
  const product: Omit<Product, "inStock"> = {
    slug: str(input?.slug, 60).toLowerCase(),
    name: str(input?.name, 100),
    category: str(input?.category, 50),
    size: str(input?.size, 50),
    price,
    shortDescription: str(input?.shortDescription, 300),
    description: str(input?.description, 5000),
    images: lines(input?.images, 8, 200),
    highlights: lines(input?.highlights, 20, 200),
    ingredients: lines(input?.ingredients, 30, 100),
    howToUse: str(input?.howToUse, 2000),
    enabled: input?.enabled === true,
    stock: input?.stock === null ? null : Number(input?.stock),
    offer: null,
    combos: [],
  };

  if (!SLUG.test(product.slug)) errors.slug = "Use lowercase letters, numbers and dashes, e.g. rose-body-mist.";
  if (!product.name) errors.name = "Enter a name.";
  if (!product.category) errors.category = "Enter a category.";
  if (!product.size) errors.size = "Enter a size, e.g. 50 ml.";
  if (!Number.isInteger(price) || price < 1 || price > 1_000_000) errors.price = "Enter a price in whole rupees (at least ₹1).";
  if (product.stock !== null && !(Number.isInteger(product.stock) && product.stock >= 0 && product.stock <= 1_000_000)) {
    errors.stock = "Enter how many you have, in whole units (0 if none).";
  }
  if (!product.shortDescription) errors.shortDescription = "Enter a short description.";
  if (!product.description) errors.description = "Enter a description.";
  if (!product.images.length) errors.images = "Add at least one image.";
  else if (!product.images.every(isOwnImage)) errors.images = "One of the images is not valid. Remove it and upload again.";

  const o = input?.offer;
  if (o) {
    const value = Number(o.value);
    if (o.type === "percent" && !(Number.isInteger(value) && value >= 1 && value <= 90)) {
      errors.offerValue = "Enter a whole % between 1 and 90.";
    } else if (o.type === "flat" && !(Number.isInteger(value) && value >= 1 && value < price)) {
      errors.offerValue = "Enter whole rupees, less than the price.";
    } else if (o.type !== "percent" && o.type !== "flat") {
      errors.offerValue = "Choose % off or ₹ off.";
    }
    const startDate = str(o.startDate, 10);
    const endDate = str(o.endDate, 10);
    if ((startDate && !DATE.test(startDate)) || (endDate && !DATE.test(endDate))) errors.offerDates = "Enter valid dates.";
    else if (startDate && endDate && endDate < startDate) errors.offerDates = "The end date is before the start date.";
    product.offer = {
      type: o.type,
      value,
      // Dates are India time: start of the first day to end of the last day
      ...(startDate && { startsAt: new Date(`${startDate}T00:00:00+05:30`).toISOString() }),
      ...(endDate && { endsAt: new Date(`${endDate}T23:59:59+05:30`).toISOString() }),
    };
  }
  // Combos: 2 to MAX_QTY pieces, each quantity once, cheaper than buying them one by one
  const combos = (Array.isArray(input?.combos) ? input.combos : []).slice(0, MAX_COMBOS);
  for (const c of combos) {
    const qty = Number(c?.qty);
    const total = Number(c?.price);
    if (!(Number.isInteger(qty) && qty >= 2 && qty <= MAX_QTY)) {
      errors.combos = `Pieces must be a whole number from 2 to ${MAX_QTY}.`;
    } else if (product.combos.some((x) => x.qty === qty)) {
      errors.combos = `There are two combos for ${qty} pieces. Keep one.`;
    } else if (!(Number.isInteger(total) && total >= 1)) {
      errors.combos = `Enter the total price for ${qty} pieces in whole rupees.`;
    } else if (Number.isInteger(price) && total >= price * qty) {
      errors.combos = `${qty} pieces must cost less than ₹${price * qty} (${qty} × the price), or it isn't a deal.`;
    } else {
      product.combos.push({ qty, price: total, ...((c.tag === "popular" || c.tag === "best") && { tag: c.tag }) });
    }
  }
  product.combos.sort((a, b) => a.qty - b.qty);
  return { product, errors };
}

// Creates a product (`isNew`) or updates the one with this slug (the slug itself can't change)
export async function saveProduct(
  input: ProductInput,
  isNew: boolean,
): Promise<{ errors: ProductErrors } | { ok: true; slug: string }> {
  await requireAdmin();
  const { product, errors } = cleanProduct(input);
  if (Object.keys(errors).length) return { errors };

  const { products } = await getDb();
  const { slug, stock, ...rest } = product;
  // A new product, or one from before stock counts, needs a count; otherwise null keeps the current one
  const counted = stock !== null ? { stock, inStock: stock > 0 } : null;
  const needCount = { errors: { stock: "Enter how many you have in stock." } };
  const now = new Date();
  if (isNew) {
    if (!counted) return needCount;
    if (await products.findOne({ _id: slug }, { projection: { _id: 1 } })) {
      return { errors: { slug: "Another product already uses this URL name." } };
    }
    await products.insertOne({ _id: slug, ...rest, ...counted, createdAt: now, updatedAt: now });
  } else {
    const doc = await products.findOne({ _id: slug }, { projection: { stock: 1 } });
    if (!doc) return { errors: { slug: "This product no longer exists." } };
    if (!counted && typeof doc.stock !== "number") return needCount;
    await products.updateOne({ _id: slug }, { $set: { ...rest, ...counted, updatedAt: now } });
  }
  refreshCatalog();
  return { ok: true, slug };
}

// The switch in the product list: shown in the shop or not
export async function setProductFlag(slug: string, flag: "enabled", value: boolean): Promise<{ ok: true }> {
  await requireAdmin();
  if (flag !== "enabled") throw new Error("Unknown product setting");
  await (await getDb()).products.updateOne({ _id: String(slug) }, { $set: { [flag]: value === true, updatedAt: new Date() } });
  refreshCatalog();
  return { ok: true };
}

// The stock box in the product list: sets how many units are on hand
export async function setProductStock(slug: string, stock: number): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  if (!(Number.isInteger(stock) && stock >= 0 && stock <= 1_000_000)) return { error: "Enter whole units (0 if none)." };
  await (await getDb()).products.updateOne({ _id: String(slug) }, { $set: { stock, inStock: stock > 0, updatedAt: new Date() } });
  refreshCatalog();
  return { ok: true };
}

// ---------- Announcement bar ----------

export async function saveAnnouncement(input: Announcement): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  const messages: AnnouncementMessage[] = (Array.isArray(input?.messages) ? input.messages : [])
    .map((m) => ({ text: str(m?.text, 120), link: str(m?.link, 300) }))
    .filter((m) => m.text)
    .slice(0, 10)
    .map(({ text, link }) => (link ? { text, link } : { text }));
  const announcement: Announcement = {
    enabled: input?.enabled === true,
    messages,
    background: str(input?.background, 7),
    textColor: str(input?.textColor, 7),
    speed: announcementSpeeds.includes(input?.speed) ? input.speed : "normal",
  };

  if (announcement.enabled && !messages.length) return { error: "Add at least one message, or switch the bar off." };
  if (!HEX_COLOR.test(announcement.background) || !HEX_COLOR.test(announcement.textColor)) return { error: "Choose valid colours." };
  // Links: a page of this shop ("/products/") or a secure link to another site
  const bad = messages.find((m) => m.link && !/^\/(?!\/)\S*$/.test(m.link) && !/^https:\/\/\S+$/.test(m.link));
  if (bad) return { error: `The link for “${bad.text}” must start with / (a shop page) or https://` };

  await (await getDb()).settings.updateOne(
    { _id: "announcement" },
    { $set: { ...announcement, updatedAt: new Date() } },
    { upsert: true },
  );
  refreshAnnouncement();
  return { ok: true };
}

// ---------- Reviews ----------

const reviewErrors = {
  rating: "Choose a rating from 1 to 5 stars.",
  name: "Enter the name to show with the review.",
  text: "Write the review (at least a few words).",
};
const toObjectId = (id: string) => (ObjectId.isValid(String(id)) ? new ObjectId(String(id)) : null);

// Adds a review from the shop (`id` null), or edits one the shop added. Customers' own reviews
// can't be edited here, only hidden or deleted.
export async function saveAdminReview(
  id: string | null,
  productSlug: string,
  input: ReviewInput,
): Promise<{ errors: Partial<Record<keyof ReviewInput | "productSlug", string>> } | { ok: true }> {
  const admin = await requireAdmin();
  const { review, errors } = cleanReview(input);
  const messages: Partial<Record<keyof ReviewInput | "productSlug", string>> = Object.fromEntries(
    Object.entries(errors).map(([k, v]) => [k, reviewErrors[v]]),
  );
  const { products, reviews } = await getDb();
  const slug = String(productSlug);
  if (!(await products.findOne({ _id: slug }, { projection: { _id: 1 } }))) messages.productSlug = "Choose a product.";
  if (Object.keys(messages).length) return { errors: messages };

  const now = new Date();
  if (id === null) {
    await reviews.insertOne({
      _id: new ObjectId(),
      productSlug: slug,
      source: "admin",
      addedBy: admin._id,
      ...review,
      verified: false,
      hidden: false,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    const _id = toObjectId(id);
    const res = _id && (await reviews.updateOne({ _id, source: "admin" }, { $set: { productSlug: slug, ...review, updatedAt: now } }));
    if (!res?.matchedCount) return { errors: { text: "This review no longer exists, or was written by a customer." } };
  }
  refreshReviews();
  return { ok: true };
}

// Hidden reviews stay in the database but aren't shown or counted in the shop
export async function setReviewHidden(id: string, hidden: boolean): Promise<{ ok: true }> {
  await requireAdmin();
  const _id = toObjectId(id);
  if (_id) await (await getDb()).reviews.updateOne({ _id }, { $set: { hidden: hidden === true, updatedAt: new Date() } });
  refreshReviews();
  return { ok: true };
}

export async function deleteReview(id: string): Promise<{ ok: true }> {
  await requireAdmin();
  const _id = toObjectId(id);
  if (_id) await (await getDb()).reviews.deleteOne({ _id });
  refreshReviews();
  return { ok: true };
}

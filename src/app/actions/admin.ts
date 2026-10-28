"use server";

import { ObjectId } from "mongodb";
import {
  hasAnnouncementErrors,
  productLimits,
  stockError,
  toSlug,
  validateAdminReview,
  validateAnnouncement,
  validateOrderUpdate,
  validateProduct,
  type AdminReviewErrors,
  type AnnouncementErrors,
  type OrderUpdateErrors,
  type OrderUpdateInput,
  type ProductErrors,
  type ProductInput,
} from "@/lib/admin-validation";
import { announcementSpeeds, type Announcement, type AnnouncementMessage } from "@/lib/announcement";
import type { Product } from "@/lib/product";
import type { ReviewInput } from "@/lib/review";
import { refreshAnnouncement } from "@/lib/server/announcement";
import { cloudinaryCloudName } from "@/lib/server/cloudinary";
import { getDb } from "@/lib/server/db";
import { adjustStock, refreshCatalog } from "@/lib/server/products";
import { cleanReview, refreshReviews } from "@/lib/server/reviews";
import { requireAdmin } from "@/lib/server/session";

// Text as typed, trimmed. Lengths are checked by the validators (with a message), not cut silently.
const text = (v: unknown) => String(v ?? "").trim();
const lines = (v: unknown) => (Array.isArray(v) ? v : []).map(text).filter(Boolean);

// ---------- Orders ----------

export async function updateOrder(
  orderId: string,
  input: OrderUpdateInput,
): Promise<{ error: string; errors?: OrderUpdateErrors } | { ok: true }> {
  await requireAdmin();
  const values: OrderUpdateInput = {
    fulfillment: input?.fulfillment,
    courier: text(input?.courier),
    trackingNumber: text(input?.trackingNumber),
    adminNote: text(input?.adminNote),
  };
  const errors = validateOrderUpdate(values);
  if (Object.keys(errors).length) return { error: "Please fix the highlighted fields.", errors };

  const { orders } = await getDb();
  const before = await orders.findOneAndUpdate(
    // Only paid orders have a delivery status
    { _id: String(orderId), status: "paid" },
    {
      $set: {
        fulfillment: values.fulfillment,
        courier: values.courier,
        trackingNumber: values.trackingNumber,
        adminNote: values.adminNote,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "before" },
  );
  if (!before) return { error: "Only paid orders can be updated." };
  // Cancelling puts the items back in stock; un-cancelling takes them out again
  const wasCancelled = before.fulfillment === "cancelled";
  const isCancelled = values.fulfillment === "cancelled";
  if (before.stockTaken && wasCancelled !== isCancelled) await adjustStock(before.items, isCancelled ? 1 : -1);
  return { ok: true };
}

// ---------- Products ----------

// Only our own images: files in /public/images, or uploads in our Cloudinary account
const isOwnImage = (url: string) =>
  /^\/images\/[\w.-]+$/.test(url) ||
  (!!cloudinaryCloudName() && url.startsWith(`https://res.cloudinary.com/${cloudinaryCloudName()}/image/upload/`));

function cleanProduct(input: ProductInput): { product: Omit<Product, "inStock">; errors: ProductErrors } {
  const o = input?.offer;
  const values: ProductInput = {
    slug: text(input?.slug).toLowerCase(),
    name: text(input?.name),
    category: text(input?.category),
    size: text(input?.size),
    price: Number(input?.price),
    shortDescription: text(input?.shortDescription),
    description: text(input?.description),
    images: lines(input?.images),
    highlights: lines(input?.highlights),
    ingredients: lines(input?.ingredients),
    howToUse: text(input?.howToUse),
    enabled: input?.enabled === true,
    stock: input?.stock === null ? null : Number(input?.stock),
    offer: o ? { type: o.type, value: Number(o.value), startDate: text(o.startDate), endDate: text(o.endDate) } : null,
    combos: (Array.isArray(input?.combos) ? input.combos : []).map((c) => ({
      qty: Number(c?.qty),
      price: Number(c?.price),
      ...((c?.tag === "popular" || c?.tag === "best") && { tag: c.tag }),
    })),
  };
  const errors = validateProduct(values);
  if (!errors.images && !values.images.every(isOwnImage)) errors.images = "One of the images is not valid. Remove it and upload again.";

  const { offer, ...rest } = values;
  const product: Omit<Product, "inStock"> = {
    ...rest,
    offer: offer && {
      type: offer.type,
      value: offer.value,
      // Dates are India time: start of the first day to end of the last day
      ...(offer.startDate && { startsAt: new Date(`${offer.startDate}T00:00:00+05:30`).toISOString() }),
      ...(offer.endDate && { endsAt: new Date(`${offer.endDate}T23:59:59+05:30`).toISOString() }),
    },
    combos: [...values.combos].sort((a, b) => a.qty - b.qty),
  };
  return { product, errors };
}

// Creates a product (`isNew`) or updates the one with this slug (the slug itself can't change).
// A new product's slug is made from its name, with -2, -3… added if another product has it.
export async function saveProduct(
  input: ProductInput,
  isNew: boolean,
): Promise<{ errors: ProductErrors } | { ok: true; slug: string }> {
  await requireAdmin();
  const { product, errors } = cleanProduct(isNew ? { ...input, slug: toSlug(text(input?.name)) } : input);
  if (Object.keys(errors).length) return { errors };

  const { products } = await getDb();
  const { slug: base, stock, ...rest } = product;
  let slug = base;
  // A new product, or one from before stock counts, needs a count; otherwise null keeps the current one
  const counted = stock !== null ? { stock, inStock: stock > 0 } : null;
  const needCount = { errors: { stock: "Enter how many you have in stock." } };
  const now = new Date();
  if (isNew) {
    if (!counted) return needCount;
    const taken = new Set(
      (await products.find({ _id: { $regex: `^${slug}(-\\d+)?$` } }, { projection: { _id: 1 } }).toArray()).map((p) => p._id),
    );
    for (let n = 2; taken.has(slug); n++) slug = `${base.slice(0, productLimits.slug - String(n).length - 1).replace(/-+$/, "")}-${n}`;
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
  const error = stockError(stock);
  if (error) return { error };
  await (await getDb()).products.updateOne({ _id: String(slug) }, { $set: { stock, inStock: stock > 0, updatedAt: new Date() } });
  refreshCatalog();
  return { ok: true };
}

// The delete button in the product list. Past orders keep their own copy of the item, so they're
// unaffected; the product's reviews go too, so a new product with the same URL name starts fresh.
export async function deleteProduct(slug: string): Promise<{ ok: true }> {
  await requireAdmin();
  const { products, reviews } = await getDb();
  const { deletedCount } = await products.deleteOne({ _id: String(slug) });
  if (deletedCount) {
    await reviews.deleteMany({ productSlug: String(slug) });
    refreshReviews();
  }
  refreshCatalog();
  return { ok: true };
}

// ---------- Announcement bar ----------

export async function saveAnnouncement(input: Announcement): Promise<{ errors: AnnouncementErrors } | { ok: true }> {
  await requireAdmin();
  const announcement: Announcement = {
    enabled: input?.enabled === true,
    messages: (Array.isArray(input?.messages) ? input.messages : []).map((m) => ({ text: text(m?.text), link: text(m?.link) })),
    background: text(input?.background),
    textColor: text(input?.textColor),
    speed: announcementSpeeds.includes(input?.speed) ? input.speed : "normal",
  };
  const errors = validateAnnouncement(announcement);
  if (hasAnnouncementErrors(errors)) return { errors };
  // Empty rows are dropped; a link is only stored when there is one
  announcement.messages = announcement.messages
    .filter((m) => m.text)
    .map(({ text, link }): AnnouncementMessage => (link ? { text, link } : { text }));

  await (await getDb()).settings.updateOne(
    { _id: "announcement" },
    { $set: { ...announcement, updatedAt: new Date() } },
    { upsert: true },
  );
  refreshAnnouncement();
  return { ok: true };
}

// ---------- Reviews ----------

const toObjectId = (id: string) => (ObjectId.isValid(String(id)) ? new ObjectId(String(id)) : null);

// Adds a review from the shop (`id` null), or edits one the shop added. Customers' own reviews
// can't be edited here, only hidden or deleted.
export async function saveAdminReview(
  id: string | null,
  productSlug: string,
  input: ReviewInput,
): Promise<{ errors: AdminReviewErrors } | { ok: true }> {
  const admin = await requireAdmin();
  const slug = text(productSlug);
  const values: ReviewInput = { name: text(input?.name), rating: Number(input?.rating), title: text(input?.title), text: text(input?.text) };
  const errors = validateAdminReview(slug, values);
  const { products, reviews } = await getDb();
  if (!errors.productSlug && !(await products.findOne({ _id: slug }, { projection: { _id: 1 } }))) errors.productSlug = "Choose a product.";
  if (Object.keys(errors).length) return { errors };
  const { review } = cleanReview(values);

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

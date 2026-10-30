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
import { categoryKey, categoryNameError, placementError, tidyCategoryName, type Category } from "@/lib/category";
import { formatPrice } from "@/lib/format";
import { placedStatuses, refundState, type Refund } from "@/lib/order";
import type { PaymentSettings } from "@/lib/payments";
import type { Product } from "@/lib/product";
import type { ReviewInput } from "@/lib/review";
import { refreshAnnouncement } from "@/lib/server/announcement";
import { cloudinaryCloudName } from "@/lib/server/cloudinary";
import { freeCategorySlug, getDb } from "@/lib/server/db";
import { syncPendingRefunds } from "@/lib/server/orders";
import { refreshPaymentSettings } from "@/lib/server/payments";
import { canBuy } from "@/lib/payments";
import { adjustStock, loadCategories, refreshCatalog } from "@/lib/server/products";
import { createRefund } from "@/lib/server/razorpay";
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
    // Only placed orders (paid, or cash on delivery) have a delivery status
    { _id: String(orderId), status: { $in: [...placedStatuses] } },
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
  if (!before) return { error: "Only placed orders can be updated." };
  // Remember when the delivery status changed, for the customer's tracker
  if ((before.fulfillment ?? "placed") !== values.fulfillment) {
    await orders.updateOne({ _id: before._id }, { $push: { statusHistory: { status: values.fulfillment, at: new Date() } } });
  }
  // Cancelling puts the items back in stock; un-cancelling takes them out again
  const wasCancelled = before.fulfillment === "cancelled";
  const isCancelled = values.fulfillment === "cancelled";
  if (before.stockTaken && wasCancelled !== isCancelled) await adjustStock(before.items, isCancelled ? 1 : -1);
  return { ok: true };
}

// Cash on delivery: the courier collected the cash, so the order is now paid
export async function markCodPaid(orderId: string): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  const res = await (await getDb()).orders.updateOne(
    { _id: String(orderId), status: "cod" },
    { $set: { status: "paid", paidAt: new Date(), payment: { method: "cod" }, updatedAt: new Date() } },
  );
  return res.matchedCount ? { ok: true } : { error: "This order isn't waiting for cash on delivery." };
}

// Refunds part or all of an online payment through Razorpay, until the order is delivered.
// Only the refund's status is recorded: the order's delivery status and stock are left as they are.
// "Check refund status": asks Razorpay about pending refunds, for one order (`orderId`) or all orders.
// Razorpay is only asked when the admin presses the button.
export async function checkRefundStatus(
  orderId?: string,
): Promise<{ orderId: string; refundId: string; amount: number; status: Refund["status"] | null }[]> {
  await requireAdmin();
  const list = await (await getDb()).orders
    .find({ ...(orderId && { _id: String(orderId) }), "refunds.status": "pending" })
    .limit(100)
    .toArray();
  return syncPendingRefunds(list);
}

export async function refundOrder(orderId: string, amount: number): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  const { orders } = await getDb();
  const order = await orders.findOne({ _id: String(orderId) });
  if (!order || order.status !== "paid" || order.paymentMethod === "cod" || !order.paymentId) {
    return { error: "Only orders paid online can be refunded here. Cash on delivery refunds are made by hand." };
  }
  if (order.fulfillment === "delivered") return { error: "Refunds aren't available once an order is delivered." };
  const { refundable } = refundState(order);
  if (!Number.isInteger(amount) || amount < 1) return { error: "Enter the amount to refund, in whole rupees." };
  if (amount > refundable) return { error: `You can refund up to ${formatPrice(refundable)}.` };

  let refund: { id: string; status: Refund["status"] };
  try {
    // A receipt per refund (order ID + number) stops a double click refunding twice
    refund = await createRefund(order.paymentId, amount, `${order._id}-R${(order.refunds?.length ?? 0) + 1}`);
  } catch (err) {
    return { error: `Razorpay couldn't make the refund: ${err instanceof Error ? err.message : "please try again"}` };
  }
  const now = new Date();
  await orders.updateOne(
    { _id: order._id },
    { $push: { refunds: { id: refund.id, amount, status: refund.status, createdAt: now } }, $set: { updatedAt: now } },
  );
  return { ok: true };
}

// ---------- Payment methods ----------

// At least one method must stay on, so customers can always buy
export async function savePaymentSettings(input: PaymentSettings): Promise<{ ok: true } | { error: string }> {
  await requireAdmin();
  const settings: PaymentSettings = {
    razorpay: input?.razorpay === true,
    cod: input?.cod === true,
  };
  if (!canBuy(settings)) return { error: "Keep at least one payment method switched on." };
  await (await getDb()).settings.updateOne(
    { _id: "payments" },
    { $set: { ...settings, updatedAt: new Date() } },
    { upsert: true },
  );
  refreshPaymentSettings();
  return { ok: true };
}

// ---------- Products ----------

// Only our own images: files in /public/images, or uploads in our Cloudinary account
const isOwnImage = (url: string) =>
  /^\/images\/[\w.-]+$/.test(url) ||
  (!!cloudinaryCloudName() && url.startsWith(`https://res.cloudinary.com/${cloudinaryCloudName()}/image/upload/`));

function cleanProduct(input: ProductInput): { product: Omit<Product, "inStock" | "category">; errors: ProductErrors } {
  const o = input?.offer;
  const values: ProductInput = {
    slug: text(input?.slug).toLowerCase(),
    name: text(input?.name),
    categoryId: text(input?.categoryId),
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
  const product: Omit<Product, "inStock" | "category"> = {
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
  const categoryError = await productCategoryError(product.categoryId);
  if (categoryError) return { errors: { categoryId: categoryError } };

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

// ---------- Categories ----------

// Why a product can't go in this category, or null if it can (any category, at any level)
async function productCategoryError(id: string) {
  if (!(await (await getDb()).categories.findOne({ _id: id }))) return "This category no longer exists. Choose another one.";
  return null;
}

// Adds a category (`id` null) or renames / moves one. Products stay where they are: they keep
// the category's id, and a category can hold products and sub-categories at the same time.
export async function saveCategory(
  id: string | null,
  input: { name: string; parentId: string | null },
): Promise<{ error: string } | { ok: true; category: Category }> {
  await requireAdmin();
  const name = tidyCategoryName(text(input?.name));
  const parentId = text(input?.parentId) || null;
  const nameError = categoryNameError(name);
  if (nameError) return { error: nameError };

  const { categories } = await getDb();
  const all = await loadCategories();
  const current = id ? all.find((c) => c.id === String(id)) : undefined;
  if (id && !current) return { error: "This category no longer exists. Reload the page." };
  const placement = placementError(all, current?.id ?? null, parentId);
  if (placement) return { error: placement };

  const key = categoryKey(name);
  const parent = all.find((c) => c.id === parentId);
  if (all.some((c) => c.parentId === parentId && c.id !== current?.id && categoryKey(c.name) === key)) {
    return { error: parent ? `“${parent.name}” already has a sub-category called “${name}”.` : `There is already a main category called “${name}”.` };
  }

  const now = new Date();
  // Keep the shop link unless the name changes
  const slug = current && categoryKey(current.name) === key ? current.slug : await freeCategorySlug(categories, name, parent?.slug, current?.id);
  const saved: Category = { id: current?.id ?? new ObjectId().toHexString(), name, slug, parentId };
  try {
    if (current) await categories.updateOne({ _id: saved.id }, { $set: { name, key, slug, parentId, updatedAt: now } });
    else await categories.insertOne({ _id: saved.id, name, key, slug, parentId, createdAt: now, updatedAt: now });
  } catch {
    // The unique indexes: someone else saved the same name (or link name) at the same moment
    return { error: "Another category with this name was just saved. Reload the page and try again." };
  }
  refreshCatalog();
  return { ok: true, category: saved };
}

// Only an empty category can be deleted: no sub-categories and no products (hidden ones included)
export async function deleteCategory(id: string): Promise<{ error: string } | { ok: true }> {
  await requireAdmin();
  const { categories, products } = await getDb();
  const doc = await categories.findOne({ _id: String(id) });
  if (!doc) return { ok: true }; // already gone
  const count = await products.countDocuments({ categoryId: doc._id });
  if (count) {
    return { error: `There ${count === 1 ? "is 1 product" : `are ${count} products`} in “${doc.name}”. Once you move ${count === 1 ? "it" : "them"} to another category, you can delete this category.` };
  }
  const subs = await categories.countDocuments({ parentId: doc._id });
  if (subs) {
    const them = subs === 1 ? "it" : "them";
    return { error: `“${doc.name}” has ${subs === 1 ? "1 sub-category" : `${subs} sub-categories`}. Once you delete ${them} or move ${them} under another category, you can delete this category.` };
  }

  await categories.deleteOne({ _id: doc._id });
  // A product or sub-category may have been saved into it at this very moment: then put it back
  if ((await products.findOne({ categoryId: doc._id })) || (await categories.findOne({ parentId: doc._id }))) {
    await categories.insertOne(doc).catch(() => {});
    return { error: `Something was just added to “${doc.name}”. Reload the page and try again.` };
  }
  refreshCatalog();
  return { ok: true };
}

// "Move to…" in the delete pop-up: the chosen products of `fromId` (`slugs`; hidden ones included)
// go to `toId`. Products that have left `fromId` in the meantime are left alone.
export async function moveCategoryProducts(
  fromId: string,
  toId: string,
  slugs: string[],
): Promise<{ error: string } | { ok: true; moved: number }> {
  await requireAdmin();
  const all = await loadCategories();
  const to = all.find((c) => c.id === String(toId));
  if (!to) return { error: "Choose the category to move them to." };
  if (to.id === String(fromId)) return { error: "Choose a different category." };
  const ids = (Array.isArray(slugs) ? slugs : []).map(String);
  if (!ids.length) return { error: "Choose the products to move." };
  const { modifiedCount } = await (await getDb()).products.updateMany(
    { _id: { $in: ids }, categoryId: String(fromId) },
    { $set: { categoryId: to.id, updatedAt: new Date() } },
  );
  refreshCatalog();
  return { ok: true, moved: modifiedCount };
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

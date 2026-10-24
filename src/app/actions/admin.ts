"use server";

import { fulfillments, type Fulfillment } from "@/lib/order";
import type { Offer, Product } from "@/lib/product";
import { cloudinaryCloudName } from "@/lib/server/cloudinary";
import { getDb } from "@/lib/server/db";
import { refreshCatalog } from "@/lib/server/products";
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
  const res = await orders.updateOne(
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
  );
  if (!res.matchedCount) return { error: "Only paid orders can be updated." };
  return { ok: true };
}

// ---------- Products ----------

// What the product form sends. Offer dates are "YYYY-MM-DD" (India time).
export type ProductInput = Omit<Product, "offer"> & {
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

function cleanProduct(input: ProductInput): { product: Product; errors: ProductErrors } {
  const errors: ProductErrors = {};
  const price = Number(input?.price);
  const product: Product = {
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
    offer: null,
  };

  if (!SLUG.test(product.slug)) errors.slug = "Use lowercase letters, numbers and dashes, e.g. rose-body-mist.";
  if (!product.name) errors.name = "Enter a name.";
  if (!product.category) errors.category = "Enter a category.";
  if (!product.size) errors.size = "Enter a size, e.g. 50 ml.";
  if (!Number.isInteger(price) || price < 1 || price > 1_000_000) errors.price = "Enter a price in whole rupees (at least ₹1).";
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
  const { slug, ...fields } = product;
  const now = new Date();
  if (isNew) {
    if (await products.findOne({ _id: slug }, { projection: { _id: 1 } })) {
      return { errors: { slug: "Another product already uses this URL name." } };
    }
    await products.insertOne({ _id: slug, ...fields, createdAt: now, updatedAt: now });
  } else {
    const res = await products.updateOne({ _id: slug }, { $set: { ...fields, updatedAt: now } });
    if (!res.matchedCount) return { errors: { slug: "This product no longer exists." } };
  }
  refreshCatalog();
  return { ok: true, slug };
}

export async function setProductEnabled(slug: string, enabled: boolean): Promise<{ ok: true }> {
  await requireAdmin();
  await (await getDb()).products.updateOne({ _id: String(slug) }, { $set: { enabled: enabled === true, updatedAt: new Date() } });
  refreshCatalog();
  return { ok: true };
}

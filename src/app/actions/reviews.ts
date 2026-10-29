"use server";

import { getTranslations } from "next-intl/server";
import { placedStatuses } from "@/lib/order";
import type { ReviewInput } from "@/lib/review";
import { getDb } from "@/lib/server/db";
import { getCatalogProduct } from "@/lib/server/products";
import { cleanReview, refreshReviews } from "@/lib/server/reviews";
import { getUser } from "@/lib/server/session";

// For the review form on a product page (the page itself is cached, so it asks from the browser):
// whether the visitor is logged in, the name to suggest, and their existing review to edit.
export async function getMyReview(slug: string): Promise<
  { loggedIn: false } | { loggedIn: true; name: string; review: ReviewInput | null }
> {
  const user = await getUser();
  if (!user) return { loggedIn: false };
  const doc = await (await getDb()).reviews.findOne({ productSlug: String(slug), userId: user._id });
  return {
    loggedIn: true,
    name: user.name,
    review: doc ? { name: doc.name, rating: doc.rating, title: doc.title, text: doc.text } : null,
  };
}

// Writes the customer's review of a product, or updates it if they already wrote one
export async function saveMyReview(
  slug: string,
  input: ReviewInput,
): Promise<{ error: string; field?: keyof ReviewInput } | { ok: true }> {
  const t = await getTranslations("products.reviews.errors");
  const user = await getUser();
  if (!user) return { error: t("login") };
  const product = await getCatalogProduct(String(slug));
  if (!product) return { error: t("generic") };

  const { review, errors } = cleanReview(input);
  const field = (Object.keys(errors) as (keyof ReviewInput)[])[0];
  if (field) return { error: t(errors[field]!), field };

  const { orders, reviews } = await getDb();
  // "Verified buyer": they have a placed (paid or cash on delivery), not-cancelled order with this product
  const bought = await orders.findOne(
    { userId: user._id, status: { $in: [...placedStatuses] }, fulfillment: { $ne: "cancelled" }, "items.slug": product.slug },
    { projection: { _id: 1 } },
  );
  const now = new Date();
  await reviews.updateOne(
    { productSlug: product.slug, userId: user._id },
    {
      $set: { ...review, verified: !!bought, updatedAt: now },
      // An admin's "hidden" stays as it was when the customer edits their review
      $setOnInsert: { source: "customer", hidden: false, createdAt: now },
    },
    { upsert: true },
  );
  refreshReviews();
  return { ok: true };
}

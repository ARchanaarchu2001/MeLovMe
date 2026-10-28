import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { reviewLimits, type Review, type ReviewInput, type ReviewSummary } from "@/lib/review";
import { getDb, type ReviewDoc } from "./db";

const MAX_SHOWN = 50;

// Only these fields go to the browser (not who wrote it or how it was added)
export const toReview = (d: ReviewDoc): Review => ({
  id: d._id.toHexString(),
  name: d.name,
  rating: d.rating,
  title: d.title,
  text: d.text,
  verified: d.verified,
  createdAt: d.createdAt.toISOString(),
});

// A product's visible reviews (newest first) and their star summary. Cached across requests;
// changes call refreshReviews() so the product page updates straight away.
export const getProductReviews = unstable_cache(
  async (slug: string): Promise<{ summary: ReviewSummary; reviews: Review[] }> => {
    const { reviews } = await getDb();
    const filter = { productSlug: slug, hidden: false };
    const [list, stats] = await Promise.all([
      reviews.find(filter).sort({ createdAt: -1 }).limit(MAX_SHOWN).toArray(),
      reviews.aggregate<{ _id: number; n: number }>([{ $match: filter }, { $group: { _id: "$rating", n: { $sum: 1 } } }]).toArray(),
    ]);
    const byStars: ReviewSummary["byStars"] = [0, 0, 0, 0, 0];
    for (const s of stats) if (s._id >= 1 && s._id <= 5) byStars[5 - s._id] = s.n;
    const count = byStars.reduce((a, b) => a + b, 0);
    const average = count ? byStars.reduce((sum, n, i) => sum + n * (5 - i), 0) / count : 0;
    return { summary: { average: Math.round(average * 10) / 10, count, byStars }, reviews: list.map(toReview) };
  },
  ["product-reviews"],
  { tags: ["reviews"] },
);

export function refreshReviews() {
  // expire: 0 — the next visitor gets fresh reviews, not the old list
  revalidateTag("reviews", { expire: 0 });
}

const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

// Cleans what a review form sent. Error messages are keys under products.reviews.errors.
export function cleanReview(input: ReviewInput) {
  const review = {
    name: str(input?.name, reviewLimits.name),
    rating: Number(input?.rating),
    title: str(input?.title, reviewLimits.title),
    text: str(input?.text, reviewLimits.text),
  };
  const errors: Partial<Record<keyof ReviewInput, "rating" | "name" | "text">> = {};
  if (!Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) errors.rating = "rating";
  if (!review.name) errors.name = "name";
  if (review.text.length < reviewLimits.minText) errors.text = "text";
  return { review, errors };
}

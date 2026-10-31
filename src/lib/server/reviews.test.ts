// @vitest-environment node
import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ReviewDoc } from "./db";
import { cleanReview, getProductReviews, refreshReviews, toReview } from "./reviews";

const { reviews, revalidateTag, state } = vi.hoisted(() => {
  // What the fake `reviews` collection returns: the list for find(), the star counts for aggregate()
  const state = { list: [] as unknown[], stats: [] as { _id: number; n: number }[] };
  const cursor = { sort: vi.fn(), limit: vi.fn(), toArray: vi.fn(async () => state.list) };
  cursor.sort.mockReturnValue(cursor);
  cursor.limit.mockReturnValue(cursor);
  return {
    state,
    reviews: {
      cursor,
      find: vi.fn(() => cursor),
      aggregate: vi.fn(() => ({ toArray: async () => state.stats })),
    },
    revalidateTag: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
// No caching in tests: the function runs every time
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag }));
vi.mock("./db", () => ({ getDb: async () => ({ reviews }) }));

const doc = (change: Partial<ReviewDoc> = {}): ReviewDoc => ({
  _id: new ObjectId("665f1c2e9b1d8a3f4c2e7a10"),
  productSlug: "signature-body-lotion",
  source: "customer",
  userId: new ObjectId("665f1c2e9b1d8a3f4c2e7a99"),
  name: "Anjali",
  rating: 5,
  title: "Lovely",
  text: "Smells wonderful all day.",
  verified: true,
  hidden: false,
  createdAt: new Date("2026-06-15T12:00:00+05:30"),
  updatedAt: new Date("2026-06-15T12:00:00+05:30"),
  ...change,
});

beforeEach(() => {
  state.list = [];
  state.stats = [];
  vi.clearAllMocks();
});

describe("toReview", () => {
  test("sends only the public fields, with the id and date as text", () => {
    expect(toReview(doc())).toEqual({
      id: "665f1c2e9b1d8a3f4c2e7a10",
      name: "Anjali",
      rating: 5,
      title: "Lovely",
      text: "Smells wonderful all day.",
      verified: true,
      createdAt: "2026-06-15T06:30:00.000Z", // 12:00 India time
    });
  });
});

describe("getProductReviews", () => {
  test("lists the product's visible reviews, newest first, at most 50", async () => {
    await getProductReviews("signature-body-lotion");
    expect(reviews.find).toHaveBeenCalledWith({ productSlug: "signature-body-lotion", hidden: false });
    expect(reviews.cursor.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(reviews.cursor.limit).toHaveBeenCalledWith(50);
  });

  test("counts stars over the same visible reviews", async () => {
    await getProductReviews("signature-body-lotion");
    expect(reviews.aggregate).toHaveBeenCalledWith([
      { $match: { productSlug: "signature-body-lotion", hidden: false } },
      { $group: { _id: "$rating", n: { $sum: 1 } } },
    ]);
  });

  test("returns the reviews in their public form", async () => {
    state.list = [doc()];
    const { reviews: list } = await getProductReviews("signature-body-lotion");
    expect(list).toEqual([toReview(doc())]);
  });

  test("a product with no reviews has 0 stars and a count of 0", async () => {
    expect((await getProductReviews("signature-body-lotion")).summary).toEqual({ average: 0, count: 0, byStars: [0, 0, 0, 0, 0] });
  });

  test("works out the count, the average and how many gave each star", async () => {
    // three 5★, one 4★, one 1★: (15 + 4 + 1) / 5 = 4
    state.stats = [
      { _id: 4, n: 1 },
      { _id: 5, n: 3 },
      { _id: 1, n: 1 },
    ];
    expect((await getProductReviews("signature-body-lotion")).summary).toEqual({ average: 4, count: 5, byStars: [3, 1, 0, 0, 1] });
  });

  test("the average is rounded to one decimal place", async () => {
    // two 5★, one 4★: 14 / 3 = 4.67 → 4.7
    state.stats = [
      { _id: 5, n: 2 },
      { _id: 4, n: 1 },
    ];
    expect((await getProductReviews("signature-body-lotion")).summary.average).toBe(4.7);
  });

  test("ratings outside 1–5 in the database are left out of the summary", async () => {
    state.stats = [
      { _id: 5, n: 1 },
      { _id: 0, n: 4 },
      { _id: 6, n: 4 },
    ];
    expect((await getProductReviews("signature-body-lotion")).summary).toEqual({ average: 5, count: 1, byStars: [1, 0, 0, 0, 0] });
  });
});

describe("refreshReviews", () => {
  test("expires the cached reviews straight away", () => {
    refreshReviews();
    expect(revalidateTag).toHaveBeenCalledWith("reviews", { expire: 0 });
  });
});

describe("cleanReview", () => {
  const valid = { name: "Anjali", rating: 4, title: "Nice", text: "Really soft skin." };

  test("accepts a complete review", () => {
    expect(cleanReview(valid)).toEqual({ review: valid, errors: {} });
  });

  test("trims spaces around every field", () => {
    const { review } = cleanReview({ name: "  Anjali ", rating: 4, title: " Nice ", text: "  Really soft skin.  " });
    expect(review).toEqual(valid);
  });

  test("cuts fields down to their maximum length", () => {
    const { review } = cleanReview({ name: "a".repeat(50), rating: 4, title: "t".repeat(150), text: "x".repeat(2500) });
    expect(review.name).toHaveLength(40);
    expect(review.title).toHaveLength(100);
    expect(review.text).toHaveLength(2000);
  });

  test("the title is optional", () => {
    expect(cleanReview({ ...valid, title: "" }).errors).toEqual({});
  });

  test("the rating must be a whole number of stars from 1 to 5", () => {
    for (const rating of [0, 6, 3.5, NaN]) expect(cleanReview({ ...valid, rating }).errors).toEqual({ rating: "rating" });
    for (const rating of [1, 5]) expect(cleanReview({ ...valid, rating }).errors).toEqual({});
  });

  test("a rating sent as text is read as a number", () => {
    const { review, errors } = cleanReview({ ...valid, rating: "3" as unknown as number });
    expect(review.rating).toBe(3);
    expect(errors).toEqual({});
  });

  test("the name is required, and spaces alone don't count", () => {
    expect(cleanReview({ ...valid, name: "   " }).errors).toEqual({ name: "name" });
  });

  test("the text needs at least 5 characters after trimming", () => {
    expect(cleanReview({ ...valid, text: "  Good  " }).errors).toEqual({ text: "text" }); // "Good" = 4
    expect(cleanReview({ ...valid, text: "Great" }).errors).toEqual({});
  });

  test("a missing or empty form gives every error instead of crashing", () => {
    expect(cleanReview(undefined as unknown as typeof valid)).toEqual({
      review: { name: "", rating: NaN, title: "", text: "" },
      errors: { rating: "rating", name: "name", text: "text" },
    });
  });
});

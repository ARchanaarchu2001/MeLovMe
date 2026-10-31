// @vitest-environment node
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const m = vi.hoisted(() => ({ getUser: vi.fn(), getDb: vi.fn(), getCatalogProduct: vi.fn(), revalidateTag: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: m.revalidateTag, unstable_cache: (fn: unknown) => fn }));
vi.mock("next-intl/server", () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));
vi.mock("@/lib/server/session", () => ({ getUser: m.getUser }));
vi.mock("@/lib/server/db", () => ({ getDb: m.getDb }));
vi.mock("@/lib/server/products", () => ({ getCatalogProduct: m.getCatalogProduct }));
// cleanReview and refreshReviews are the real ones (refreshReviews calls the faked revalidateTag)

import { getMyReview, saveMyReview } from "./reviews";

const NOW = new Date("2026-06-15T12:00:00+05:30");
const user = { _id: new ObjectId(), name: "Anjali" };
const good = { name: "Anjali", rating: 5, title: "Lovely", text: "Smells like real roses." };
let orders: { findOne: ReturnType<typeof vi.fn> };
let reviews: { findOne: ReturnType<typeof vi.fn>; updateOne: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  orders = { findOne: vi.fn(async () => null) };
  reviews = { findOne: vi.fn(async () => null), updateOne: vi.fn(async () => ({})) };
  m.getUser.mockResolvedValue(user);
  m.getDb.mockResolvedValue({ orders, reviews });
  m.getCatalogProduct.mockResolvedValue({ slug: "rose-mist", name: "Rose Mist" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("getMyReview", () => {
  test("a guest is told they're not logged in", async () => {
    m.getUser.mockResolvedValue(null);
    expect(await getMyReview("rose-mist")).toEqual({ loggedIn: false });
    expect(m.getDb).not.toHaveBeenCalled();
  });

  test("a customer without a review gets their name to suggest", async () => {
    expect(await getMyReview("rose-mist")).toEqual({ loggedIn: true, name: "Anjali", review: null });
    expect(reviews.findOne).toHaveBeenCalledWith({ productSlug: "rose-mist", userId: user._id });
  });

  test("a customer's existing review comes back without its private fields", async () => {
    reviews.findOne.mockResolvedValue({ ...good, _id: new ObjectId(), userId: user._id, verified: true, hidden: false });
    expect(await getMyReview("rose-mist")).toEqual({ loggedIn: true, name: "Anjali", review: good });
  });
});

describe("saveMyReview", () => {
  test("a guest must log in", async () => {
    m.getUser.mockResolvedValue(null);
    expect(await saveMyReview("rose-mist", good)).toEqual({ error: "login" });
    expect(reviews.updateOne).not.toHaveBeenCalled();
  });

  test("a product that isn't in the shop can't be reviewed", async () => {
    m.getCatalogProduct.mockResolvedValue(undefined);
    expect(await saveMyReview("hidden-thing", good)).toEqual({ error: "generic" });
    expect(reviews.updateOne).not.toHaveBeenCalled();
  });

  test("a rating outside 1–5 stars is refused, naming the field", async () => {
    expect(await saveMyReview("rose-mist", { ...good, rating: 6 })).toEqual({ error: "rating", field: "rating" });
    expect(await saveMyReview("rose-mist", { ...good, rating: 4.5 })).toEqual({ error: "rating", field: "rating" });
    expect(reviews.updateOne).not.toHaveBeenCalled();
  });

  test("a review needs a name and at least 5 characters of text", async () => {
    expect(await saveMyReview("rose-mist", { ...good, name: "  " })).toEqual({ error: "name", field: "name" });
    expect(await saveMyReview("rose-mist", { ...good, text: "Nice" })).toEqual({ error: "text", field: "text" });
  });

  test("a customer with a placed, not-cancelled order of the product is a verified buyer", async () => {
    orders.findOne.mockResolvedValue({ _id: "ML-ABC" });
    await saveMyReview("rose-mist", good);
    expect(orders.findOne.mock.calls[0][0]).toEqual({
      userId: user._id,
      status: { $in: ["paid", "cod"] },
      fulfillment: { $ne: "cancelled" },
      "items.slug": "rose-mist",
    });
    expect(reviews.updateOne.mock.calls[0][1].$set.verified).toBe(true);
  });

  test("a customer who hasn't bought it is not a verified buyer", async () => {
    await saveMyReview("rose-mist", good);
    expect(reviews.updateOne.mock.calls[0][1].$set.verified).toBe(false);
  });

  test("writes one review per customer per product, keeping an admin's hidden flag on edits", async () => {
    expect(await saveMyReview("rose-mist", good)).toEqual({ ok: true });
    expect(reviews.updateOne).toHaveBeenCalledWith(
      { productSlug: "rose-mist", userId: user._id },
      {
        $set: { ...good, verified: false, updatedAt: NOW },
        // `hidden` only on the first save, so editing doesn't un-hide it
        $setOnInsert: { source: "customer", hidden: false, createdAt: NOW },
      },
      { upsert: true },
    );
  });

  test("refreshes the product page's reviews", async () => {
    await saveMyReview("rose-mist", good);
    expect(m.revalidateTag).toHaveBeenCalledWith("reviews", { expire: 0 });
  });
});

// @vitest-environment node
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ProductInput } from "@/lib/admin-validation";
import type { Announcement } from "@/lib/announcement";
import type { Banner } from "@/lib/banner";
import type { Category } from "@/lib/category";
import type { Testimonials } from "@/lib/testimonials";

// ---------- Fakes for everything outside this file ----------

const m = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getDb: vi.fn(),
  freeCategorySlug: vi.fn(),
  loadCategories: vi.fn(),
  adjustStock: vi.fn(),
  refreshCatalog: vi.fn(),
  refreshReviews: vi.fn(),
  refreshAnnouncement: vi.fn(),
  refreshBanner: vi.fn(),
  refreshPaymentSettings: vi.fn(),
  refreshTestimonials: vi.fn(),
  syncPendingRefunds: vi.fn(),
  createRefund: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/server/session", () => ({ requireAdmin: m.requireAdmin }));
vi.mock("@/lib/server/db", () => ({ getDb: m.getDb, freeCategorySlug: m.freeCategorySlug }));
vi.mock("@/lib/server/products", () => ({
  adjustStock: m.adjustStock,
  loadCategories: m.loadCategories,
  refreshCatalog: m.refreshCatalog,
}));
// cleanReview stays real; refreshing the cache is faked
vi.mock("@/lib/server/reviews", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/reviews")>()),
  refreshReviews: m.refreshReviews,
}));
vi.mock("@/lib/server/announcement", () => ({ refreshAnnouncement: m.refreshAnnouncement }));
vi.mock("@/lib/server/banner", () => ({ refreshBanner: m.refreshBanner }));
vi.mock("@/lib/server/payments", () => ({ refreshPaymentSettings: m.refreshPaymentSettings }));
vi.mock("@/lib/server/testimonials", () => ({ refreshTestimonials: m.refreshTestimonials }));
vi.mock("@/lib/server/orders", () => ({ syncPendingRefunds: m.syncPendingRefunds }));
vi.mock("@/lib/server/razorpay", () => ({ createRefund: m.createRefund }));
vi.mock("@/lib/server/cloudinary", () => ({ cloudinaryCloudName: () => "melovme-cloud" }));

import * as admin from "./admin";

// ---------- A fake database ----------

const NOW = new Date("2026-06-15T12:00:00+05:30");
const CLOUD_IMAGE = "https://res.cloudinary.com/melovme-cloud/image/upload/v1/melovme/products/rose.jpg";

/* eslint-disable @typescript-eslint/no-explicit-any -- fake collections accept any query */
type Query = (...args: any[]) => Promise<any>;
const collection = () => {
  const cursor = { toArray: vi.fn<Query>(async () => [] as unknown[]), limit: vi.fn() };
  cursor.limit.mockReturnValue(cursor);
  return {
    cursor,
    find: vi.fn<(...args: any[]) => typeof cursor>(() => cursor),
    findOne: vi.fn<Query>(async () => null),
    findOneAndUpdate: vi.fn<Query>(async () => null),
    insertOne: vi.fn<Query>(async () => ({})),
    updateOne: vi.fn<Query>(async () => ({ matchedCount: 1 })),
    updateMany: vi.fn<Query>(async () => ({ modifiedCount: 0 })),
    deleteOne: vi.fn<Query>(async () => ({ deletedCount: 1 })),
    deleteMany: vi.fn<Query>(async () => ({})),
    countDocuments: vi.fn<Query>(async () => 0),
  };
};
let db: Record<"orders" | "products" | "reviews" | "categories" | "settings", ReturnType<typeof collection>>;
const owner = { _id: new ObjectId(), name: "Owner", superAdmin: true };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db = { orders: collection(), products: collection(), reviews: collection(), categories: collection(), settings: collection() };
  m.getDb.mockResolvedValue(db);
  m.requireAdmin.mockResolvedValue(owner);
  m.loadCategories.mockResolvedValue([]);
  m.adjustStock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// ---------- Only admins ----------

describe("every admin action checks for an admin first", () => {
  const calls: [string, () => Promise<unknown>][] = [
    ["updateOrder", () => admin.updateOrder("ML-1", { fulfillment: "packed", courier: "", trackingNumber: "", adminNote: "" })],
    ["markCodPaid", () => admin.markCodPaid("ML-1")],
    ["checkRefundStatus", () => admin.checkRefundStatus()],
    ["refundOrder", () => admin.refundOrder("ML-1", 100)],
    ["savePaymentSettings", () => admin.savePaymentSettings({ razorpay: true, cod: true })],
    ["saveProduct", () => admin.saveProduct({} as ProductInput, true)],
    ["setProductFlag", () => admin.setProductFlag("rose", "enabled", true)],
    ["setProductStock", () => admin.setProductStock("rose", 5)],
    ["deleteProduct", () => admin.deleteProduct("rose")],
    ["saveCategory", () => admin.saveCategory(null, { name: "Mists", parentId: null })],
    ["deleteCategory", () => admin.deleteCategory("cat1")],
    ["moveCategoryProducts", () => admin.moveCategoryProducts("cat1", "cat2", ["rose"])],
    ["saveAnnouncement", () => admin.saveAnnouncement({} as Announcement)],
    ["saveBanner", () => admin.saveBanner({} as Banner)],
    ["saveTestimonials", () => admin.saveTestimonials({} as Testimonials)],
    ["saveAdminReview", () => admin.saveAdminReview(null, "rose", { name: "A", rating: 5, title: "", text: "Lovely" })],
    ["setReviewHidden", () => admin.setReviewHidden(new ObjectId().toHexString(), true)],
    ["deleteReview", () => admin.deleteReview(new ObjectId().toHexString())],
  ];

  test("the list covers every action in the file", () => {
    expect(calls.map(([name]) => name).sort()).toEqual(Object.keys(admin).sort());
  });

  test.each(calls)("%s refuses a non-admin and touches nothing", async (_name, call) => {
    // requireAdmin() sends guests to log in and shows non-admins a 404, by throwing
    m.requireAdmin.mockRejectedValue(new Error("NEXT_HTTP_ERROR_FALLBACK;404"));
    await expect(call()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(m.getDb).not.toHaveBeenCalled();
    expect(m.loadCategories).not.toHaveBeenCalled();
    expect(m.createRefund).not.toHaveBeenCalled();
  });
});

// ---------- Orders ----------

describe("updateOrder", () => {
  const update = (fulfillment: string, extra = {}) =>
    // @ts-expect-error fulfillment may be anything a request sends
    admin.updateOrder("ML-1", { fulfillment, courier: "", trackingNumber: "", adminNote: "", ...extra });
  const items = [{ slug: "rose-mist", qty: 2 }];

  test("an unknown delivery status is refused", async () => {
    expect(await update("lost")).toMatchObject({ errors: { fulfillment: "Choose a valid status." } });
    expect(db.orders.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test("a tracking number needs a courier", async () => {
    expect(await update("shipped", { trackingNumber: "AWB1234" })).toMatchObject({
      errors: { courier: "Enter the courier for this tracking number." },
    });
  });

  test("only placed orders (paid or cash on delivery) can be updated", async () => {
    expect(await update("packed")).toEqual({ error: "Only placed orders can be updated." });
    expect(db.orders.findOneAndUpdate.mock.calls[0][0]).toEqual({ _id: "ML-1", status: { $in: ["paid", "cod"] } });
  });

  test("saves the trimmed courier and tracking number", async () => {
    db.orders.findOneAndUpdate.mockResolvedValue({ _id: "ML-1", fulfillment: "packed", items });
    await update("shipped", { courier: " Delhivery ", trackingNumber: " AWB1234 " });
    expect(db.orders.findOneAndUpdate.mock.calls[0][1].$set).toMatchObject({ courier: "Delhivery", trackingNumber: "AWB1234" });
  });

  test("a new delivery status is added to the customer's tracker", async () => {
    db.orders.findOneAndUpdate.mockResolvedValue({ _id: "ML-1", fulfillment: "packed", items });
    expect(await update("shipped")).toEqual({ ok: true });
    expect(db.orders.updateOne).toHaveBeenCalledWith({ _id: "ML-1" }, { $push: { statusHistory: { status: "shipped", at: NOW } } });
  });

  test("an unchanged delivery status isn't added again", async () => {
    // An older order without a status counts as "placed"
    db.orders.findOneAndUpdate.mockResolvedValue({ _id: "ML-1", items });
    await update("placed");
    expect(db.orders.updateOne).not.toHaveBeenCalled();
  });

  test("cancelling puts the items back in stock", async () => {
    db.orders.findOneAndUpdate.mockResolvedValue({ _id: "ML-1", fulfillment: "packed", items, stockTaken: true });
    await update("cancelled");
    expect(m.adjustStock).toHaveBeenCalledWith(items, 1);
  });

  test("un-cancelling takes them out again", async () => {
    db.orders.findOneAndUpdate.mockResolvedValue({ _id: "ML-1", fulfillment: "cancelled", items, stockTaken: true });
    await update("placed");
    expect(m.adjustStock).toHaveBeenCalledWith(items, -1);
  });

  test("stock is left alone when the items never left stock, or cancelling isn't involved", async () => {
    db.orders.findOneAndUpdate.mockResolvedValueOnce({ _id: "ML-1", fulfillment: "packed", items });
    await update("cancelled");
    db.orders.findOneAndUpdate.mockResolvedValueOnce({ _id: "ML-1", fulfillment: "packed", items, stockTaken: true });
    await update("shipped");
    expect(m.adjustStock).not.toHaveBeenCalled();
  });
});

describe("markCodPaid", () => {
  test("marks a cash on delivery order paid", async () => {
    expect(await admin.markCodPaid("ML-1")).toEqual({ ok: true });
    expect(db.orders.updateOne).toHaveBeenCalledWith(
      { _id: "ML-1", status: "cod" },
      { $set: { status: "paid", paidAt: NOW, payment: { method: "cod" }, updatedAt: NOW } },
    );
  });

  test("an order that isn't waiting for cash is refused", async () => {
    db.orders.updateOne.mockResolvedValue({ matchedCount: 0 });
    expect(await admin.markCodPaid("ML-1")).toEqual({ error: "This order isn't waiting for cash on delivery." });
  });
});

describe("checkRefundStatus", () => {
  test("asks about orders with pending refunds, up to 100", async () => {
    const list = [{ _id: "ML-1" }];
    db.orders.cursor.toArray.mockResolvedValue(list);
    m.syncPendingRefunds.mockResolvedValue([{ orderId: "ML-1", refundId: "rfnd_1", amount: 100, status: "processed" }]);
    expect(await admin.checkRefundStatus()).toEqual([{ orderId: "ML-1", refundId: "rfnd_1", amount: 100, status: "processed" }]);
    expect(db.orders.find).toHaveBeenCalledWith({ "refunds.status": "pending" });
    expect(db.orders.cursor.limit).toHaveBeenCalledWith(100);
    expect(m.syncPendingRefunds).toHaveBeenCalledWith(list);
  });

  test("can ask about one order", async () => {
    m.syncPendingRefunds.mockResolvedValue([]);
    await admin.checkRefundStatus("ML-1");
    expect(db.orders.find).toHaveBeenCalledWith({ _id: "ML-1", "refunds.status": "pending" });
  });
});

describe("refundOrder", () => {
  // Paid ₹1,000 online, ₹300 already refunded: ₹700 left to refund
  const paid = {
    _id: "ML-1",
    status: "paid",
    paymentMethod: "razorpay",
    paymentId: "pay_1",
    total: 1000,
    fulfillment: "packed",
    refunds: [{ id: "rfnd_0", amount: 300, status: "processed", createdAt: NOW }],
  };
  beforeEach(() => {
    m.createRefund.mockResolvedValue({ id: "rfnd_1", status: "pending" });
  });

  test("cash on delivery orders can't be refunded through Razorpay", async () => {
    db.orders.findOne.mockResolvedValue({ ...paid, paymentMethod: "cod" });
    expect(await admin.refundOrder("ML-1", 100)).toHaveProperty("error");
    expect(m.createRefund).not.toHaveBeenCalled();
  });

  test("an order that isn't paid can't be refunded", async () => {
    db.orders.findOne.mockResolvedValue({ ...paid, status: "awaiting_payment" });
    expect(await admin.refundOrder("ML-1", 100)).toHaveProperty("error");
    expect(m.createRefund).not.toHaveBeenCalled();
  });

  test("a delivered order can't be refunded", async () => {
    db.orders.findOne.mockResolvedValue({ ...paid, fulfillment: "delivered" });
    expect(await admin.refundOrder("ML-1", 100)).toEqual({ error: "Refunds aren't available once an order is delivered." });
  });

  test("the amount must be whole rupees, at least ₹1", async () => {
    db.orders.findOne.mockResolvedValue(paid);
    for (const amount of [0, -5, 10.5, NaN]) {
      expect(await admin.refundOrder("ML-1", amount)).toEqual({ error: "Enter the amount to refund, in whole rupees." });
    }
    expect(m.createRefund).not.toHaveBeenCalled();
  });

  test("can't refund more than is left", async () => {
    db.orders.findOne.mockResolvedValue(paid);
    // ₹1,000 − ₹300 = ₹700 left
    expect(await admin.refundOrder("ML-1", 701)).toEqual({ error: "You can refund up to ₹700." });
    expect(m.createRefund).not.toHaveBeenCalled();
  });

  test("a failed refund doesn't count against what's left", async () => {
    db.orders.findOne.mockResolvedValue({ ...paid, refunds: [{ id: "rfnd_0", amount: 300, status: "failed", createdAt: NOW }] });
    expect(await admin.refundOrder("ML-1", 1000)).toEqual({ ok: true });
  });

  test("makes the refund with a numbered receipt and records it", async () => {
    db.orders.findOne.mockResolvedValue(paid);
    expect(await admin.refundOrder("ML-1", 700)).toEqual({ ok: true });
    // The second refund of ML-1
    expect(m.createRefund).toHaveBeenCalledWith("pay_1", 700, "ML-1-R2");
    expect(db.orders.updateOne).toHaveBeenCalledWith(
      { _id: "ML-1" },
      { $push: { refunds: { id: "rfnd_1", amount: 700, status: "pending", createdAt: NOW } }, $set: { updatedAt: NOW } },
    );
  });

  test("a Razorpay error is shown and nothing is recorded", async () => {
    db.orders.findOne.mockResolvedValue(paid);
    m.createRefund.mockImplementation(async () => {
      throw new Error("Insufficient balance");
    });
    expect(await admin.refundOrder("ML-1", 100)).toEqual({ error: "Razorpay couldn't make the refund: Insufficient balance" });
    expect(db.orders.updateOne).not.toHaveBeenCalled();
  });
});

// ---------- Payment methods ----------

describe("savePaymentSettings", () => {
  test("at least one payment method must stay on", async () => {
    expect(await admin.savePaymentSettings({ razorpay: false, cod: false })).toEqual({ error: "Keep at least one payment method switched on." });
    expect(db.settings.updateOne).not.toHaveBeenCalled();
  });

  test("anything other than true counts as off", async () => {
    // @ts-expect-error values a tampered request might send
    expect(await admin.savePaymentSettings({ razorpay: "yes", cod: 1 })).toHaveProperty("error");
  });

  test("saves the switches and refreshes the shop", async () => {
    expect(await admin.savePaymentSettings({ razorpay: true, cod: false })).toEqual({ ok: true });
    expect(db.settings.updateOne).toHaveBeenCalledWith(
      { _id: "payments" },
      { $set: { razorpay: true, cod: false, updatedAt: NOW } },
      { upsert: true },
    );
    expect(m.refreshPaymentSettings).toHaveBeenCalled();
  });
});

// ---------- Products ----------

const productInput = (p: Partial<ProductInput> = {}): ProductInput => ({
  slug: "",
  name: "Rose Body Mist",
  categoryId: "cat1",
  size: "100 ml",
  price: 500,
  shortDescription: "A light rose mist.",
  description: "A light, fresh body mist made with rose water.",
  images: ["/images/rose.jpg"],
  highlights: [],
  ingredients: [],
  howToUse: "",
  enabled: true,
  stock: 5,
  offer: null,
  combos: [],
  ...p,
});

describe("saveProduct", () => {
  beforeEach(() => {
    db.categories.findOne.mockResolvedValue({ _id: "cat1" });
  });
  const inserted = () => db.products.insertOne.mock.calls[0][0];

  test("an invalid product returns the errors and saves nothing", async () => {
    const res = await admin.saveProduct(productInput({ price: 0, images: [] }), true);
    expect(res).toMatchObject({ errors: { price: expect.any(String), images: "Add at least one image." } });
    expect(db.products.insertOne).not.toHaveBeenCalled();
  });

  test("images from other sites are refused", async () => {
    const res = await admin.saveProduct(productInput({ images: ["https://evil.example/rose.jpg"] }), true);
    expect(res).toEqual({ errors: { images: "One of the images is not valid. Remove it and upload again." } });
  });

  test("images from another Cloudinary account are refused", async () => {
    const res = await admin.saveProduct(productInput({ images: ["https://res.cloudinary.com/someone-else/image/upload/x.jpg"] }), true);
    expect(res).toHaveProperty("errors.images");
  });

  test("the shop's own images and its Cloudinary uploads are accepted", async () => {
    expect(await admin.saveProduct(productInput({ images: ["/images/rose.jpg", CLOUD_IMAGE] }), true)).toMatchObject({ ok: true });
  });

  test("a category that no longer exists is refused", async () => {
    db.categories.findOne.mockResolvedValue(null);
    expect(await admin.saveProduct(productInput(), true)).toEqual({
      errors: { categoryId: "This category no longer exists. Choose another one." },
    });
  });

  test("a new product's URL name is made from its name, not the one sent", async () => {
    expect(await admin.saveProduct(productInput({ slug: "admin" }), true)).toEqual({ ok: true, slug: "rose-body-mist" });
    expect(inserted()).toMatchObject({ _id: "rose-body-mist", stock: 5, inStock: true, createdAt: NOW });
    expect(m.refreshCatalog).toHaveBeenCalled();
  });

  test("a new product whose URL name is taken gets the next free number", async () => {
    db.products.cursor.toArray.mockResolvedValue([{ _id: "rose-body-mist" }, { _id: "rose-body-mist-2" }]);
    expect(await admin.saveProduct(productInput(), true)).toEqual({ ok: true, slug: "rose-body-mist-3" });
  });

  test("a new product needs a stock count", async () => {
    expect(await admin.saveProduct(productInput({ stock: null }), true)).toEqual({ errors: { stock: "Enter how many you have in stock." } });
  });

  test("0 in stock saves as out of stock", async () => {
    await admin.saveProduct(productInput({ stock: 0 }), true);
    expect(inserted()).toMatchObject({ stock: 0, inStock: false });
  });

  test("offer dates are saved as the whole day in India time", async () => {
    await admin.saveProduct(productInput({ offer: { type: "percent", value: 20, startDate: "2026-06-01", endDate: "2026-06-30" } }), true);
    // 1 June 00:00 IST = 31 May 18:30 UTC; 30 June 23:59:59 IST = 30 June 18:29:59 UTC
    expect(inserted().offer).toEqual({
      type: "percent",
      value: 20,
      startsAt: "2026-05-31T18:30:00.000Z",
      endsAt: "2026-06-30T18:29:59.000Z",
    });
  });

  test("combos are saved smallest first", async () => {
    await admin.saveProduct(productInput({ combos: [{ qty: 3, price: 1350 }, { qty: 2, price: 950 }] }), true);
    expect(inserted().combos).toEqual([{ qty: 2, price: 950 }, { qty: 3, price: 1350 }]);
  });

  test("editing a product that no longer exists is refused", async () => {
    expect(await admin.saveProduct(productInput({ slug: "rose-body-mist" }), false)).toEqual({
      errors: { slug: "This product no longer exists." },
    });
  });

  test("editing without touching the stock keeps the current count", async () => {
    db.products.findOne.mockResolvedValue({ _id: "rose-body-mist", stock: 3 });
    expect(await admin.saveProduct(productInput({ slug: "rose-body-mist", stock: null, price: 550 }), false)).toEqual({
      ok: true,
      slug: "rose-body-mist",
    });
    const [filter, { $set }] = db.products.updateOne.mock.calls[0];
    expect(filter).toEqual({ _id: "rose-body-mist" });
    expect($set).toMatchObject({ price: 550 });
    expect($set).not.toHaveProperty("stock");
  });
});

describe("product list switches", () => {
  test("the shown/hidden switch saves true or false only", async () => {
    // @ts-expect-error a tampered value
    await admin.setProductFlag("rose", "enabled", "yes");
    expect(db.products.updateOne).toHaveBeenCalledWith({ _id: "rose" }, { $set: { enabled: false, updatedAt: NOW } });
    expect(m.refreshCatalog).toHaveBeenCalled();
  });

  test("other product settings can't be changed this way", async () => {
    // @ts-expect-error a tampered setting
    await expect(admin.setProductFlag("rose", "price", true)).rejects.toThrow("Unknown product setting");
    expect(db.products.updateOne).not.toHaveBeenCalled();
  });

  test("the stock box takes whole units only", async () => {
    for (const stock of [-1, 2.5, NaN]) {
      expect(await admin.setProductStock("rose", stock)).toEqual({ error: "Enter whole units (0 if none)." });
    }
    expect(db.products.updateOne).not.toHaveBeenCalled();
  });

  test("setting stock to 0 marks it out of stock", async () => {
    expect(await admin.setProductStock("rose", 0)).toEqual({ ok: true });
    expect(db.products.updateOne).toHaveBeenCalledWith({ _id: "rose" }, { $set: { stock: 0, inStock: false, updatedAt: NOW } });
  });

  test("deleting a product also deletes its reviews", async () => {
    await admin.deleteProduct("rose");
    expect(db.products.deleteOne).toHaveBeenCalledWith({ _id: "rose" });
    expect(db.reviews.deleteMany).toHaveBeenCalledWith({ productSlug: "rose" });
    expect(m.refreshReviews).toHaveBeenCalled();
  });

  test("deleting a product that's already gone leaves reviews alone", async () => {
    db.products.deleteOne.mockResolvedValue({ deletedCount: 0 });
    expect(await admin.deleteProduct("rose")).toEqual({ ok: true });
    expect(db.reviews.deleteMany).not.toHaveBeenCalled();
  });
});

// ---------- Categories ----------

describe("categories", () => {
  const bodyCare: Category = { id: "cat1", name: "Body Care", slug: "body-care", parentId: null };
  const lotions: Category = { id: "cat2", name: "Lotions", slug: "body-care-lotions", parentId: "cat1" };
  beforeEach(() => {
    m.loadCategories.mockResolvedValue([bodyCare, lotions]);
    m.freeCategorySlug.mockResolvedValue("mists");
  });

  test("a category name must be letters", async () => {
    expect(await admin.saveCategory(null, { name: "123", parentId: null })).toEqual({ error: "Use letters only, e.g. Body Care." });
    expect(db.categories.insertOne).not.toHaveBeenCalled();
  });

  test("two main categories can't share a name, ignoring case and spaces", async () => {
    expect(await admin.saveCategory(null, { name: " body  care ", parentId: null })).toEqual({
      error: "There is already a main category called “body care”.",
    });
  });

  test("a category can't go inside its own sub-category", async () => {
    expect(await admin.saveCategory("cat1", { name: "Body Care", parentId: "cat2" })).toEqual({
      error: "A category can't go inside itself or one of its own sub-categories.",
    });
  });

  test("a new category is saved with a free link name", async () => {
    const res = await admin.saveCategory(null, { name: "Mists", parentId: null });
    expect(res).toMatchObject({ ok: true, category: { name: "Mists", slug: "mists", parentId: null } });
    expect(db.categories.insertOne).toHaveBeenCalledWith(expect.objectContaining({ name: "Mists", key: "mists", slug: "mists" }));
    expect(m.refreshCatalog).toHaveBeenCalled();
  });

  test("a category with products can't be deleted", async () => {
    db.categories.findOne.mockResolvedValue({ _id: "cat1", name: "Body Care" });
    db.products.countDocuments.mockResolvedValue(2);
    expect(await admin.deleteCategory("cat1")).toHaveProperty("error", expect.stringContaining("2 products"));
    expect(db.categories.deleteOne).not.toHaveBeenCalled();
  });

  test("a category with sub-categories can't be deleted", async () => {
    db.categories.findOne.mockResolvedValueOnce({ _id: "cat1", name: "Body Care" });
    db.categories.countDocuments.mockResolvedValue(1);
    expect(await admin.deleteCategory("cat1")).toHaveProperty("error", expect.stringContaining("1 sub-category"));
    expect(db.categories.deleteOne).not.toHaveBeenCalled();
  });

  test("an empty category is deleted", async () => {
    db.categories.findOne.mockResolvedValueOnce({ _id: "cat1", name: "Body Care" });
    expect(await admin.deleteCategory("cat1")).toEqual({ ok: true });
    expect(db.categories.deleteOne).toHaveBeenCalledWith({ _id: "cat1" });
  });

  test("moving products needs a different, existing category and some products", async () => {
    expect(await admin.moveCategoryProducts("cat1", "nope", ["rose"])).toEqual({ error: "Choose the category to move them to." });
    expect(await admin.moveCategoryProducts("cat1", "cat1", ["rose"])).toEqual({ error: "Choose a different category." });
    expect(await admin.moveCategoryProducts("cat1", "cat2", [])).toEqual({ error: "Choose the products to move." });
    expect(db.products.updateMany).not.toHaveBeenCalled();
  });

  test("moves only the chosen products still in the old category", async () => {
    db.products.updateMany.mockResolvedValue({ modifiedCount: 2 });
    expect(await admin.moveCategoryProducts("cat1", "cat2", ["rose", "lotion"])).toEqual({ ok: true, moved: 2 });
    expect(db.products.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ["rose", "lotion"] }, categoryId: "cat1" },
      { $set: { categoryId: "cat2", updatedAt: NOW } },
    );
  });
});

// ---------- Announcement bar, banner, testimonials ----------

describe("saveAnnouncement", () => {
  const bar = (a: Partial<Announcement> = {}): Announcement => ({
    enabled: true,
    messages: [{ text: "Free delivery", link: "/products/" }],
    background: "#2E1A11",
    textColor: "#C9A36A",
    speed: "normal",
    ...a,
  });

  test("a link that isn't a shop page or https is refused", async () => {
    const res = await admin.saveAnnouncement(bar({ messages: [{ text: "Hi", link: "javascript:alert(1)" }] }));
    expect(res).toEqual({ errors: { messages: [{ link: "Start with / (a shop page) or https://" }] } });
    expect(db.settings.updateOne).not.toHaveBeenCalled();
  });

  test("empty rows are dropped and an unknown speed becomes normal", async () => {
    // @ts-expect-error a tampered speed
    await admin.saveAnnouncement(bar({ speed: "warp", messages: [{ text: "Free delivery", link: "" }, { text: " ", link: "" }] }));
    expect(db.settings.updateOne.mock.calls[0][1].$set).toMatchObject({ messages: [{ text: "Free delivery" }], speed: "normal" });
    expect(m.refreshAnnouncement).toHaveBeenCalled();
  });
});

describe("saveBanner", () => {
  const banner = (b: Partial<Banner> = {}): Banner => ({
    enabled: true,
    image: { url: CLOUD_IMAGE, width: 1600, height: 600 },
    mobileImage: null,
    alt: "New rose range",
    showButtons: true,
    buttonPosition: "bottom-left",
    buttonStyle: "light",
    primaryButton: { label: "", link: "/products/" },
    secondaryButton: { label: "", link: "/about/" },
    ...b,
  });

  test("the buttons' text and links are saved, trimmed", async () => {
    await admin.saveBanner(
      banner({ primaryButton: { label: " Shop the sale ", link: " /products/?category=gift-sets " }, secondaryButton: { label: "", link: "/contact/" } }),
    );
    expect(db.settings.updateOne.mock.calls[0][1].$set).toMatchObject({
      primaryButton: { label: "Shop the sale", link: "/products/?category=gift-sets" },
      secondaryButton: { label: "", link: "/contact/" },
    });
  });

  test("a button link to javascript: is refused", async () => {
    const res = await admin.saveBanner(banner({ primaryButton: { label: "Hi", link: "javascript:alert(1)" } }));
    expect(res).toEqual({ errors: { primaryLink: "Start with / (a shop page) or https://" } });
    expect(db.settings.updateOne).not.toHaveBeenCalled();
  });

  test("a tampered request without buttons is refused, not saved broken", async () => {
    // @ts-expect-error buttons missing from a hand-made request
    const res = await admin.saveBanner({ ...banner(), primaryButton: undefined, secondaryButton: undefined });
    expect(res).toEqual({ errors: { primaryLink: "Choose where this button goes.", secondaryLink: "Choose where this button goes." } });
  });

  test("a picture from another site is refused", async () => {
    const res = await admin.saveBanner(banner({ image: { url: "https://evil.example/b.jpg", width: 1600, height: 600 } }));
    expect(res).toEqual({ errors: { image: "Upload this picture again." } });
    expect(db.settings.updateOne).not.toHaveBeenCalled();
  });

  test("a banner switched on needs a picture", async () => {
    expect(await admin.saveBanner(banner({ image: null }))).toEqual({
      errors: { image: "Upload a banner picture, or switch the banner off." },
    });
  });

  test("a valid banner is saved and the home page refreshed", async () => {
    expect(await admin.saveBanner(banner())).toEqual({ ok: true });
    expect(db.settings.updateOne.mock.calls[0][0]).toEqual({ _id: "banner" });
    expect(m.refreshBanner).toHaveBeenCalled();
  });
});

describe("saveTestimonials", () => {
  const card = { id: "t1", name: "Anjali", place: "Kochi", message: "Love it", photo: null };

  test("a photo from another site is refused", async () => {
    const res = await admin.saveTestimonials({ enabled: true, layout: "grid", autoScroll: false, items: [{ ...card, photo: "https://evil.example/p.jpg" }] });
    expect(res).toEqual({ errors: { items: [{ photo: "Upload this photo again." }] } });
    expect(db.settings.updateOne).not.toHaveBeenCalled();
  });

  test("a repeated card id is replaced with a new one", async () => {
    await admin.saveTestimonials({ enabled: true, layout: "grid", autoScroll: false, items: [card, { ...card, name: "Ravi" }] });
    const [first, second] = db.settings.updateOne.mock.calls[0][1].$set.items;
    expect(first.id).toBe("t1");
    expect(second.id).toMatch(/^[0-9a-f]{24}$/);
    expect(m.refreshTestimonials).toHaveBeenCalled();
  });
});

// ---------- Reviews ----------

describe("shop reviews", () => {
  const review = { name: "Anjali R.", rating: 5, title: "Lovely", text: "Smells like real roses." };

  test("a review for a product that doesn't exist is refused", async () => {
    expect(await admin.saveAdminReview(null, "nope", review)).toEqual({ errors: { productSlug: "Choose a product." } });
    expect(db.reviews.insertOne).not.toHaveBeenCalled();
  });

  test("a new shop review is saved as added by this admin, not verified", async () => {
    db.products.findOne.mockResolvedValue({ _id: "rose" });
    expect(await admin.saveAdminReview(null, "rose", review)).toEqual({ ok: true });
    expect(db.reviews.insertOne.mock.calls[0][0]).toMatchObject({
      productSlug: "rose",
      source: "admin",
      addedBy: owner._id,
      ...review,
      verified: false,
      hidden: false,
    });
    expect(m.refreshReviews).toHaveBeenCalled();
  });

  test("a customer's own review can't be edited here", async () => {
    db.products.findOne.mockResolvedValue({ _id: "rose" });
    db.reviews.updateOne.mockResolvedValue({ matchedCount: 0 });
    const id = new ObjectId();
    expect(await admin.saveAdminReview(id.toHexString(), "rose", review)).toEqual({
      errors: { text: "This review no longer exists, or was written by a customer." },
    });
    expect(db.reviews.updateOne.mock.calls[0][0]).toEqual({ _id: id, source: "admin" });
  });

  test("hiding a review saves true or false only", async () => {
    const id = new ObjectId();
    // @ts-expect-error a tampered value
    await admin.setReviewHidden(id.toHexString(), "yes");
    expect(db.reviews.updateOne).toHaveBeenCalledWith({ _id: id }, { $set: { hidden: false, updatedAt: NOW } });
  });

  test("an invalid review ID changes nothing", async () => {
    await admin.setReviewHidden("not-an-id", true);
    await admin.deleteReview("not-an-id");
    expect(db.reviews.updateOne).not.toHaveBeenCalled();
    expect(db.reviews.deleteOne).not.toHaveBeenCalled();
  });

  test("deletes the review with that ID", async () => {
    const id = new ObjectId();
    expect(await admin.deleteReview(id.toHexString())).toEqual({ ok: true });
    expect(db.reviews.deleteOne).toHaveBeenCalledWith({ _id: id });
  });
});

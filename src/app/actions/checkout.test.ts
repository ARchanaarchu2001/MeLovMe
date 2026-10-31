// @vitest-environment node
import { createHmac } from "node:crypto";
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Product } from "@/lib/product";

// ---------- Fakes for everything outside this file ----------

const m = vi.hoisted(() => ({
  requireUser: vi.fn(),
  getDb: vi.fn(),
  getCatalog: vi.fn(),
  adjustStock: vi.fn(),
  getPaymentSettings: vi.fn(),
  createRazorpayOrder: vi.fn(),
  markOrderPaid: vi.fn(),
  notifyShop: vi.fn(),
  after: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: m.after }));
// Messages come back as their key (plus any values), so tests can check which message was chosen
vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async () => (key: string, values?: object) => (values ? `${key} ${JSON.stringify(values)}` : key)),
}));
vi.mock("@/lib/server/session", () => ({ requireUser: m.requireUser }));
vi.mock("@/lib/server/db", () => ({ getDb: m.getDb }));
vi.mock("@/lib/server/products", () => ({ getCatalog: m.getCatalog, adjustStock: m.adjustStock }));
vi.mock("@/lib/server/payments", () => ({ getPaymentSettings: m.getPaymentSettings }));
vi.mock("@/lib/server/orders", () => ({ markOrderPaid: m.markOrderPaid, notifyShop: m.notifyShop }));
// The real signature check (it only uses node:crypto); creating the Razorpay order is faked
vi.mock("@/lib/server/razorpay", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/razorpay")>()),
  createRazorpayOrder: m.createRazorpayOrder,
}));

import { confirmPayment, createOrder, deleteAddress, saveAddress } from "./checkout";

// ---------- Sample data ----------

// A fixed "today" so offer prices don't change with the date
const NOW = new Date("2026-06-15T12:00:00+05:30");

const product = (p: Partial<Product>): Product => ({
  slug: "rose-mist",
  name: "Rose Mist",
  categoryId: "c1",
  category: "Mists",
  size: "100 ml",
  price: 500,
  shortDescription: "",
  description: "",
  images: ["/images/rose.jpg"],
  highlights: [],
  ingredients: [],
  howToUse: "",
  enabled: true,
  stock: 5,
  inStock: true,
  offer: null,
  combos: [],
  ...p,
});

// ₹500 each, 2 for ₹900, 5 in stock
const rose = product({ combos: [{ qty: 2, price: 900 }] });
// ₹1,550 each, stock not counted
const lotion = product({ slug: "lotion", name: "Body Lotion", price: 1550, stock: null, images: ["/images/lotion.jpg"] });
// 20% off, running today: ₹400
const soap = product({ slug: "soap", name: "Soap", price: 500, stock: 50, offer: { type: "percent", value: 20 } });
const soldOut = product({ slug: "sold-out", name: "Sold Out", stock: 0, inStock: false });

const homeId = new ObjectId();
const home = { _id: homeId, name: "Anjali", phone: "9876543210", address: "12 MG Road", city: "Kochi", state: "Kerala", pincode: "682001" };
const shopper = () => ({ _id: new ObjectId(), name: "Anjali", phone: "9876543210", superAdmin: false, addresses: [home] });

const redirectError = () => Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login/?next=%2Fcheckout%2F;307;" });

let user: ReturnType<typeof shopper>;
let orders: { insertOne: ReturnType<typeof vi.fn>; findOne: ReturnType<typeof vi.fn> };
let users: { updateOne: ReturnType<typeof vi.fn> };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("RAZORPAY_KEY_SECRET", "test-key-secret");
  user = shopper();
  orders = { insertOne: vi.fn(async () => ({})), findOne: vi.fn(async () => null) };
  users = { updateOne: vi.fn(async () => ({})) };
  m.requireUser.mockImplementation(async () => user);
  m.getDb.mockResolvedValue({ orders, users });
  m.getCatalog.mockResolvedValue([rose, lotion, soap, soldOut]);
  m.adjustStock.mockResolvedValue(undefined);
  m.getPaymentSettings.mockResolvedValue({ razorpay: true, cod: true });
  m.createRazorpayOrder.mockResolvedValue("order_RZP123");
  m.markOrderPaid.mockResolvedValue(undefined);
  m.after.mockImplementation((cb: () => unknown) => cb());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const insertedOrder = () => orders.insertOne.mock.calls[0][0];

// ---------- createOrder ----------

describe("createOrder: who can order and how", () => {
  test("a guest is sent to log in and nothing is saved", async () => {
    m.requireUser.mockRejectedValue(redirectError());
    await expect(createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }])).rejects.toThrow("NEXT_REDIRECT");
    expect(m.requireUser).toHaveBeenCalledWith("/checkout/");
    expect(orders.insertOne).not.toHaveBeenCalled();
  });

  test("an unknown payment method is refused", async () => {
    // @ts-expect-error a method a tampered request might send
    const res = await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }], "upi");
    expect(res).toEqual({ error: "methodUnavailable" });
  });

  test("cash on delivery is refused while the shop has it switched off", async () => {
    m.getPaymentSettings.mockResolvedValue({ razorpay: true, cod: false });
    const res = await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }], "cod");
    expect(res).toEqual({ error: "methodUnavailable" });
    expect(orders.insertOne).not.toHaveBeenCalled();
  });

  test("an address that isn't one of the customer's own is refused", async () => {
    const res = await createOrder(new ObjectId().toHexString(), [{ slug: "rose-mist", qty: 1 }]);
    expect(res).toEqual({ error: "chooseAddress" });
  });
});

describe("createOrder: stock", () => {
  test("a product that has sold out stops the order", async () => {
    const res = await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }, { slug: "sold-out", qty: 1 }]);
    expect(res).toEqual({ error: "outOfStock" });
    expect(orders.insertOne).not.toHaveBeenCalled();
  });

  test("asking for more than there are in stock says how many are left", async () => {
    const res = await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 6 }]);
    expect(res).toEqual({ error: 'notEnoughStock {"name":"Rose Mist","count":5}' });
  });

  test("a product without a stock count is capped at 10 pieces", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "lotion", qty: 25 }], "cod");
    // 10 × ₹1,550 = ₹15,500
    expect(insertedOrder().items[0]).toMatchObject({ qty: 10, total: 15500 });
  });

  test("the same product split over two cart lines can't add up to more than the stock", async () => {
    // 3 + 3 = 6 Rose Mist, only 5 in stock
    const res = await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 3 }, { slug: "rose-mist", qty: 3 }], "cod");
    expect(res).toEqual({ error: 'notEnoughStock {"name":"Rose Mist","count":5}' });
    expect(orders.insertOne).not.toHaveBeenCalled();
  });

  test("a product split over cart lines becomes one line, capped at 10 pieces", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "lotion", qty: 8 }, { slug: "lotion", qty: 8 }], "cod");
    // 10 × ₹1,550 = ₹15,500
    expect(insertedOrder().items).toHaveLength(1);
    expect(insertedOrder().items[0]).toMatchObject({ qty: 10, total: 15500 });
  });
});

describe("createOrder: prices are worked out on the server", () => {
  test("prices sent by the browser are ignored", async () => {
    const tampered = [{ slug: "rose-mist", qty: 1, price: 1, total: 1 }] as unknown as { slug: string; qty: number }[];
    await createOrder(homeId.toHexString(), tampered, "cod");
    expect(insertedOrder()).toMatchObject({ subtotal: 500, total: 500, items: [{ price: 500, total: 500 }] });
  });

  test("combo prices apply by quantity", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 3 }], "cod");
    // 2 for ₹900 + 1 at ₹500 = ₹1,400 (saves ₹100 on ₹1,500)
    expect(insertedOrder().items[0]).toMatchObject({ qty: 3, price: 500, total: 1400, comboSaving: 100 });
  });

  test("a running offer charges the offer price", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "soap", qty: 2 }], "cod");
    // ₹500 − 20% = ₹400 each, × 2 = ₹800
    expect(insertedOrder().items[0]).toMatchObject({ price: 400, total: 800 });
  });

  test("the order total adds up every line", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 2 }, { slug: "lotion", qty: 1 }], "cod");
    // ₹900 (combo) + ₹1,550 = ₹2,450; delivery is free
    expect(insertedOrder()).toMatchObject({ subtotal: 2450, shipping: 0, total: 2450 });
  });

  test("unknown products and impossible quantities are dropped", async () => {
    await createOrder(
      homeId.toHexString(),
      [
        { slug: "rose-mist", qty: 1 },
        { slug: "no-such-thing", qty: 1 },
        { slug: "lotion", qty: 0 },
        { slug: "lotion", qty: -2 },
        { slug: "lotion", qty: 1.5 },
      ],
      "cod",
    );
    expect(insertedOrder().items.map((i: { slug: string }) => i.slug)).toEqual(["rose-mist"]);
  });

  test("a cart with nothing buyable is refused", async () => {
    const res = await createOrder(homeId.toHexString(), [{ slug: "no-such-thing", qty: 1 }]);
    expect(res).toEqual({ error: "cartEmpty" });
  });

  test("a cart that isn't a list is treated as empty", async () => {
    // @ts-expect-error a tampered request
    const res = await createOrder(homeId.toHexString(), "everything");
    expect(res).toEqual({ error: "cartEmpty" });
  });
});

describe("createOrder: cash on delivery", () => {
  test("places the order straight away, ready to pack", async () => {
    const res = await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }], "cod");
    const order = insertedOrder();
    expect(res).toEqual({ placed: order._id });
    expect(order).toMatchObject({ userId: user._id, status: "cod", paymentMethod: "cod", fulfillment: "placed", stockTaken: true });
    expect(order._id).toMatch(/^ML-[A-Z0-9]+$/);
  });

  test("takes the items out of stock and tells the shop", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 2 }], "cod");
    const order = insertedOrder();
    expect(m.adjustStock).toHaveBeenCalledWith(order.items, -1);
    expect(m.notifyShop).toHaveBeenCalledWith(order);
  });

  test("doesn't start a Razorpay payment", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }], "cod");
    expect(m.createRazorpayOrder).not.toHaveBeenCalled();
  });

  test("keeps its own copy of the address, without the saved address's ID", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }], "cod");
    const { _id, ...address } = home;
    expect(_id).toBeDefined();
    expect(insertedOrder().address).toEqual(address);
  });
});

describe("createOrder: paying online", () => {
  test("creates the Razorpay order for the server's total", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 3 }]);
    // 2 for ₹900 + ₹500 = ₹1,400
    expect(m.createRazorpayOrder).toHaveBeenCalledWith(1400, insertedOrder()._id);
  });

  test("saves the order as awaiting payment, without taking stock yet", async () => {
    await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }]);
    expect(insertedOrder()).toMatchObject({ status: "awaiting_payment", paymentMethod: "razorpay", razorpayOrderId: "order_RZP123" });
    expect(insertedOrder().stockTaken).toBeUndefined();
    expect(m.adjustStock).not.toHaveBeenCalled();
  });

  test("returns the order for the checkout page, with no slugs on its items", async () => {
    const res = await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }]);
    expect(res).toMatchObject({ razorpayOrderId: "order_RZP123", subtotal: 500, total: 500 });
    expect((res as { items: object[] }).items).toEqual([{ name: "Rose Mist", size: "100 ml", qty: 1, price: 500, total: 500 }]);
  });

  test("a Razorpay failure saves nothing and asks to try again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.createRazorpayOrder.mockRejectedValue(new Error("Razorpay down"));
    const res = await createOrder(homeId.toHexString(), [{ slug: "rose-mist", qty: 1 }]);
    expect(res).toEqual({ error: "paymentStartFailed" });
    expect(orders.insertOne).not.toHaveBeenCalled();
  });
});

// ---------- confirmPayment ----------

describe("confirmPayment", () => {
  // Razorpay signs "<razorpay order id>|<payment id>" with the key secret
  const sign = (orderId: string, paymentId: string) =>
    createHmac("sha256", "test-key-secret").update(`${orderId}|${paymentId}`).digest("hex");
  const awaiting = { _id: "ML-ABC", razorpayOrderId: "order_RZP123", status: "awaiting_payment" };

  test("only looks for the order among the customer's own orders", async () => {
    await confirmPayment("ML-ABC", { razorpay_payment_id: "pay_1", razorpay_signature: "x" });
    expect(orders.findOne).toHaveBeenCalledWith({ _id: "ML-ABC", userId: user._id });
  });

  test("an order that isn't found is reported", async () => {
    const res = await confirmPayment("ML-ABC", { razorpay_payment_id: "pay_1", razorpay_signature: "x" });
    expect(res).toEqual({ error: "orderNotFound" });
  });

  test("a cash on delivery order (no Razorpay order) can't be confirmed", async () => {
    orders.findOne.mockResolvedValue({ _id: "ML-ABC", status: "cod" });
    const res = await confirmPayment("ML-ABC", { razorpay_payment_id: "pay_1", razorpay_signature: "x" });
    expect(res).toEqual({ error: "orderNotFound" });
  });

  test("a wrong signature doesn't mark the order paid", async () => {
    orders.findOne.mockResolvedValue(awaiting);
    const res = await confirmPayment("ML-ABC", { razorpay_payment_id: "pay_1", razorpay_signature: "0".repeat(64) });
    expect(res).toEqual({ error: 'paymentNotConfirmed {"id":"ML-ABC"}' });
    expect(m.markOrderPaid).not.toHaveBeenCalled();
  });

  test("a signature made for a different Razorpay order is refused", async () => {
    orders.findOne.mockResolvedValue(awaiting);
    const res = await confirmPayment("ML-ABC", { razorpay_payment_id: "pay_1", razorpay_signature: sign("order_OTHER", "pay_1") });
    expect(res).toHaveProperty("error");
    expect(m.markOrderPaid).not.toHaveBeenCalled();
  });

  test("a missing payment ID is refused", async () => {
    orders.findOne.mockResolvedValue(awaiting);
    const res = await confirmPayment("ML-ABC", { razorpay_payment_id: "", razorpay_signature: sign("order_RZP123", "") });
    expect(res).toHaveProperty("error");
    expect(m.markOrderPaid).not.toHaveBeenCalled();
  });

  test("a valid signature marks the order paid", async () => {
    orders.findOne.mockResolvedValue(awaiting);
    const res = await confirmPayment("ML-ABC", { razorpay_payment_id: "pay_1", razorpay_signature: sign("order_RZP123", "pay_1") });
    expect(res).toEqual({ ok: true });
    expect(m.markOrderPaid).toHaveBeenCalledWith("order_RZP123", "pay_1");
  });
});

// ---------- Saved addresses ----------

describe("saveAddress", () => {
  const input = { name: " Anjali ", phone: "9876543210", address: "5 Beach Road", city: "Kochi", state: "Kerala", pincode: "682001" };

  test("an invalid address returns an error per field and saves nothing", async () => {
    const res = await saveAddress({ ...input, phone: "12345", pincode: "" });
    expect(res).toEqual({ errors: { phone: "invalidPhone", pincode: "required" } });
    expect(users.updateOne).not.toHaveBeenCalled();
  });

  test("a new address is added with only the known fields, trimmed", async () => {
    const res = await saveAddress({ ...input, superAdmin: true } as typeof input);
    const pushed = users.updateOne.mock.calls[0][1].$push.addresses;
    expect(users.updateOne.mock.calls[0][0]).toEqual({ _id: user._id });
    expect(pushed).toEqual({ ...input, name: "Anjali", _id: expect.any(ObjectId) });
    expect(res).toEqual({ ...input, name: "Anjali", id: pushed._id.toHexString() });
  });

  test("an 11th address is refused", async () => {
    user.addresses = Array.from({ length: 10 }, () => ({ ...home, _id: new ObjectId() }));
    const res = await saveAddress(input);
    expect(res).toEqual({ errors: { address: 'tooManyAddresses {"max":10}' } });
    expect(users.updateOne).not.toHaveBeenCalled();
  });

  test("editing a saved address updates that address", async () => {
    const res = await saveAddress(input, homeId.toHexString());
    expect(users.updateOne).toHaveBeenCalledWith(
      { _id: user._id, "addresses._id": homeId },
      { $set: { "addresses.$": { ...input, name: "Anjali", _id: homeId } } },
    );
    expect(res).toEqual({ ...input, name: "Anjali", id: homeId.toHexString() });
  });

  test("editing an address that isn't the customer's is refused", async () => {
    const res = await saveAddress(input, new ObjectId().toHexString());
    expect(res).toEqual({ errors: { address: "addressGone" } });
    expect(users.updateOne).not.toHaveBeenCalled();
  });
});

describe("deleteAddress", () => {
  test("removes one of the customer's own addresses", async () => {
    await deleteAddress(homeId.toHexString());
    expect(users.updateOne).toHaveBeenCalledWith({ _id: user._id }, { $pull: { addresses: { _id: homeId } } });
  });

  test("an address that isn't theirs is left alone", async () => {
    expect(await deleteAddress(new ObjectId().toHexString())).toEqual({ ok: true });
    expect(users.updateOne).not.toHaveBeenCalled();
  });
});
